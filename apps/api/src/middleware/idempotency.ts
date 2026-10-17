import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { prisma } from '../shared/database/prisma';
import { ConflictError, BadRequestError } from '../shared/errors/AppError';
import { logger } from '../shared/logger/logger';
import type { Prisma } from '@prisma/client';

export const IDEMPOTENCY_HEADER = 'idempotency-key';

/**
 * Computes a deterministic SHA-256 fingerprint for the request
 */
function computeRequestHash(req: Request): string {
  const normalizedPayload = {
    method: req.method.toUpperCase(),
    path: req.originalUrl ? req.originalUrl.split('?')[0] : req.path,
    body: req.body ?? {},
    userId: (req as Request & { user?: { id: string } }).user?.id || 'anonymous',
  };

  return crypto.createHash('sha256').update(JSON.stringify(normalizedPayload)).digest('hex');
}

/**
 * Idempotency Middleware for mutation endpoints (e.g. POST, PATCH)
 */
export async function idempotencyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const rawKey = req.headers[IDEMPOTENCY_HEADER];

  // If no idempotency key was supplied, proceed normally
  if (!rawKey || typeof rawKey !== 'string') {
    return next();
  }

  const key = rawKey.trim();
  if (key.length === 0 || key.length > 255) {
    return next(new BadRequestError('Idempotency-Key must be between 1 and 255 characters'));
  }

  const requestHash = computeRequestHash(req);
  const userId = (req as Request & { user?: { id: string } }).user?.id;

  try {
    // 1. Look up existing idempotency record
    let record = await prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (record) {
      // 2. Validate payload fingerprint
      if (record.requestHash !== requestHash) {
        throw new ConflictError(
          'Idempotency key was previously used with a different request payload or endpoint',
          { key, previousMethod: record.requestMethod, previousPath: record.requestPath }
        );
      }

      // 3. If already resolved, replay cached response
      if (record.status === 'RESOLVED' && record.responseBody !== null) {
        logger.info(`[Idempotency] Cache HIT for key: ${key}`, {
          requestId: req.headers['x-request-id'],
          key,
        });

        res.set('X-Cache-Lookup', 'HIT');
        res.set(IDEMPOTENCY_HEADER, key);
        res.status(record.statusCode || 200).json(record.responseBody);
        return;
      }

      // 4. If currently processing, reject concurrent duplicate to avoid race conditions
      if (record.status === 'PROCESSING') {
        throw new ConflictError(
          'A request with this idempotency key is currently in progress. Please retry shortly.',
          { key }
        );
      }
    }

    // 5. If not found, attempt atomic insert with status PROCESSING
    if (!record) {
      try {
        record = await prisma.idempotencyKey.create({
          data: {
            key,
            userId: userId || null,
            requestMethod: req.method.toUpperCase(),
            requestPath: req.originalUrl ? req.originalUrl.split('?')[0] : req.path,
            requestHash,
            status: 'PROCESSING',
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24-hour TTL
          },
        });
      } catch (err: unknown) {
        // Handle concurrent race where two identical requests insert at exact same instant
        if (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: string }).code === 'P2002'
        ) {
          throw new ConflictError(
            'A request with this idempotency key is currently in progress. Please retry shortly.',
            { key }
          );
        }
        throw err;
      }
    }

    // 6. Intercept response to persist on success or clean up on failure
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown): Response {
      res.json = originalJson; // restore original

      // Persist asynchronously in background so response is not delayed
      if (res.statusCode < 400) {
        prisma.idempotencyKey
          .update({
            where: { key },
            data: {
              status: 'RESOLVED',
              statusCode: res.statusCode,
              responseBody: body as Prisma.InputJsonValue,
            },
          })
          .catch((err) => {
            logger.error(`[Idempotency] Failed to resolve key ${key}`, { err });
          });
      } else {
        // If operation failed, remove key so user can safely retry without 409
        prisma.idempotencyKey
          .delete({
            where: { key },
          })
          .catch(() => {});
      }

      return originalJson(body);
    };

    next();
  } catch (err) {
    next(err);
  }
}
