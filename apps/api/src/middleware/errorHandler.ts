import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '../shared/errors/AppError';
import { sendError } from '../shared/http/response';
import { logger } from '../shared/logger/logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Operational AppError instances
  if (err instanceof AppError) {
    logger.warn(`[AppError] ${err.message}`, {
      requestId: req.id,
      errorCode: err.errorCode,
      statusCode: err.statusCode,
      details: err.details,
    });
    sendError(res, err.message, err.statusCode, err.errorCode, err.details);
    return;
  }

  // 2. Zod Schema Validation Errors
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
      code: e.code,
    }));
    logger.warn(`[ZodValidationError] Request validation failed`, {
      requestId: req.id,
      details,
    });
    sendError(res, 'Validation error', 422, 'VALIDATION_ERROR', details);
    return;
  }

  // 3. Prisma Known Request Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'field';
      logger.warn(`[Prisma Unique Constraint Violation] P2002 on ${target}`, { requestId: req.id });
      sendError(
        res,
        `A record with this ${target} already exists`,
        409,
        'UNIQUE_CONSTRAINT_VIOLATION'
      );
      return;
    }

    if (err.code === 'P2025') {
      logger.warn(`[Prisma Record Not Found] P2025`, { requestId: req.id });
      sendError(res, 'Record not found or already deleted', 404, 'RECORD_NOT_FOUND');
      return;
    }
  }

  // 4. JSON Syntax Parsing Error
  if (err instanceof SyntaxError && 'status' in err && (err as { status: number }).status === 400) {
    logger.warn(`[Malformed JSON Payload] ${err.message}`, { requestId: req.id });
    sendError(res, 'Malformed JSON payload in request body', 400, 'MALFORMED_JSON');
    return;
  }

  // 5. Unhandled / Unexpected Server Errors
  logger.error(`[UnhandledServerError] ${err.message}`, {
    requestId: req.id,
    stack: isProduction ? undefined : err.stack,
    errorName: err.name,
  });

  const message = isProduction ? 'An unexpected internal error occurred' : err.message;
  sendError(res, message, 500, 'INTERNAL_SERVER_ERROR');
}
