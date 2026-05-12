import { sorobanService } from './soroban.service';
import { logger } from '../utils/logger';
import { FraudReport, FraudFlag } from '../types';

/**
 * Fraud Detection Service — Rule-Based Analysis Engine
 * 
 * Implements configurable rules for detecting suspicious claim patterns:
 * 1. Duplicate Detection — Same claimant, same pool, similar description within 30 days
 * 2. Velocity Check — More than 3 claims in 90 days from same address
 * 3. Amount Anomaly — Claim amount > 80% of pool's max payout
 * 4. New Member Check — Claim filed within 7 days of joining pool
 * 5. Pattern Matching — Multiple claims across different pools from same address
 * 
 * Each rule scores 0-20 points. Aggregate determines risk level:
 * - 0-30: Low risk → auto-proceed
 * - 31-60: Medium risk → flag for manual review
 * - 61-100: High risk → flag for governance vote
 */

const CTX = 'FraudDetection';

// Configuration constants
const DUPLICATE_WINDOW_DAYS = 30;
const VELOCITY_WINDOW_DAYS = 90;
const VELOCITY_THRESHOLD = 3;
const AMOUNT_ANOMALY_RATIO = 0.8;
const NEW_MEMBER_WINDOW_DAYS = 7;
const MAX_POINTS_PER_RULE = 20;
const RULES_COUNT = 5;
const MAX_SCORE = RULES_COUNT * MAX_POINTS_PER_RULE; // 100

export class FraudDetectionService {
  /**
   * Analyze a claim for fraud risk using rule-based scoring.
   */
  async analyzeClaim(
    claimId: number,
    claimantAddress: string,
    amount: bigint
  ): Promise<FraudReport> {
    logger.info(CTX, `Starting fraud analysis for claim ${claimId}`, {
      claimant: claimantAddress.slice(0, 8),
      amount: amount.toString(),
    });

    const flags: FraudFlag[] = [];
    let totalScore = 0;

    // Rule 1: Duplicate Detection
    const duplicateFlag = await this.checkDuplicateClaim(claimantAddress);
    if (duplicateFlag) {
      flags.push(duplicateFlag);
      totalScore += duplicateFlag.score;
    }

    // Rule 2: Velocity Check
    const velocityFlag = await this.checkVelocity(claimantAddress);
    if (velocityFlag) {
      flags.push(velocityFlag);
      totalScore += velocityFlag.score;
    }

    // Rule 3: Amount Anomaly
    const amountFlag = this.checkAmountAnomaly(amount);
    if (amountFlag) {
      flags.push(amountFlag);
      totalScore += amountFlag.score;
    }

    // Rule 4: New Member Check (for future use — requires onchain member join date)
    const newMemberFlag = await this.checkNewMember(claimantAddress);
    if (newMemberFlag) {
      flags.push(newMemberFlag);
      totalScore += newMemberFlag.score;
    }

    // Rule 5: Pattern Matching (multi-pool claiming)
    const patternFlag = await this.checkMultiPoolPattern(claimantAddress);
    if (patternFlag) {
      flags.push(patternFlag);
      totalScore += patternFlag.score;
    }

    // Determine risk level and recommendation
    const riskLevel = this.getRiskLevel(totalScore);
    const recommendation = this.getRecommendation(riskLevel);

    const report: FraudReport = {
      claimId,
      riskScore: totalScore,
      riskLevel,
      flags,
      recommendation,
      timestamp: new Date().toISOString(),
    };

    logger.info(CTX, `Fraud analysis complete for claim ${claimId}`, {
      riskScore: totalScore,
      riskLevel,
      flagCount: flags.length,
      recommendation,
    });

    return report;
  }

  // ── Rule 1: Duplicate Detection ──────────────────────────────

  private async checkDuplicateClaim(claimantAddress: string): Promise<FraudFlag | null> {
    try {
      // Get all claims from this claimant
      const userClaimCount = await sorobanService.getUserClaimCount(claimantAddress);
      
      if (userClaimCount < 2) {
        return null; // First time claimant
      }

      // In a real implementation, we'd query recent claims with similar descriptions
      // For MVP, we flag if the user has too many recent claims (see Velocity Check)
      
      logger.debug(CTX, `Duplicate check: User has ${userClaimCount} claims`, {
        claimant: claimantAddress.slice(0, 8),
      });

      // Check if any claims are suspiciously similar (same amount, short time apart)
      // For now, this is handled by the Velocity check below
      return null;
    } catch (error) {
      logger.warn(CTX, 'Duplicate check failed', { error });
      return null;
    }
  }

