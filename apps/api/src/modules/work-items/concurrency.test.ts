import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { prisma } from '../../shared/database/prisma';
import type { Application } from 'express';

describe('Critical Behaviour 1 & 2: Concurrency & Optimistic Locking', () => {
  let app: Application;
  let memberToken1: string;
  let memberToken2: string;
  let teamId: string;

  beforeAll(async () => {
    app = createApp();

    // 1. Login Evan Member (Core Ops)
    const res1 = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'evan.member@newtonite.dev', password: 'Demo@Newtonite2026!' });
    expect(res1.status).toBe(200);
    memberToken1 = res1.body.data.token;
    teamId = res1.body.data.user.memberships[0].teamId;

    // 2. Login Bob Lead (Core Ops)
    const res2 = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'bob.lead@newtonite.dev', password: 'Demo@Newtonite2026!' });
    expect(res2.status).toBe(200);
    memberToken2 = res2.body.data.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('Concurrent Work-Item Claiming', () => {
    it('allows only one winner when two users concurrently claim the same unassigned item', async () => {
      // 1. Create a fresh unassigned work item
      const createRes = await request(app)
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${memberToken1}`)
        .send({
          teamId,
          title: `Concurrent Claim Test Item ${Date.now()}`,
          description: 'Testing atomic conditional claim under race condition',
          type: 'INCIDENT',
          priority: 'HIGH',
        });

      expect(createRes.status).toBe(201);
      const itemId = createRes.body.data.id;

      // 2. Launch two concurrent claim requests simultaneously via Promise.all
      const [claimRes1, claimRes2] = await Promise.all([
        request(app)
          .post(`/api/v1/items/${itemId}/claim`)
          .set('Authorization', `Bearer ${memberToken1}`),
        request(app)
          .post(`/api/v1/items/${itemId}/claim`)
          .set('Authorization', `Bearer ${memberToken2}`),
      ]);

      const statuses = [claimRes1.status, claimRes2.status].sort();

      // Assert exactly one 200 OK and one 409 Conflict
      expect(statuses).toEqual([200, 409]);

      // Check the 409 conflict payload
      const conflictRes = claimRes1.status === 409 ? claimRes1 : claimRes2;
      expect(conflictRes.body.success).toBe(false);
      expect(conflictRes.body.error.code).toBe('CONFLICT');
      expect(conflictRes.body.error.message).toContain('already claimed');

      // 3. Verify in database: exactly one assignee, status is IN_PROGRESS, exactly one CLAIMED activity event
      const itemInDb = await prisma.workItem.findUnique({
        where: { id: itemId },
        include: {
          activities: { where: { action: 'CLAIMED' } },
        },
      });

      expect(itemInDb).not.toBeNull();
      expect(itemInDb?.assigneeId).not.toBeNull();
      expect(itemInDb?.status).toBe('IN_PROGRESS');
      expect(itemInDb?.activities.length).toBe(1);
    });

    it('enforces atomic claiming under high concurrency (10 simultaneous claims)', async () => {
      // 1. Create fresh item
      const createRes = await request(app)
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${memberToken1}`)
        .send({
          teamId,
          title: `High Concurrency Claim ${Date.now()}`,
          type: 'TASK',
          priority: 'MEDIUM',
        });
      const itemId = createRes.body.data.id;

      // 2. Fire 10 simultaneous claims
      const promises = Array.from({ length: 10 }, (_, i) => {
        const token = i % 2 === 0 ? memberToken1 : memberToken2;
        return request(app)
          .post(`/api/v1/items/${itemId}/claim`)
          .set('Authorization', `Bearer ${token}`);
      });

      const results = await Promise.all(promises);
      const successCount = results.filter((r) => r.status === 200).length;
      const conflictCount = results.filter((r) => r.status === 409).length;

      // Exactly 1 winner, exactly 9 conflicts
      expect(successCount).toBe(1);
      expect(conflictCount).toBe(9);

      // Verify DB version and activity log
      const dbItem = await prisma.workItem.findUnique({
        where: { id: itemId },
        include: { activities: { where: { action: 'CLAIMED' } } },
      });
      expect(dbItem?.activities.length).toBe(1);
      expect(dbItem?.version).toBe(2); // created at 1, incremented to 2 on claim
    });
  });

  describe('Optimistic Locking for Stale Updates', () => {
    it('accepts update with current version and rejects update with stale version', async () => {
      // 1. Create fresh item (version = 1)
      const createRes = await request(app)
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${memberToken1}`)
        .send({
          teamId,
          title: `Optimistic Lock Test ${Date.now()}`,
          type: 'TASK',
          priority: 'MEDIUM',
        });
      const itemId = createRes.body.data.id;
      expect(createRes.body.data.version).toBe(1);

      // 2. User 1 updates with matching version 1 -> succeeds, increments to version 2
      const update1 = await request(app)
        .patch(`/api/v1/items/${itemId}`)
        .set('Authorization', `Bearer ${memberToken1}`)
        .send({
          title: 'Title Updated by User 1',
          version: 1,
        });

      expect(update1.status).toBe(200);
      expect(update1.body.data.version).toBe(2);
      expect(update1.body.data.title).toBe('Title Updated by User 1');

      // 3. User 2 attempts update using stale version 1 -> rejected with HTTP 409
      const updateStale = await request(app)
        .patch(`/api/v1/items/${itemId}`)
        .set('Authorization', `Bearer ${memberToken2}`)
        .send({
          title: 'Conflicting Title from User 2',
          version: 1, // Stale version!
        });

      expect(updateStale.status).toBe(409);
      expect(updateStale.body.success).toBe(false);
      expect(updateStale.body.error.code).toBe('CONFLICT');
      expect(updateStale.body.error.message).toContain('Stale update rejected');
      expect(updateStale.body.error.details.currentVersion).toBe(2);
      expect(updateStale.body.error.details.submittedVersion).toBe(1);

      // 4. Verify DB: User 1 title remains intact, version is still 2 (not increased)
      const dbItem = await prisma.workItem.findUnique({
        where: { id: itemId },
        include: { activities: true },
      });

      expect(dbItem?.title).toBe('Title Updated by User 1');
      expect(dbItem?.version).toBe(2);

      // 5. User 2 updates with current version 2 -> succeeds, increments to version 3
      const updateValid = await request(app)
        .patch(`/api/v1/items/${itemId}`)
        .set('Authorization', `Bearer ${memberToken2}`)
        .send({
          title: 'Title Correctly Updated with Version 2',
          version: 2,
        });

      expect(updateValid.status).toBe(200);
      expect(updateValid.body.data.version).toBe(3);
      expect(updateValid.body.data.title).toBe('Title Correctly Updated with Version 2');
    });
  });
});
