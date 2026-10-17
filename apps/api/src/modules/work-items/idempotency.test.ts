import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { prisma } from '../../shared/database/prisma';
import type { Application } from 'express';

describe('Critical Behaviour 3: Idempotency for Repeated Requests', () => {
  let app: Application;
  let memberToken: string;
  let teamId: string;

  beforeAll(async () => {
    app = createApp();

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'bob.lead@newtonite.dev', password: 'Demo@Newtonite2026!' });
    expect(loginRes.status).toBe(200);
    memberToken = loginRes.body.data.token;
    teamId = loginRes.body.data.user.memberships[0].teamId;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns identical cached response when repeating request with the same Idempotency-Key', async () => {
    const idempotencyKey = `idemp-key-${Date.now()}`;
    const payload = {
      teamId,
      title: `Idempotent Item ${Date.now()}`,
      description: 'Testing idempotent replay',
      type: 'INCIDENT',
      priority: 'CRITICAL',
    };

    // 1. First submission
    const res1 = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(res1.status).toBe(201);
    expect(res1.body.success).toBe(true);
    const createdItemId = res1.body.data.id;

    // Wait a brief tick for background persistence of idempotency cache
    await new Promise((r) => setTimeout(r, 100));

    // 2. Second submission with identical payload & key
    const res2 = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload);

    expect(res2.status).toBe(201);
    expect(res2.headers['x-cache-lookup']).toBe('HIT');
    expect(res2.body.data.id).toBe(createdItemId);
    expect(res2.body.data.title).toBe(payload.title);

    // 3. Verify database contains only ONE item
    const itemsInDb = await prisma.workItem.findMany({
      where: { title: payload.title },
    });
    expect(itemsInDb.length).toBe(1);
  });

  it('rejects reusing the same Idempotency-Key with a different payload (409 Conflict)', async () => {
    const idempotencyKey = `idemp-tamper-${Date.now()}`;

    // 1. First submission
    const res1 = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        teamId,
        title: 'Original Title',
        type: 'TASK',
      });
    expect(res1.status).toBe(201);

    await new Promise((r) => setTimeout(r, 100));

    // 2. Second submission with SAME key but DIFFERENT payload
    const res2 = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        teamId,
        title: 'Tampered Title with Same Key',
        type: 'TASK',
      });

    expect(res2.status).toBe(409);
    expect(res2.body.success).toBe(false);
    expect(res2.body.error.code).toBe('CONFLICT');
    expect(res2.body.error.message).toContain('different request payload');
  });

  it('safely handles concurrent duplicate submissions with the same key', async () => {
    const idempotencyKey = `idemp-concurrent-${Date.now()}`;
    const payload = {
      teamId,
      title: `Concurrent Idempotent Creation ${Date.now()}`,
      type: 'TASK',
      priority: 'LOW',
    };

    // Fire 2 concurrent requests with the same key
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${memberToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload),
      request(app)
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${memberToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send(payload),
    ]);

    const statuses = [res1.status, res2.status];
    // Either both 201 (one created, one cached or resolved) or one 201 and one 409 in-progress
    expect(statuses.some((s) => s === 201)).toBe(true);

    // Verify DB has strictly 1 item
    const count = await prisma.workItem.count({
      where: { title: payload.title },
    });
    expect(count).toBe(1);
  });
});
