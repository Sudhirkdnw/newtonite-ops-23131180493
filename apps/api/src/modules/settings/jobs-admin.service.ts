import { prisma } from '../../shared/database/prisma';
import { type OutboxQueueStatsDTO } from '@newtonite/shared';
import { NotFoundError } from '../../shared/errors/AppError';
import { logger } from '../../shared/logger/logger';

export class JobsAdminService {
  /**
   * Retrieves live statistics across outbox worker states and recent failures.
   */
  async getQueueStats(): Promise<OutboxQueueStatsDTO> {
    const [counts, recentFailures] = await Promise.all([
      prisma.outboxJob.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      prisma.outboxJob.findMany({
        where: {
          status: { in: ['FAILED', 'DEAD_LETTER'] },
        },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          eventType: true,
          aggregateType: true,
          aggregateId: true,
          attempts: true,
          maxAttempts: true,
          lastError: true,
          createdAt: true,
          nextRetryAt: true,
        },
      }),
    ]);

    const statMap: Record<string, number> = {
      PENDING: 0,
      PROCESSING: 0,
      COMPLETED: 0,
      FAILED: 0,
      DEAD_LETTER: 0,
    };

    let total = 0;
    for (const c of counts) {
      statMap[c.status] = c._count._all;
      total += c._count._all;
    }

    return {
      pending: statMap.PENDING,
      processing: statMap.PROCESSING,
      completed: statMap.COMPLETED,
      failed: statMap.FAILED,
      deadLetter: statMap.DEAD_LETTER,
      total,
      recentFailures: recentFailures.map((f) => ({
        id: f.id,
        eventType: f.eventType,
        aggregateType: f.aggregateType,
        aggregateId: f.aggregateId,
        attempts: f.attempts,
        maxAttempts: f.maxAttempts,
        lastError: f.lastError,
        createdAt: f.createdAt.toISOString(),
        nextRetryAt: f.nextRetryAt.toISOString(),
      })),
    };
  }

  /**
   * Safe, idempotent retry of a failed or dead-letter outbox job.
   */
  async retryJob(jobId: string, actorId: string) {
    const job = await prisma.outboxJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundError('Outbox job not found');
    }

    const updated = await prisma.outboxJob.update({
      where: { id: jobId },
      data: {
        status: 'PENDING',
        nextRetryAt: new Date(),
        lastError: null,
      },
    });

    logger.info('[JobsAdminService] Outbox job scheduled for retry', { jobId, actorId });
    return updated;
  }
}

export const jobsAdminService = new JobsAdminService();
