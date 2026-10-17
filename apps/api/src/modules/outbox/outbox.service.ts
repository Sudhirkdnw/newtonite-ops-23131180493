import type { Prisma } from '@prisma/client';
import { OutboxJobStatus } from '@prisma/client';
import { prisma } from '../../shared/database/prisma';

export interface ScheduleOutboxJobInput {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  maxAttempts?: number;
}

export class OutboxService {
  /**
   * Schedule an outbox job atomically inside an existing database transaction.
   * This guarantees that the business event and the outbox job commit together or fail together.
   */
  async scheduleJob(tx: Prisma.TransactionClient, input: ScheduleOutboxJobInput): Promise<string> {
    const job = await tx.outboxJob.create({
      data: {
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        eventType: input.eventType,
        payload: input.payload as Prisma.InputJsonValue,
        status: OutboxJobStatus.PENDING,
        maxAttempts: input.maxAttempts ?? 5,
        nextRetryAt: new Date(),
      },
    });

    return job.id;
  }

  /**
   * Query outbox jobs for auditing or diagnostics
   */
  async getJobById(jobId: string) {
    return prisma.outboxJob.findUnique({
      where: { id: jobId },
    });
  }

  /**
   * List jobs for a specific aggregate
   */
  async getJobsByAggregate(aggregateType: string, aggregateId: string) {
    return prisma.outboxJob.findMany({
      where: { aggregateType, aggregateId },
      orderBy: { createdAt: 'asc' },
    });
  }
}

export const outboxService = new OutboxService();
