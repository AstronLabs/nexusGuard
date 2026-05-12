import { Request, Response, NextFunction } from 'express';
import { isValidStellarAddress } from '../utils/stellar';
import { createHttpError } from './error.middleware';
import { logger } from '../utils/logger';

/**
 * Stellar wallet authentication middleware.
 * 
 * Validates the `x-stellar-address` header to identify the caller.
 * In a production environment, this would verify a signed challenge to prove
 * ownership of the address. For MVP, we validate the address format.
 * 
 * The verified address is attached to `req.stellarAddress`.
 */

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      stellarAddress?: string;
    }
  }
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const address = req.headers['x-stellar-address'] as string | undefined;

  if (!address) {
    return next(createHttpError(401, 'Missing x-stellar-address header'));
  }

  if (!isValidStellarAddress(address)) {
    return next(createHttpError(401, 'Invalid Stellar address format'));
  }

  req.stellarAddress = address;
  logger.debug('Auth', `Authenticated request from ${address.slice(0, 8)}...`);
  next();
}

/**
 * Optional auth — attaches address if present but doesn't reject if missing.
 */
export function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const address = req.headers['x-stellar-address'] as string | undefined;

  if (address && isValidStellarAddress(address)) {
    req.stellarAddress = address;
  }

  next();
}
