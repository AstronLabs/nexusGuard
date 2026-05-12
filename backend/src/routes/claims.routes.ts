import { Router, Request, Response, NextFunction } from "express";
import { claimVerificationService } from "../services/claim-verification.service";
import { fraudDetectionService } from "../services/fraud-detection.service";
import { notificationService } from "../services/notification.service";
import { sorobanService } from "../services/soroban.service";
import { authMiddleware } from "../middleware/auth.middleware";
import { x402PaymentGate } from "../middleware/x402.middleware";
import { createHttpError } from "../middleware/error.middleware";
import { ApiResponse, VerificationReport, FraudReport } from "../types";

const router = Router();

/**
 * POST /api/claims/submit
 * Submit a new claim — x402 payment gated (anti-spam).
 * Body: { claimantAddress, amount, descriptionHash, evidenceCid }
 */
router.post(
  "/submit",
  authMiddleware,
  x402PaymentGate({
    amount: "0.01",
    asset: "USDC",
    description: "Anti-spam fee for claim submission",
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { amount, descriptionHash, evidenceCid } = req.body;
      const claimantAddress = req.stellarAddress!;

      if (!amount || !descriptionHash || !evidenceCid) {
        throw createHttpError(
          400,
          "Missing required fields: amount, descriptionHash, evidenceCid",
        );
      }

      // Pre-submission validation
      const preCheck = await claimVerificationService.preSubmissionCheck(
        claimantAddress,
        BigInt(amount),
        evidenceCid,
      );

      if (!preCheck.valid) {
        res.status(400).json({
          success: false,
          data: { errors: preCheck.errors },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Run fraud detection
      const fraudReport = await fraudDetectionService.analyzeClaim(
        -1, // Pre-submission, no claim ID yet
        claimantAddress,
        BigInt(amount),
      );

      // Notify the user
      notificationService.notifyClaimSubmitted(claimantAddress, -1);

      const response: ApiResponse<{
        preCheck: typeof preCheck;
        fraudReport: FraudReport;
      }> = {
        success: true,
        data: { preCheck, fraudReport },
        timestamp: new Date().toISOString(),
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/claims/:id
 * Get claim details from on-chain.
 */
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idParam = Array.isArray(req.params.id)
      ? req.params.id[0]
      : req.params.id;
    const claimId = parseInt(idParam, 10);
    if (isNaN(claimId)) {
      throw createHttpError(400, "Invalid claim ID");
    }

    const claim = await sorobanService.getClaim(claimId);
    if (!claim) {
      throw createHttpError(404, `Claim #${claimId} not found`);
    }

    // Serialize BigInt
    const serialized = {
      ...claim,
      amount: claim.amount.toString(),
    };

    const response: ApiResponse<typeof serialized> = {
      success: true,
      data: serialized,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/claims/:id/verify
 * Run verification on a claim — x402 payment gated.
 */
router.get(
  "/:id/verify",
  x402PaymentGate({
    amount: "0.001",
    asset: "USDC",
    description: "Claim verification report fee",
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idParam = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      const claimId = parseInt(idParam, 10);
      if (isNaN(claimId)) {
        throw createHttpError(400, "Invalid claim ID");
      }

      const report = await claimVerificationService.verifyClaim(claimId);

      const response: ApiResponse<VerificationReport> = {
        success: true,
        data: report,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/claims/:id/fraud-report
 * Run fraud analysis on a claim.
 */
router.get(
  "/:id/fraud-report",
  authMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idParam = Array.isArray(req.params.id)
        ? req.params.id[0]
        : req.params.id;
      const claimId = parseInt(idParam, 10);
      if (isNaN(claimId)) {
        throw createHttpError(400, "Invalid claim ID");
      }

      const claim = await sorobanService.getClaim(claimId);
      if (!claim) {
        throw createHttpError(404, `Claim #${claimId} not found`);
      }

      const report = await fraudDetectionService.analyzeClaim(
        claimId,
        claim.claimant,
        claim.amount,
      );

      const response: ApiResponse<FraudReport> = {
        success: true,
        data: report,
        timestamp: new Date().toISOString(),
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/claims/count
 * Get total claim count.
 */
router.get(
  "/stats/count",
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const count = await sorobanService.getClaimCount();
      res.json({
        success: true,
        data: { count },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
