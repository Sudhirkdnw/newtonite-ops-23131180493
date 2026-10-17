import http from 'http';
import { app } from './app';
import { env } from './config/env';
import { logger } from './shared/logger/logger';
import { prisma } from './shared/database/prisma';

const server = http.createServer(app);

let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  // 1. Stop accepting new HTTP requests with a 10s drain window
  const shutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out after 10s. Forcing exit.');
    process.exit(1);
  }, 10000);

  server.close(async (err) => {
    if (err) {
      logger.error('Error while closing HTTP server', { error: err.message });
    } else {
      logger.info('HTTP server closed successfully.');
    }

    // 2. Disconnect database client
    try {
      await prisma.$disconnect();
      logger.info('Database connection pool disconnected.');
    } catch (dbErr) {
      logger.error('Error disconnecting database', {
        error: dbErr instanceof Error ? dbErr.message : String(dbErr),
      });
    }

    clearTimeout(shutdownTimeout);
    logger.info('Graceful shutdown completed.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
  void gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

server.listen(env.PORT, env.HOST, () => {
  logger.info(`Newtonite Operations API running on http://${env.HOST}:${env.PORT}`, {
    environment: env.NODE_ENV,
    apiPrefix: env.API_PREFIX,
    port: env.PORT,
  });
});
