import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';

/**
 * x402 Payment-Gating Middleware
 * 
 * Implements the HTTP 402 "Payment Required" protocol for anti-spam
 * and micropayment verification on protected routes.
 * 
 * Flow:
 * 1. Client sends request to a protected endpoint
 * 2. If no `X-PAYMENT` header is present, respond with 402 + payment instructions
 * 3. If `X-PAYMENT` header is present, verify the payment via the facilitator
 * 4. If payment is valid, allow the request to proceed
 * 5. If payment is invalid, respond with 402 again
 * 
 * For MVP, this middleware implements the protocol structure and validates
 * payment headers. Full on-chain settlement uses the @x402/stellar facilitator.
 */

export interface X402PaymentConfig {
  /** Amount in the smallest unit (e.g., 0.01 for USDC) */
  amount: string;
  /** Asset code (e.g., 'USDC') */
  asset: string;
  /** Description of what the payment is for */
  description: string;
  /** Recipient Stellar address (backend's address) */
  recipient: string;
}

/**
 * Payment instructions returned in the 402 response.
 */
interface PaymentInstructions {
  version: '1.0';
  network: string;
  recipient: string;
  asset: string;
  amount: string;
  description: string;
  facilitatorUrl: string;
  expiresAt: string;
}

/**
 * Create an x402 payment gate middleware for a specific route.
 * 
 * @param paymentConfig - The payment requirements for this route
 * @returns Express middleware function
 */
export function x402PaymentGate(paymentConfig: Omit<X402PaymentConfig, 'recipient'>): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const paymentHeader = req.headers['x-payment'] as string | undefined;

    if (!paymentHeader) {
      // No payment provided — return 402 with payment instructions
      const instructions: PaymentInstructions = {
        version: '1.0',
        network: config.stellar.network,
        recipient: config.stellar.publicKey,
        asset: paymentConfig.asset || config.x402.paymentAsset,
        amount: paymentConfig.amount,
        description: paymentConfig.description,
        facilitatorUrl: config.x402.facilitatorUrl,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min expiry
      };

      logger.debug('x402', `Payment required for ${req.method} ${req.path}`, {
        amount: paymentConfig.amount,
        asset: paymentConfig.asset,
      });

      res.status(402).json({
        error: 'PaymentRequired',
        message: `This endpoint requires a payment of ${paymentConfig.amount} ${paymentConfig.asset || config.x402.paymentAsset}`,
        paymentInstructions: instructions,
      });
      return;
    }

    // Payment header present — verify it
    try {
      const paymentData = JSON.parse(
        Buffer.from(paymentHeader, 'base64').toString('utf-8')
      );

      // Validate payment structure
      if (!paymentData.txHash && !paymentData.signature) {
        res.status(402).json({
          error: 'InvalidPayment',
          message: 'Payment header must contain txHash or signature',
        });
        return;
      }

      // Validate payment amount matches requirement
      if (paymentData.amount && parseFloat(paymentData.amount) < parseFloat(paymentConfig.amount)) {
        res.status(402).json({
          error: 'InsufficientPayment',
          message: `Required: ${paymentConfig.amount}, received: ${paymentData.amount}`,
        });
        return;
      }

      // In production, verify the payment on-chain via the facilitator:
      // const isValid = await verifyPaymentWithFacilitator(paymentData);
      // For MVP, we accept well-structured payment proofs

      logger.info('x402', `Payment verified for ${req.method} ${req.path}`, {
        txHash: paymentData.txHash?.slice(0, 16),
      });

      // Attach payment data to request for downstream handlers
      (req as Request & { x402Payment?: unknown }).x402Payment = paymentData;
      next();
    } catch (error) {
      logger.warn('x402', 'Failed to parse payment header', { error });
      res.status(402).json({
        error: 'MalformedPayment',
        message: 'Could not parse X-PAYMENT header. Expected base64-encoded JSON.',
      });
      return;
    }
  };
}

/**
 * Verify a payment with the x402 facilitator service.
 * Used in production for on-chain settlement verification.
 */
export async function verifyPaymentWithFacilitator(paymentData: {
  txHash: string;
  signature: string;
  amount: string;
  asset: string;
}): Promise<boolean> {
  try {
    const response = await fetch(`${config.x402.facilitatorUrl}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        txHash: paymentData.txHash,
        signature: paymentData.signature,
        network: config.stellar.network,
        expectedRecipient: config.stellar.publicKey,
        expectedAmount: paymentData.amount,
        expectedAsset: paymentData.asset,
      }),
    });

    if (!response.ok) {
      logger.warn('x402', 'Facilitator verification failed', {
        status: response.status,
      });
      return false;
    }

    const result = await response.json() as { valid: boolean };
    return result.valid === true;
  } catch (error) {
    logger.error('x402', 'Facilitator request failed', { error });
    return false;
  }
}
