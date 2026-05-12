import { sorobanService } from './soroban.service';
import { ipfsService } from './ipfs.service';
import { logger } from '../utils/logger';
import { VerificationReport, VerificationCheck } from '../types';

/**
 * Claim Verification Service
 * 
 * Validates insurance claims against on-chain data and IPFS evidence.
 * Returns a structured verification report with individual check results.
 */

const CTX = 'ClaimVerification';

export class ClaimVerificationService {
  /**
   * Run full verification on a claim.
   */
  async verifyClaim(claimId: number): Promise<VerificationReport> {
    logger.info(CTX, `Starting verification for claim #${claimId}`);

    const checks: VerificationCheck[] = [];

    // 1. Check claim exists on-chain
    const claim = await sorobanService.getClaim(claimId);
    checks.push({
      name: 'claim_exists',
      passed: claim !== null,
      detail: claim ? `Claim found on-chain (status: ${claim.status})` : 'Claim not found on-chain',
    });

    if (!claim) {
      return this.buildReport(claimId, checks);
    }

    // 2. Verify claimant is a pool member
    let isMember = false;
    try {
      isMember = await sorobanService.isPoolMember(claim.claimant);
    } catch {
      isMember = false;
    }
    checks.push({
      name: 'claimant_is_member',
      passed: isMember,
      detail: isMember
        ? `Claimant ${claim.claimant.slice(0, 8)}... is an active pool member`
        : `Claimant ${claim.claimant.slice(0, 8)}... is NOT a pool member`,
    });

    // 3. Verify claim amount is positive and reasonable
    const amountPositive = claim.amount > BigInt(0);
    checks.push({
      name: 'amount_positive',
      passed: amountPositive,
      detail: amountPositive
        ? `Claim amount: ${claim.amount.toString()} stroops`
        : 'Claim amount is zero or negative',
    });

    // 4. Verify IPFS evidence exists
    let evidenceExists = false;
    if (claim.evidenceIpfs && claim.evidenceIpfs.length > 0) {
      try {
        evidenceExists = await ipfsService.isPinned(claim.evidenceIpfs);
      } catch {
        evidenceExists = false;
      }
    }
    checks.push({
      name: 'evidence_on_ipfs',
      passed: evidenceExists,
      detail: evidenceExists
        ? `Evidence pinned on IPFS: ${claim.evidenceIpfs}`
        : `Evidence NOT found on IPFS: ${claim.evidenceIpfs || 'no CID provided'}`,
    });

    // 5. Verify claim is in a valid state for processing
    const validStatus = claim.status === 'Submitted' || claim.status === 'UnderReview';
    checks.push({
      name: 'valid_status',
      passed: validStatus,
      detail: validStatus
        ? `Claim status (${claim.status}) is eligible for review`
        : `Claim status (${claim.status}) is not eligible for review`,
    });

    // 6. Check claim is not stale (submitted within last 90 days)
    const now = Math.floor(Date.now() / 1000);
    const maxAge = 90 * 24 * 60 * 60; // 90 days
    const isRecent = (now - claim.submittedAt) < maxAge;
    checks.push({
      name: 'claim_recency',
      passed: isRecent,
      detail: isRecent
        ? `Claim submitted ${Math.floor((now - claim.submittedAt) / 86400)} days ago`
        : `Claim is stale — submitted ${Math.floor((now - claim.submittedAt) / 86400)} days ago`,
    });

    return this.buildReport(claimId, checks);
  }

  /**
   * Quick check if a claim submission is valid before on-chain submission.
   */
  async preSubmissionCheck(
    claimantAddress: string,
    amount: bigint,
    evidenceCid: string
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check claimant is a pool member
    try {
      const isMember = await sorobanService.isPoolMember(claimantAddress);
      if (!isMember) {
        errors.push('Claimant is not a pool member');
      }
    } catch {
      errors.push('Could not verify pool membership');
    }

    // Check amount
    if (amount <= BigInt(0)) {
      errors.push('Claim amount must be positive');
    }

    // Check evidence CID format
    if (!evidenceCid || !ipfsService.isValidCid(evidenceCid)) {
      errors.push('Invalid or missing evidence IPFS CID');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ── Private ──────────────────────────────────────────────────

  private buildReport(claimId: number, checks: VerificationCheck[]): VerificationReport {
    const passedCount = checks.filter((c) => c.passed).length;
    const totalCount = checks.length;
    const overallScore = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

    const report: VerificationReport = {
      claimId,
      isValid: checks.every((c) => c.passed),
      checks,
      overallScore,
      timestamp: new Date().toISOString(),
    };

    logger.info(CTX, `Verification complete for claim #${claimId}`, {
      score: overallScore,
      valid: report.isValid,
      passed: passedCount,
      total: totalCount,
    });

    return report;
  }
}

export const claimVerificationService = new ClaimVerificationService();
