import { Request, Response, NextFunction } from 'express';
import pino from 'pino';
import { HTTP_STATUS } from '../utils/constants';

const logger = pino({ name: 'error-middleware' });

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errors?: unknown;

  constructor(message: string, statusCode: number, errors?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const notFound = (req: Request, res: Response): void => {
  res.status(HTTP_STATUS.NOT_FOUND).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Operational errors (thrown deliberately)
  if (err instanceof AppError) {
    const payload: Record<string, unknown> = {
      success: false,
      message: err.message,
    };
    if (err.errors) payload.errors = err.errors;
    res.status(err.statusCode).json(payload);
    return;
  }

  // PostgreSQL errors
  const pgErr = err as { code?: string; constraint?: string };
  if (pgErr.code === '23505') {
    const payload: Record<string, unknown> = {
      success: false,
      message: 'Duplicate entry: resource already exists',
    };
    if (pgErr.constraint) payload.constraint = pgErr.constraint;
    res.status(HTTP_STATUS.CONFLICT).json(payload);
    return;
  }

  if (pgErr.code === '23503') {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Referenced resource does not exist',
    });
    return;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: 'Invalid token',
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      message: 'Token expired',
    });
    return;
  }

  // Unknown errors — don't leak internals
  logger.error({ err, url: req.originalUrl, method: req.method }, 'Unhandled error');

  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
  });
};