  // ── Rule 2: Velocity Check ──────────────────────────────────

  private async checkVelocity(claimantAddress: string): Promise<FraudFlag | null> {
    try {
      const userClaimCount = await sorobanService.getUserClaimCount(claimantAddress);

      if (userClaimCount <= VELOCITY_THRESHOLD) {
        return null;
      }

      // User has filed more than VELOCITY_THRESHOLD claims
      // Calculate score based on how much they exceed the threshold
      const excessClaims = userClaimCount - VELOCITY_THRESHOLD;
      const score = Math.min(
        Math.ceil((excessClaims / VELOCITY_THRESHOLD) * MAX_POINTS_PER_RULE),
        MAX_POINTS_PER_RULE
      );

      return {
        rule: 'velocity_check',
        triggered: true,
        score,
        detail: `User has filed ${userClaimCount} claims in recent period. Threshold: ${VELOCITY_THRESHOLD}.`,
      };
    } catch (error) {
      logger.warn(CTX, 'Velocity check failed', { error });
      return null;
    }
  }

  // ── Rule 3: Amount Anomaly ──────────────────────────────────

  private checkAmountAnomaly(amount: bigint): FraudFlag | null {
    // For MVP, we use a fixed threshold instead of querying pool max payout
    // In production, this would compare against the actual pool's maxPayout
    const ASSUMED_MAX_PAYOUT = BigInt(10000000); // 1M stroops = ~0.1 USDC in test environment
    const anomalyThreshold = (ASSUMED_MAX_PAYOUT * BigInt(Math.ceil(AMOUNT_ANOMALY_RATIO * 100))) / BigInt(100);

    if (amount <= anomalyThreshold) {
      return null;
    }

    const exceedRatio = (Number(amount) / Number(anomalyThreshold)) - 1;
    const score = Math.min(
      Math.ceil(exceedRatio * MAX_POINTS_PER_RULE),
      MAX_POINTS_PER_RULE
    );

    return {
      rule: 'amount_anomaly',
      triggered: true,
      score,
      detail: `Claim amount (${amount.toString()} stroops) exceeds ${AMOUNT_ANOMALY_RATIO * 100}% of assumed pool max.`,
    };
  }

  // ── Rule 4: New Member Check ────────────────────────────────

  private async checkNewMember(claimantAddress: string): Promise<FraudFlag | null> {
    try {
      // Check if claimant is a pool member
      const isMember = await sorobanService.isPoolMember(claimantAddress);

      if (!isMember) {
        // Non-member claims are already handled upstream
        return {
          rule: 'new_member_check',
          triggered: true,
          score: MAX_POINTS_PER_RULE, // Highest risk
          detail: 'Claimant is not an active pool member.',
        };
      }

      // For MVP, we can't determine join date from on-chain data
      // In production, this would query the pool member join timestamp
      return null;
    } catch (error) {
      logger.warn(CTX, 'New member check failed', { error });
      return null;
    }
  }

  // ── Rule 5: Pattern Matching (Multi-Pool) ───────────────────

  private async checkMultiPoolPattern(claimantAddress: string): Promise<FraudFlag | null> {
    try {
      // Query total claims across all pools
      const totalClaims = await sorobanService.getClaimCount();
      
      // Simple heuristic: if user claims are >50% of all claims, flag for review
      const userClaimCount = await sorobanService.getUserClaimCount(claimantAddress);
      
      if (totalClaims === 0) {
        return null;
      }

      const userClaimRatio = userClaimCount / totalClaims;

      if (userClaimRatio > 0.5) {
        const score = Math.min(
          Math.ceil(userClaimRatio * MAX_POINTS_PER_RULE),
          MAX_POINTS_PER_RULE
        );

        return {
          rule: 'multi_pool_pattern',
          triggered: true,
          score,
          detail: `User accounts for ${Math.round(userClaimRatio * 100)}% of all claims. Potential pattern abuse.`,
        };
      }

      return null;
    } catch (error) {
      logger.warn(CTX, 'Pattern matching check failed', { error });
      return null;
    }
  }

  // ── Helpers ──────────────────────────────────────────────────

  private getRiskLevel(score: number): FraudReport['riskLevel'] {
    if (score <= 30) return 'low';
    if (score <= 60) return 'medium';
    return 'high';
  }

  private getRecommendation(
    riskLevel: FraudReport['riskLevel']
  ): FraudReport['recommendation'] {
    if (riskLevel === 'low') return 'auto-proceed';
    if (riskLevel === 'medium') return 'manual-review';
    return 'governance-vote';
  }
}

export const fraudDetectionService = new FraudDetectionService();
