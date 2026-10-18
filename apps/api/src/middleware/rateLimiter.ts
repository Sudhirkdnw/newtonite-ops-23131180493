import { type Request, type Response, type NextFunction } from 'express';
import { AppError } from '../shared/errors/AppError';

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  message?: string;
  errorCode?: string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (req: Request) => req.ip || req.socket.remoteAddress || 'unknown-client',
    message = 'Too many requests. Please wait before retrying.',
    errorCode = 'TOO_MANY_REQUESTS',
  } = options;

  const requestLog = new Map<string, number[]>();

  const middleware = (req: Request, _res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();

    const existingTimestamps = requestLog.get(key) || [];
    const validTimestamps = existingTimestamps.filter((t) => now - t < windowMs);

    if (validTimestamps.length >= maxRequests) {
      return next(new AppError(message, 429, errorCode));
    }

    validTimestamps.push(now);
    requestLog.set(key, validTimestamps);
    next();
  };

  middleware.reset = () => {
    requestLog.clear();
  };

  return middleware;
}
