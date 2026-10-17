import type { Request, Response, NextFunction } from 'express';
import { logger } from '../shared/logger/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Capture request completion
  res.on('finish', () => {
    const durationMs = req.startTime ? Date.now() - req.startTime : undefined;
    const metadata = {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    };

    if (res.statusCode >= 500) {
      logger.error(`HTTP ${req.method} ${req.originalUrl || req.url} ${res.statusCode}`, metadata);
    } else if (res.statusCode >= 400) {
      logger.warn(`HTTP ${req.method} ${req.originalUrl || req.url} ${res.statusCode}`, metadata);
    } else {
      logger.info(`HTTP ${req.method} ${req.originalUrl || req.url} ${res.statusCode}`, metadata);
    }
  });

  next();
}
