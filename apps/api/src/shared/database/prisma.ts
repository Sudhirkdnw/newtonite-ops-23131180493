import { PrismaClient } from '@prisma/client';
import { logger } from '../logger/logger';

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ||
  new PrismaClient({
    log: [
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

// Hook into Prisma events for logging without leaking credentials or queries
// @ts-expect-error Prisma event typing
prisma.$on('error', (e: { message: string }) => {
  logger.error('[Prisma Error]', { error: e.message });
});

// @ts-expect-error Prisma event typing
prisma.$on('warn', (e: { message: string }) => {
  logger.warn('[Prisma Warning]', { warning: e.message });
});
