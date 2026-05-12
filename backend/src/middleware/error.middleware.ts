import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ApiError } from '../types';

/**
 * Global error handling middleware.
 * Catches thrown errors and returns a structured JSON response.
 */
export function errorHandler(
  err: Error & { statusCode?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  logger.error('ErrorHandler', message, {
    statusCode,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });

  const errorResponse: ApiError = {
    error: statusCode === 500 ? 'InternalServerError' : 'RequestError',
    message,
    statusCode,
  };

  res.status(statusCode).json(errorResponse);
}

/**
 * Create an HTTP error with a status code.
 */
export function createHttpError(statusCode: number, message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}
