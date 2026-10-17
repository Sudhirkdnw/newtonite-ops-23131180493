import { Router, type Request, type Response } from 'express';
import { prisma } from '../../shared/database/prisma';
import { sendSuccess, sendError } from '../../shared/http/response';
import type { HealthCheckResponse, ReadinessCheckResponse } from '@newtonite/shared';

export const healthRouter = Router();

// GET /health - Liveness probe
healthRouter.get('/health', (_req: Request, res: Response) => {
  const payload: HealthCheckResponse = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '0.1.0',
  };

  return sendSuccess(res, payload, 200);
});

// GET /ready - Readiness probe (checks PostgreSQL connectivity)
healthRouter.get('/ready', async (_req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;

    const payload: ReadinessCheckResponse = {
      status: 'ready',
      database: 'connected',
      latencyMs,
      timestamp: new Date().toISOString(),
    };

    return sendSuccess(res, payload, 200);
  } catch (error) {
    const payload: ReadinessCheckResponse = {
      status: 'unhealthy',
      database: 'disconnected',
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Database connection check failed',
    };

    return sendError(res, 'Database connection is unavailable', 503, 'DATABASE_UNAVAILABLE', [
      { message: payload.error || 'Connection failed' },
    ]);
  }
});
