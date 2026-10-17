import express, { type Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { requestIdMiddleware } from './middleware/requestId';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { healthRouter } from './modules/health/health.router';
import { NotFoundError } from './shared/errors/AppError';

export function createApp(): Application {
  const app = express();

  // 1. Trust proxy for reverse proxies / Docker environments
  app.set('trust proxy', 1);

  // 2. Security HTTP headers
  app.use(helmet());

  // 3. Configurable CORS policy
  const allowedOrigins = env.CORS_ORIGIN.split(',').map((origin) => origin.trim());
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`Origin '${origin}' not permitted by CORS policy`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Request-Id',
        'Idempotency-Key',
        'If-Match',
      ],
      exposedHeaders: ['X-Request-Id', 'ETag'],
    })
  );

  // 4. Request Correlation & Timing
  app.use(requestIdMiddleware);

  // 5. Body Parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 6. Request Logging
  app.use(requestLogger);

  // 7. Base Health & Readiness Probes (Root level for load balancers / k8s / docker)
  app.use('/', healthRouter);

  // 8. API Version Prefix Router (/api/v1)
  const apiRouter = express.Router();
  apiRouter.use('/', healthRouter);

  // Mount API router
  app.use(env.API_PREFIX, apiRouter);

  // 9. Catch-all 404 handler
  app.use((req, _res, next) => {
    next(new NotFoundError(`Endpoint ${req.method} ${req.originalUrl} not found`));
  });

  // 10. Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
