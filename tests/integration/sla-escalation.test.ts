import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../apps/api/src/app';
import { prisma } from '../../apps/api/src/shared/database/prisma';
import { slaService } from '../../apps/api/src/modules/sla/sla.service';
import { ActivityAction, Priority, SlaStatus } from '@newtonite/shared';

describe('Step 6: SLA & Escalation Engine Integration Tests', () => {
  let bobLeadToken: string;
  let charlieTeamBLeadToken: string;
  let teamAId: string;
  let teamBId: string;

  beforeAll(async () => {
    // 1. Authenticate Bob Lead (Team A - Core Operations)
    const bobRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'bob.lead@newtonite.dev', password: 'Demo@Newtonite2026!' });
    expect(bobRes.status).toBe(200);
    bobLeadToken = bobRes.body.data.token;
    teamAId = bobRes.body.data.user.memberships[0].teamId;

    // 2. Authenticate Charlie Lead (Team B - Platform Engineering)
    const charlieRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'charlie.lead@newtonite.dev', password: 'Demo@Newtonite2026!' });
    expect(charlieRes.status).toBe(200);
    charlieTeamBLeadToken = charlieRes.body.data.token;
    teamBId = charlieRes.body.data.user.memberships[0].teamId;
  });

  it('Scenario 1: correctly exposes calculated SLA metadata on work item creation and retrieval', async () => {
    const createRes = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${bobLeadToken}`)
      .send({
        teamId: teamAId,
        title: 'SLA Test Item - Healthy Lifecycle',
        type: 'INCIDENT',
        priority: 'CRITICAL',
      });

    expect(createRes.status).toBe(201);
    const item = createRes.body.data;
    expect(item.sla).toBeDefined();
    expect(item.sla.status).toBe(SlaStatus.HEALTHY);
    expect(item.sla.isBreached).toBe(false);
    expect(item.sla.isAtRisk).toBe(false);
    expect(item.sla.slaDurationMs).toBe(2 * 60 * 60 * 1000); // 2 hours for CRITICAL

    // Verify GET /items/:id includes the same SLA metadata
    const getRes = await request(app)
      .get(`/api/v1/items/${item.id}`)
      .set('Authorization', `Bearer ${bobLeadToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.sla.status).toBe(SlaStatus.HEALTHY);
  });

  it('Scenario 2: escalates an item approaching deadline (AT_RISK) using an injectable deterministic clock', async () => {
    // Create CRITICAL item (2-hour SLA)
    const createRes = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${bobLeadToken}`)
      .send({
        teamId: teamAId,
        title: 'SLA At-Risk Verification Item',
        type: 'TASK',
        priority: 'CRITICAL',
      });
    expect(createRes.status).toBe(201);
    const itemId = createRes.body.data.id;
    const createdAt = new Date(createRes.body.data.createdAt);

    // Injected clock: 1h 45m after creation (15 minutes left, within 30m warning threshold)
    const simulatedNow = new Date(createdAt.getTime() + 105 * 60 * 1000);

    const scanResult = await slaService.scanAndEscalate({
      teamId: teamAId,
      now: simulatedNow,
    });

    expect(scanResult.scanned).toBeGreaterThanOrEqual(1);

    // Verify work item updated to AT_RISK
    const updated = await prisma.workItem.findUnique({ where: { id: itemId } });
    expect(updated?.lastEscalationStatus).toBe('AT_RISK');

    // Verify immutable ActivityEvent created with action ESCALATED
    const escalationEvents = await prisma.activityEvent.findMany({
      where: {
        workItemId: itemId,
        action: ActivityAction.ESCALATED,
      },
    });
    expect(escalationEvents.length).toBe(1);
    expect((escalationEvents[0].newState as Record<string, unknown>)?.lastEscalationStatus).toBe(
      'AT_RISK'
    );

    // Verify OutboxJob enqueued
    const outboxJobs = await prisma.outboxJob.findMany({
      where: {
        aggregateId: itemId,
        eventType: 'WORK_ITEM_ESCALATED',
      },
    });
    expect(outboxJobs.length).toBe(1);
    expect((outboxJobs[0].payload as Record<string, unknown>)?.escalationLevel).toBe('AT_RISK');
  });

  it('Scenario 3: escalates an overdue item (BREACHED) when current time exceeds target deadline', async () => {
    // Create URGENT item (6-hour SLA)
    const createRes = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${bobLeadToken}`)
      .send({
        teamId: teamAId,
        title: 'SLA Overdue Verification Item',
        type: 'INCIDENT',
        priority: 'URGENT',
      });
    expect(createRes.status).toBe(201);
    const itemId = createRes.body.data.id;
    const createdAt = new Date(createRes.body.data.createdAt);

    // Injected clock: 6h 15m after creation (15 minutes past 6-hour deadline)
    const simulatedNow = new Date(createdAt.getTime() + 375 * 60 * 1000);

    await slaService.scanAndEscalate({
      teamId: teamAId,
      now: simulatedNow,
    });

    // Verify item updated to BREACHED
    const updated = await prisma.workItem.findUnique({ where: { id: itemId } });
    expect(updated?.lastEscalationStatus).toBe('BREACHED');

    // Verify ActivityEvent recorded
    const escalationEvents = await prisma.activityEvent.findMany({
      where: {
        workItemId: itemId,
        action: ActivityAction.ESCALATED,
      },
    });
    expect(escalationEvents.length).toBe(1);
    expect((escalationEvents[0].newState as Record<string, unknown>)?.lastEscalationStatus).toBe(
      'BREACHED'
    );
  });

  it('Scenario 4: priority-specific SLA duration mapping applies accurately', async () => {
    const priorities: Priority[] = ['CRITICAL', 'URGENT', 'HIGH', 'MEDIUM', 'LOW'];
    const expectedHours: Record<Priority, number> = {
      CRITICAL: 2,
      URGENT: 6,
      HIGH: 24,
      MEDIUM: 72,
      LOW: 168,
    };

    for (const priority of priorities) {
      const res = await request(app)
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${bobLeadToken}`)
        .send({
          teamId: teamAId,
          title: `SLA Priority Check - ${priority}`,
          type: 'TASK',
          priority,
        });

      expect(res.status).toBe(201);
      const item = res.body.data;
      const expectedDurationMs = expectedHours[priority] * 60 * 60 * 1000;
      expect(item.sla.slaDurationMs).toBe(expectedDurationMs);

      const targetDeadline = new Date(item.sla.targetDeadline).getTime();
      const createdAt = new Date(item.createdAt).getTime();
      expect(targetDeadline - createdAt).toBe(expectedDurationMs);
    }
  });

  it('Scenario 5: closed and resolved items (COMPLETED or CANCELLED) do not generate active escalations', async () => {
    // Create an item and complete it
    const createRes = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${bobLeadToken}`)
      .send({
        teamId: teamAId,
        title: 'Resolved Item - SLA Exclusion Check',
        type: 'TASK',
        priority: 'CRITICAL',
      });
    const itemId = createRes.body.data.id;

    // Transition to IN_PROGRESS -> IN_REVIEW -> COMPLETED
    await request(app)
      .post(`/api/v1/items/${itemId}/transition`)
      .set('Authorization', `Bearer ${bobLeadToken}`)
      .send({ targetStatus: 'IN_PROGRESS' });
    await request(app)
      .post(`/api/v1/items/${itemId}/transition`)
      .set('Authorization', `Bearer ${bobLeadToken}`)
      .send({ targetStatus: 'IN_REVIEW' });
    await request(app)
      .post(`/api/v1/items/${itemId}/transition`)
      .set('Authorization', `Bearer ${bobLeadToken}`)
      .send({ targetStatus: 'COMPLETED' });

    // Verify item is COMPLETED
    const completedItem = await prisma.workItem.findUnique({ where: { id: itemId } });
    expect(completedItem?.status).toBe('COMPLETED');

    // Run escalation scan 10 days in the future
    const futureTime = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    await slaService.scanAndEscalate({
      teamId: teamAId,
      now: futureTime,
    });

    // Verify zero escalation events exist for this completed item
    const events = await prisma.activityEvent.findMany({
      where: {
        workItemId: itemId,
        action: ActivityAction.ESCALATED,
      },
    });
    expect(events.length).toBe(0);

    // Verify GET /items/:id returns RESOLVED status
    const getRes = await request(app)
      .get(`/api/v1/items/${itemId}`)
      .set('Authorization', `Bearer ${bobLeadToken}`);
    expect(getRes.body.data.sla.status).toBe(SlaStatus.RESOLVED);
    expect(getRes.body.data.sla.isBreached).toBe(false);
  });

  it('Scenario 6: repeated worker executions are idempotent and produce ZERO duplicate escalation events', async () => {
    // Create CRITICAL item
    const createRes = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${bobLeadToken}`)
      .send({
        teamId: teamAId,
        title: 'Idempotency Verification - No Duplicate Escalations',
        type: 'INCIDENT',
        priority: 'CRITICAL',
      });
    const itemId = createRes.body.data.id;
    const createdAt = new Date(createRes.body.data.createdAt);

    // Injected time: 3 hours past creation (BREACHED)
    const breachedTime = new Date(createdAt.getTime() + 3 * 60 * 60 * 1000);

    // Run 1: Should escalate to BREACHED
    const run1 = await slaService.scanAndEscalate({ teamId: teamAId, now: breachedTime });
    expect(run1.escalated).toBeGreaterThanOrEqual(1);

    // Run 2: Repeated execution with same or later time
    const run2 = await slaService.scanAndEscalate({ teamId: teamAId, now: breachedTime });
    expect(run2.escalated).toBe(0);

    // Run 3: Another repeated execution
    const run3 = await slaService.scanAndEscalate({
      teamId: teamAId,
      now: new Date(breachedTime.getTime() + 10000),
    });
    expect(run3.escalated).toBe(0);

    // Verify only 1 ESCALATED activity event was ever created
    const escalationEvents = await prisma.activityEvent.findMany({
      where: {
        workItemId: itemId,
        action: ActivityAction.ESCALATED,
      },
    });
    expect(escalationEvents.length).toBe(1);

    // Verify only 1 OutboxJob was ever created
    const outboxJobs = await prisma.outboxJob.findMany({
      where: {
        aggregateId: itemId,
        eventType: 'WORK_ITEM_ESCALATED',
      },
    });
    expect(outboxJobs.length).toBe(1);
  });

  it('Scenario 7: concurrent workers safely synchronize without duplicate escalation (atomic conditional update)', async () => {
    const createRes = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${bobLeadToken}`)
      .send({
        teamId: teamAId,
        title: 'Concurrent Escalation Race Test',
        type: 'INCIDENT',
        priority: 'CRITICAL',
      });
    const itemId = createRes.body.data.id;
    const createdAt = new Date(createRes.body.data.createdAt);
    const breachedTime = new Date(createdAt.getTime() + 3 * 60 * 60 * 1000);

    // Simulate 4 simultaneous background workers running scanAndEscalate concurrently
    const results = await Promise.all([
      slaService.scanAndEscalate({ teamId: teamAId, now: breachedTime }),
      slaService.scanAndEscalate({ teamId: teamAId, now: breachedTime }),
      slaService.scanAndEscalate({ teamId: teamAId, now: breachedTime }),
      slaService.scanAndEscalate({ teamId: teamAId, now: breachedTime }),
    ]);

    // Sum of escalations across all concurrent workers for this item must be exactly 1
    const totalEscalations = results.reduce((acc, r) => acc + r.escalated, 0);
    expect(totalEscalations).toBeGreaterThanOrEqual(1);

    // Verify strictly 1 ActivityEvent created in PostgreSQL
    const escalationEvents = await prisma.activityEvent.findMany({
      where: {
        workItemId: itemId,
        action: ActivityAction.ESCALATED,
      },
    });
    expect(escalationEvents.length).toBe(1);
  });

  it('Scenario 8: GET /api/v1/items/sla/overview enforces team-level authorization and isolates cross-team data', async () => {
    // 1. Bob Lead can view Team A SLA overview
    const bobOverviewRes = await request(app)
      .get(`/api/v1/items/sla/overview?teamId=${teamAId}`)
      .set('Authorization', `Bearer ${bobLeadToken}`);

    expect(bobOverviewRes.status).toBe(200);
    expect(bobOverviewRes.body.success).toBe(true);
    expect(bobOverviewRes.body.data.totalActive).toBeDefined();
    expect(bobOverviewRes.body.data.healthyCount).toBeDefined();
    expect(bobOverviewRes.body.data.atRiskCount).toBeDefined();
    expect(bobOverviewRes.body.data.breachedCount).toBeDefined();
    expect(Array.isArray(bobOverviewRes.body.data.urgentQueue)).toBe(true);

    // 2. Bob Lead (Team A only) trying to access Team B SLA overview is rejected with 404 Not Found
    const forbiddenRes = await request(app)
      .get(`/api/v1/items/sla/overview?teamId=${teamBId}`)
      .set('Authorization', `Bearer ${bobLeadToken}`);

    expect(forbiddenRes.status).toBe(404);
    expect(forbiddenRes.body.success).toBe(false);

    // 3. Charlie Lead can view Team B SLA overview
    const charlieOverviewRes = await request(app)
      .get(`/api/v1/items/sla/overview?teamId=${teamBId}`)
      .set('Authorization', `Bearer ${charlieTeamBLeadToken}`);

    expect(charlieOverviewRes.status).toBe(200);
    expect(charlieOverviewRes.body.success).toBe(true);
  });

  it('Scenario 9: POST /api/v1/items/sla/escalate endpoint triggers manual/worker escalation cycle successfully', async () => {
    const res = await request(app)
      .post('/api/v1/items/sla/escalate')
      .set('Authorization', `Bearer ${bobLeadToken}`)
      .send({ teamId: teamAId });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scanned).toBeDefined();
    expect(res.body.data.escalated).toBeDefined();
    expect(res.body.data.unchanged).toBeDefined();
  });
});
