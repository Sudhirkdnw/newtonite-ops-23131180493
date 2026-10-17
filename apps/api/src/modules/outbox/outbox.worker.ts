import { OutboxJobStatus, type OutboxJob } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';
import { logger } from '../../shared/logger/logger';

export type JobHandler = (job: OutboxJob) => Promise<void>;

export class OutboxWorker {
  private handlers = new Map<string, JobHandler>();
  private isRunning = false;
  private timer: NodeJS.Timeout | null = null;
  private readonly defaultStaleThresholdMs = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.registerDefaultHandlers();
  }

  /**
   * Register a custom handler for a given event type
   */
  registerHandler(eventType: string, handler: JobHandler) {
    this.handlers.set(eventType, handler);
  }

  /**
   * Register built-in simulated handlers for core operations events
   */
  private registerDefaultHandlers() {
    const defaultLogHandler = async (job: OutboxJob) => {
      logger.info(`[OutboxWorker] Successfully dispatched event: ${job.eventType}`, {
        jobId: job.id,
        aggregateType: job.aggregateType,
        aggregateId: job.aggregateId,
      });
    };

    this.handlers.set('WORK_ITEM_CREATED', defaultLogHandler);
    this.handlers.set('WORK_ITEM_CLAIMED', defaultLogHandler);
    this.handlers.set('WORK_ITEM_UPDATED', defaultLogHandler);
    this.handlers.set('WORK_ITEM_STATUS_CHANGED', defaultLogHandler);
    this.handlers.set('WORK_ITEM_ESCALATED', defaultLogHandler);
  }

  /**
   * Process a batch of pending or retryable jobs safely.
   * Returns summary of processed jobs.
   */
  async processBatch(
    batchSize = 10
  ): Promise<{ processed: number; succeeded: number; failed: number }> {
    const now = new Date();
    const staleThreshold = new Date(now.getTime() - this.defaultStaleThresholdMs);

    // 1. Find candidate jobs:
    // - PENDING jobs whose nextRetryAt has arrived
    // - PROCESSING jobs older than 5 minutes (crashed worker recovery)
    const candidates = await prisma.outboxJob.findMany({
      where: {
        OR: [
          {
            status: OutboxJobStatus.PENDING,
            nextRetryAt: { lte: now },
          },
          {
            status: OutboxJobStatus.PROCESSING,
            updatedAt: { lte: staleThreshold },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });

    let succeeded = 0;
    let failed = 0;

    for (const candidate of candidates) {
      // 2. Atomically claim the job using conditional update
      const claimResult = await prisma.outboxJob.updateMany({
        where: {
          id: candidate.id,
          status: candidate.status,
          attempts: candidate.attempts,
        },
        data: {
          status: OutboxJobStatus.PROCESSING,
          attempts: { increment: 1 },
          updatedAt: now,
        },
      });

      // If another worker claimed or state changed, skip to next
      if (claimResult.count === 0) {
        continue;
      }

      const claimedJob = await prisma.outboxJob.findUnique({
        where: { id: candidate.id },
      });

      if (!claimedJob) continue;

      const handler = this.handlers.get(claimedJob.eventType) || this.handlers.get('*');

      try {
        if (handler) {
          await handler(claimedJob);
        } else {
          logger.warn(`[OutboxWorker] No handler registered for event: ${claimedJob.eventType}`);
        }

        // 3. Mark job as COMPLETED
        await prisma.outboxJob.update({
          where: { id: claimedJob.id },
          data: {
            status: OutboxJobStatus.COMPLETED,
            processedAt: new Date(),
            lastError: null,
          },
        });
        succeeded++;
      } catch (err) {
        failed++;
        const errorMessage = err instanceof Error ? err.message : String(err);
        const currentAttempts = claimedJob.attempts; // already incremented by atomic claim

        if (currentAttempts >= claimedJob.maxAttempts) {
          // Terminal failure: exhausted all retry attempts
          logger.error(
            `[OutboxWorker] Job ${claimedJob.id} failed permanently after ${currentAttempts} attempts: ${errorMessage}`
          );
          await prisma.outboxJob.update({
            where: { id: claimedJob.id },
            data: {
              status: OutboxJobStatus.FAILED,
              lastError: errorMessage,
            },
          });
        } else {
          // Exponential backoff retry: 1s, 2s, 4s, 8s, up to max 60s
          const backoffMs = Math.min(1000 * Math.pow(2, currentAttempts), 60000);
          const nextRetryAt = new Date(Date.now() + backoffMs);

          logger.warn(
            `[OutboxWorker] Job ${claimedJob.id} failed (attempt ${currentAttempts}/${claimedJob.maxAttempts}). Retrying at ${nextRetryAt.toISOString()}: ${errorMessage}`
          );
          await prisma.outboxJob.update({
            where: { id: claimedJob.id },
            data: {
              status: OutboxJobStatus.PENDING,
              nextRetryAt,
              lastError: errorMessage,
            },
          });
        }
      }
    }

    return { processed: candidates.length, succeeded, failed };
  }

  /**
   * Start periodic worker polling loop
   */
  start(intervalMs = 3000) {
    if (this.isRunning) return;
    this.isRunning = true;

    const poll = async () => {
      if (!this.isRunning) return;
      try {
        await this.processBatch();
      } catch (err) {
        logger.error('[OutboxWorker] Polling error in outbox worker', { err });
      } finally {
        if (this.isRunning) {
          this.timer = setTimeout(() => void poll(), intervalMs);
        }
      }
    };

    void poll();
  }

  /**
   * Stop background worker cleanly
   */
  stop() {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

export const outboxWorker = new OutboxWorker();
