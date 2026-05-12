import cron from 'node-cron';
import { sorobanService } from './soroban.service';
import { notificationService } from './notification.service';
import { logger } from '../utils/logger';
import { stroopsToDecimal } from '../utils/stellar';
import { KeeperLog } from '../types';

/**
 * Keeper Service — Smart Account Automation Executor
 *
 * Polls the Smart Account contract for due recurring payments
 * and scheduled transfers, then executes them on-chain.
 * Runs on a configurable cron schedule (default: every 15 minutes).
 */

const CTX = 'KeeperService';

export class KeeperService {
  private isRunning = false;
  private logs: KeeperLog[] = [];
  private cronJob: cron.ScheduledTask | null = null;

  /**
   * Start the keeper cron job.
   * @param schedule Cron expression (default: every 15 minutes)
   */
  start(schedule = '*/15 * * * *'): void {
    if (this.cronJob) {
      logger.warn(CTX, 'Keeper already running');
      return;
    }

    this.cronJob = cron.schedule(schedule, async () => {
      await this.runCycle();
    });

    logger.info(CTX, `Keeper started with schedule: ${schedule}`);
  }

  /** Stop the keeper cron job. */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info(CTX, 'Keeper stopped');
    }
  }

  /** Run a single keeper cycle manually. */
  async runCycle(): Promise<void> {
    if (this.isRunning) {
      logger.debug(CTX, 'Skipping cycle — previous cycle still running');
      return;
    }

    this.isRunning = true;
    logger.info(CTX, 'Starting keeper cycle');

    try {
      await this.processRecurringPayments();
      await this.processScheduledTransfers();
    } catch (error) {
      logger.error(CTX, 'Keeper cycle failed', { error });
    } finally {
      this.isRunning = false;
    }
  }

  /** Get recent keeper logs. */
  getRecentLogs(limit = 50): KeeperLog[] {
    return this.logs.slice(-limit);
  }

  // ── Recurring Payments ───────────────────────────────────────

  private async processRecurringPayments(): Promise<void> {
    try {
      const count = await sorobanService.getRecurringPaymentCount();
      logger.debug(CTX, `Checking ${count} recurring payments`);

      const now = Math.floor(Date.now() / 1000);

      for (let i = 0; i < count; i++) {
        try {
          const payment = await sorobanService.getRecurringPayment(i);
          if (!payment || !payment.isActive) continue;

          // Check if payment is due
          if (payment.nextExecution > now) continue;

          // Check max executions
          if (payment.maxExecutions > 0 && payment.totalExecuted >= payment.maxExecutions) continue;

          logger.info(CTX, `Executing recurring payment #${i}`, {
            owner: payment.owner.slice(0, 8),
            amount: payment.amount.toString(),
          });

          const txHash = await sorobanService.executeRecurringPayment(i);

          this.addLog({
            id: `rec-${i}-${Date.now()}`,
            type: 'recurring_payment',
            contractEntryId: i,
            success: true,
            txHash,
            executedAt: new Date().toISOString(),
          });

          // Notify the payment owner
          notificationService.notifySmartAccountExecution(
            payment.owner,
            'recurring',
            stroopsToDecimal(payment.amount)
          );
        } catch (error) {
          logger.error(CTX, `Failed to execute recurring payment #${i}`, { error });
          this.addLog({
            id: `rec-${i}-${Date.now()}`,
            type: 'recurring_payment',
            contractEntryId: i,
            success: false,
            error: String(error),
            executedAt: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      logger.error(CTX, 'Failed to process recurring payments', { error });
    }
  }

  // ── Scheduled Transfers ──────────────────────────────────────

  private async processScheduledTransfers(): Promise<void> {
    try {
      const count = await sorobanService.getScheduledTransferCount();
      logger.debug(CTX, `Checking ${count} scheduled transfers`);

      const now = Math.floor(Date.now() / 1000);

      for (let i = 0; i < count; i++) {
        try {
          const transfer = await sorobanService.getScheduledTransfer(i);
          if (!transfer || transfer.executed) continue;

          // Check if transfer is due
          if (transfer.executeAfter > now) continue;

          logger.info(CTX, `Executing scheduled transfer #${i}`, {
            owner: transfer.owner.slice(0, 8),
            amount: transfer.amount.toString(),
          });

          const txHash = await sorobanService.executeScheduledTransfer(i);

          this.addLog({
            id: `sched-${i}-${Date.now()}`,
            type: 'scheduled_transfer',
            contractEntryId: i,
            success: true,
            txHash,
            executedAt: new Date().toISOString(),
          });

          notificationService.notifySmartAccountExecution(
            transfer.owner,
            'scheduled',
            stroopsToDecimal(transfer.amount)
          );
        } catch (error) {
          logger.error(CTX, `Failed to execute scheduled transfer #${i}`, { error });
          this.addLog({
            id: `sched-${i}-${Date.now()}`,
            type: 'scheduled_transfer',
            contractEntryId: i,
            success: false,
            error: String(error),
            executedAt: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      logger.error(CTX, 'Failed to process scheduled transfers', { error });
    }
  }

  // ── Internal ─────────────────────────────────────────────────

  private addLog(log: KeeperLog): void {
    this.logs.push(log);
    // Keep only last 500 logs in memory
    if (this.logs.length > 500) {
      this.logs = this.logs.slice(-500);
    }
  }
}

export const keeperService = new KeeperService();
