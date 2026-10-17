import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../shared/database/prisma';
import { outboxService } from './outbox.service';
import { OutboxWorker } from './outbox.worker';
import { OutboxJobStatus } from '@prisma/client';

describe('Critical Behaviour 6: Transactional Outbox Pattern & Reliable Processing', () => {
  let worker: OutboxWorker;

  beforeAll(async () => {
    worker = new OutboxWorker();
    await prisma.outboxJob.deleteMany();
  });

  afterAll(async () => {
    worker.stop();
    await prisma.outboxJob.deleteMany();
    await prisma.$disconnect();
  });

  it('guarantees transactional atomicity between business change and outbox job', async () => {
    const testTitle = `Outbox Atomicity ${Date.now()}`;
    let createdItemId = '';

    // 1. Transaction succeeds: both WorkItem and OutboxJob are persisted
    await prisma.$transaction(async (tx) => {
      const team = await tx.team.findFirstOrThrow();
      const user = await tx.user.findFirstOrThrow();

      const item = await tx.workItem.create({
        data: {
          title: testTitle,
          type: 'INCIDENT',
          status: 'BACKLOG',
          teamId: team.id,
          creatorId: user.id,
        },
      });
      createdItemId = item.id;

      await outboxService.scheduleJob(tx, {
        aggregateType: 'WORK_ITEM',
        aggregateId: item.id,
        eventType: 'WORK_ITEM_CREATED',
        payload: { itemId: item.id, title: item.title },
      });
    });

    const persistedItem = await prisma.workItem.findUnique({ where: { id: createdItemId } });
    const persistedJobs = await outboxService.getJobsByAggregate('WORK_ITEM', createdItemId);

    expect(persistedItem).not.toBeNull();
    expect(persistedJobs.length).toBe(1);
    expect(persistedJobs[0].status).toBe(OutboxJobStatus.PENDING);
    expect(persistedJobs[0].eventType).toBe('WORK_ITEM_CREATED');

    // 2. Transaction fails / rolls back: neither WorkItem nor OutboxJob is persisted
    const rollbackTitle = `Outbox Rollback ${Date.now()}`;
    try {
      await prisma.$transaction(async (tx) => {
        const team = await tx.team.findFirstOrThrow();
        const user = await tx.user.findFirstOrThrow();

        const item = await tx.workItem.create({
          data: {
            title: rollbackTitle,
            type: 'INCIDENT',
            status: 'BACKLOG',
            teamId: team.id,
            creatorId: user.id,
          },
        });

        await outboxService.scheduleJob(tx, {
          aggregateType: 'WORK_ITEM',
          aggregateId: item.id,
          eventType: 'WORK_ITEM_CREATED',
          payload: { itemId: item.id },
        });

        throw new Error('Simulated business error forcing rollback');
      });
    } catch (err: unknown) {
      expect((err as Error).message).toContain('Simulated business error');
    }

    const abortedItem = await prisma.workItem.findFirst({ where: { title: rollbackTitle } });
    expect(abortedItem).toBeNull();
  });

  it('safely claims and processes pending outbox jobs with handler execution', async () => {
    let handlerInvoked = false;
    let handledPayload: Record<string, unknown> | null = null;

    const testEvent = `CUSTOM_TEST_EVENT_${Date.now()}`;
    worker.registerHandler(testEvent, async (job) => {
      handlerInvoked = true;
      handledPayload = job.payload as Record<string, unknown>;
    });

    // Schedule job
    let jobId = '';
    await prisma.$transaction(async (tx) => {
      jobId = await outboxService.scheduleJob(tx, {
        aggregateType: 'TEST',
        aggregateId: 'test-123',
        eventType: testEvent,
        payload: { message: 'hello outbox', secret: 42 },
      });
    });

    // Run one worker batch
    const result = await worker.processBatch(10);
    expect(result.processed).toBeGreaterThanOrEqual(1);
    expect(handlerInvoked).toBe(true);
    expect((handledPayload as unknown as Record<string, unknown>)?.message).toBe('hello outbox');

    // Verify job in DB is COMPLETED with processedAt timestamp
    const processedJob = await prisma.outboxJob.findUnique({ where: { id: jobId } });
    expect(processedJob?.status).toBe(OutboxJobStatus.COMPLETED);
    expect(processedJob?.processedAt).not.toBeNull();
    expect(processedJob?.attempts).toBe(1);

    // Running processBatch again does NOT re-process completed job
    handlerInvoked = false;
    await worker.processBatch(10);
    expect(handlerInvoked).toBe(false);
  });

  it('retries transient failures with exponential backoff and tracks attempts', async () => {
    const transientEvent = `TRANSIENT_EVENT_${Date.now()}`;
    worker.registerHandler(transientEvent, async () => {
      throw new Error('Network gateway timeout');
    });

    let jobId = '';
    await prisma.$transaction(async (tx) => {
      jobId = await outboxService.scheduleJob(tx, {
        aggregateType: 'TEST',
        aggregateId: 'test-transient',
        eventType: transientEvent,
        payload: { retry: true },
        maxAttempts: 3,
      });
    });

    // Attempt 1 fails
    await worker.processBatch(10);

    const jobAfterAttempt1 = await prisma.outboxJob.findUnique({ where: { id: jobId } });
    expect(jobAfterAttempt1?.status).toBe(OutboxJobStatus.PENDING);
    expect(jobAfterAttempt1?.attempts).toBe(1);
    expect(jobAfterAttempt1?.lastError).toContain('Network gateway timeout');
    expect(jobAfterAttempt1?.nextRetryAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('marks job as FAILED when max retry attempts are exhausted', async () => {
    const exhaustedEvent = `EXHAUSTED_EVENT_${Date.now()}`;
    worker.registerHandler(exhaustedEvent, async () => {
      throw new Error('Permanent downstream rejection');
    });

    let jobId = '';
    await prisma.$transaction(async (tx) => {
      jobId = await outboxService.scheduleJob(tx, {
        aggregateType: 'TEST',
        aggregateId: 'test-exhausted',
        eventType: exhaustedEvent,
        payload: { fatal: true },
        maxAttempts: 1, // Only 1 attempt allowed
      });
    });

    // Attempt 1 fails and exhausts maxAttempts (1 >= 1)
    await worker.processBatch(10);

    const terminalJob = await prisma.outboxJob.findUnique({ where: { id: jobId } });
    expect(terminalJob?.status).toBe(OutboxJobStatus.FAILED);
    expect(terminalJob?.attempts).toBe(1);
    expect(terminalJob?.lastError).toContain('Permanent downstream rejection');
  });
});
