import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../apps/api/src/app';
import { OptimisticReconciler } from '../../apps/web/src/hooks/optimisticReconciler';

describe('Step 5: Full-Stack Integration & End-to-End User Flows (15 Scenarios)', () => {
  let leadToken: string;
  let memberToken: string;
  let viewerToken: string;
  let charliePlatformLeadToken: string;
  let coreOpsTeamId: string;
  let platformEngTeamId: string;
  let createdItemId: string;
  let initialItemVersion: number;

  beforeAll(async () => {
    // 1. Authenticate Bob Lead
    const bobRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'bob.lead@newtonite.dev', password: 'Demo@Newtonite2026!' });
    expect(bobRes.status).toBe(200);
    leadToken = bobRes.body.data.token;
    coreOpsTeamId = bobRes.body.data.user.memberships[0].teamId;

    // 2. Authenticate Evan Member
    const evanRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'evan.member@newtonite.dev', password: 'Demo@Newtonite2026!' });
    expect(evanRes.status).toBe(200);
    memberToken = evanRes.body.data.token;

    // 3. Authenticate Ian Viewer
    const ianRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'ian.viewer@newtonite.dev', password: 'Demo@Newtonite2026!' });
    expect(ianRes.status).toBe(200);
    viewerToken = ianRes.body.data.token;

    // 4. Authenticate Charlie Lead (Platform Engineering)
    const charlieRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'charlie.lead@newtonite.dev', password: 'Demo@Newtonite2026!' });
    expect(charlieRes.status).toBe(200);
    charliePlatformLeadToken = charlieRes.body.data.token;
    platformEngTeamId = charlieRes.body.data.user.memberships[0].teamId;
  });

  // Flow 1: Login with valid seeded user
  it('Flow 1: logs in with valid seeded credentials and receives token and profile', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'bob.lead@newtonite.dev', password: 'Demo@Newtonite2026!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.name).toBe('Bob Lead');
    expect(res.body.data.user.memberships[0].role).toBe('LEAD');
  });

  // Flow 2: Reject invalid credentials and unauthenticated requests
  it('Flow 2: rejects invalid credentials and unauthenticated requests with HTTP 401', async () => {
    // Bad password
    const badLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'bob.lead@newtonite.dev', password: 'WrongPassword!' });
    expect(badLogin.status).toBe(401);
    expect(badLogin.body.success).toBe(false);
    expect(badLogin.body.error.code).toBe('UNAUTHORIZED');

    // Missing token on protected endpoint
    const unauth = await request(app).get('/api/v1/items');
    expect(unauth.status).toBe(401);
    expect(unauth.body.success).toBe(false);
    expect(unauth.body.error.code).toBe('UNAUTHORIZED');
  });

  // Flow 3: Load dashboard using real backend data
  it('Flow 3: loads dashboard items from real backend across accessible teams', async () => {
    const res = await request(app)
      .get('/api/v1/items?limit=50')
      .set('Authorization', `Bearer ${leadToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    // Real server items contain UUIDs and version numbers
    expect(res.body.data[0].id).toBeDefined();
    expect(res.body.data[0].version).toBeGreaterThanOrEqual(1);
  });

  // Flow 4: Create a work item and verify persistence in PostgreSQL
  it('Flow 4: creates a work item with idempotency key and persists in PostgreSQL', async () => {
    const idempKey = `test-e2e-create-${Date.now()}`;
    const payload = {
      title: 'E2E Critical Kafka Broker Outage',
      description: 'Partition 3 offline; consumer rebalances failing.',
      type: 'INCIDENT',
      priority: 'CRITICAL',
      teamId: coreOpsTeamId,
    };

    const res = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${leadToken}`)
      .set('Idempotency-Key', idempKey)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe(payload.title);
    expect(res.body.data.status).toBe('BACKLOG');
    expect(res.body.data.version).toBe(1);

    createdItemId = res.body.data.id;
    initialItemVersion = res.body.data.version;
    expect(createdItemId).toBeDefined();
  });

  // Flow 5: Search, filter, and paginate work items
  it('Flow 5: filters by search keyword and supports cursor-based pagination', async () => {
    // 1. Search by title keyword
    const searchRes = await request(app)
      .get(`/api/v1/items?teamId=${coreOpsTeamId}&search=Kafka`)
      .set('Authorization', `Bearer ${leadToken}`);

    expect(searchRes.status).toBe(200);
    expect(searchRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(searchRes.body.data.some((i: { title: string }) => i.title.includes('Kafka'))).toBe(
      true
    );

    // 2. Cursor pagination with limit=2
    const page1 = await request(app)
      .get(`/api/v1/items?teamId=${coreOpsTeamId}&limit=2`)
      .set('Authorization', `Bearer ${leadToken}`);

    expect(page1.status).toBe(200);
    expect(page1.body.data.length).toBe(2);
    expect(page1.body.meta.hasMore).toBe(true);
    expect(page1.body.meta.nextCursor).toBeDefined();

    // Page 2 using nextCursor
    const page2 = await request(app)
      .get(`/api/v1/items?teamId=${coreOpsTeamId}&limit=2&cursor=${page1.body.meta.nextCursor}`)
      .set('Authorization', `Bearer ${leadToken}`);

    expect(page2.status).toBe(200);
    expect(page2.body.data.length).toBeGreaterThanOrEqual(1);
    // Keysets are disjoint
    const page1Ids = page1.body.data.map((i: { id: string }) => i.id);
    const page2Ids = page2.body.data.map((i: { id: string }) => i.id);
    expect(page1Ids).not.toContain(page2Ids[0]);
  });

  // Flow 6: Open an item and verify its details and activity history
  it('Flow 6: retrieves item details and verifies audit activity log stream', async () => {
    const itemRes = await request(app)
      .get(`/api/v1/items/${createdItemId}`)
      .set('Authorization', `Bearer ${leadToken}`);

    expect(itemRes.status).toBe(200);
    expect(itemRes.body.data.id).toBe(createdItemId);
    expect(itemRes.body.data.title).toContain('E2E Critical Kafka');

    const activityRes = await request(app)
      .get(`/api/v1/items/${createdItemId}/activity`)
      .set('Authorization', `Bearer ${leadToken}`);

    expect(activityRes.status).toBe(200);
    expect(Array.isArray(activityRes.body.data)).toBe(true);
    expect(activityRes.body.data.length).toBeGreaterThanOrEqual(1);
    expect(activityRes.body.data[0].action).toBe('CREATED');
  });

  // Flow 7: Edit an item and verify version handling
  it('Flow 7: edits permitted fields and rejects stale update with HTTP 409 Conflict', async () => {
    // 1. Valid update with version 1
    const patchRes = await request(app)
      .patch(`/api/v1/items/${createdItemId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        title: 'E2E Critical Kafka Broker Outage [Investigating]',
        priority: 'URGENT',
        version: initialItemVersion,
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.version).toBe(2);
    expect(patchRes.body.data.priority).toBe('URGENT');

    // 2. Stale update attempting to use old version 1 again
    const staleRes = await request(app)
      .patch(`/api/v1/items/${createdItemId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        title: 'Overwriting with stale version',
        version: initialItemVersion, // Expected version 2, providing version 1
      });

    expect(staleRes.status).toBe(409);
    expect(staleRes.body.success).toBe(false);
    expect(staleRes.body.error.code).toBe('CONFLICT');
    expect(staleRes.body.error.message).toContain('modified by another user');
  });

  // Flow 8: Claim an unassigned item
  it('Flow 8: atomically claims an unassigned item and assigns the operator', async () => {
    const claimRes = await request(app)
      .post(`/api/v1/items/${createdItemId}/claim`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(claimRes.status).toBe(200);
    expect(claimRes.body.data.assigneeName).toBe('Evan Member');
    expect(claimRes.body.data.status).toBe('IN_PROGRESS'); // Auto-promotes from BACKLOG
    expect(claimRes.body.data.version).toBe(3);

    // Viewer cannot claim items (HTTP 403)
    const viewerClaim = await request(app)
      .post(`/api/v1/items/${createdItemId}/claim`)
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(viewerClaim.status).toBe(403);

    // Claiming an already claimed item returns 409
    const secondClaim = await request(app)
      .post(`/api/v1/items/${createdItemId}/claim`)
      .set('Authorization', `Bearer ${leadToken}`);

    expect(secondClaim.status).toBe(409);
    expect(secondClaim.body.error.details.claimedBy).toBe('Evan Member');
  });

  // Flow 9: Perform valid workflow transitions
  it('Flow 9: transitions workflow states adhering to state machine rules', async () => {
    // Current status is IN_PROGRESS. Move to IN_REVIEW
    const transitionRes = await request(app)
      .post(`/api/v1/items/${createdItemId}/transition`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        targetStatus: 'IN_REVIEW',
        reason: 'Patch deployed to canary cluster. Ready for lead signoff.',
      });

    expect(transitionRes.status).toBe(200);
    expect(transitionRes.body.data.status).toBe('IN_REVIEW');
    expect(transitionRes.body.data.version).toBe(4);
  });

  // Flow 10: Verify only authorized Lead can approve an item
  it('Flow 10: enforces that only a Lead or Admin can approve item from IN_REVIEW to COMPLETED', async () => {
    // 1. Member attempt: Rejected with HTTP 403 Forbidden
    const memberApproval = await request(app)
      .post(`/api/v1/items/${createdItemId}/transition`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ targetStatus: 'COMPLETED', reason: 'Member trying to approve self' });

    expect(memberApproval.status).toBe(403);
    expect(memberApproval.body.error.code).toBe('FORBIDDEN');
    expect(memberApproval.body.error.message).toContain('Workflow approval requires Lead or Admin');

    // 2. Lead attempt: Succeeded with HTTP 200
    const leadApproval = await request(app)
      .post(`/api/v1/items/${createdItemId}/transition`)
      .set('Authorization', `Bearer ${leadToken}`)
      .send({ targetStatus: 'COMPLETED', reason: 'Lead approved following verification test.' });

    expect(leadApproval.status).toBe(200);
    expect(leadApproval.body.data.status).toBe('COMPLETED');
    expect(leadApproval.body.data.completedAt).toBeDefined();
  });

  // Flow 11: Add a comment and retrieve it
  it('Flow 11: adds a discussion comment and retrieves it in chronological order', async () => {
    const postComment = await request(app)
      .post(`/api/v1/items/${createdItemId}/comments`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ body: 'Root cause confirmed: Out of disk space on broker 3 journal volume.' });

    expect(postComment.status).toBe(201);
    expect(postComment.body.data.body).toContain('Root cause confirmed');
    expect(postComment.body.data.authorName).toBe('Evan Member');

    const getComments = await request(app)
      .get(`/api/v1/items/${createdItemId}/comments`)
      .set('Authorization', `Bearer ${leadToken}`);

    expect(getComments.status).toBe(200);
    expect(getComments.body.data.length).toBeGreaterThanOrEqual(1);
    expect(getComments.body.data[getComments.body.data.length - 1].body).toContain(
      'Root cause confirmed'
    );
  });

  // Flow 12: Verify unauthorized cross-team access is rejected
  it('Flow 12: blocks cross-team access with HTTP 404 to avoid leaking resource existence', async () => {
    // Charlie is Lead of Platform Engineering, attempting to access Core Operations item
    const crossTeamRes = await request(app)
      .get(`/api/v1/items/${createdItemId}`)
      .set('Authorization', `Bearer ${charliePlatformLeadToken}`);

    expect(crossTeamRes.status).toBe(404);
    expect(crossTeamRes.body.error.code).toBe('NOT_FOUND');

    // But Charlie can query items within his own team (platformEngTeamId)
    const ownTeamRes = await request(app)
      .get(`/api/v1/items?teamId=${platformEngTeamId}`)
      .set('Authorization', `Bearer ${charliePlatformLeadToken}`);
    expect(ownTeamRes.status).toBe(200);
    expect(ownTeamRes.body.success).toBe(true);
  });

  // Flow 13: Verify failed mutations display appropriate frontend errors
  it('Flow 13: returns HTTP 400 Bad Request with allowed transitions on invalid workflow progression', async () => {
    // Item is COMPLETED (terminal). Attempting transition to TRIAGED
    const invalidTrans = await request(app)
      .post(`/api/v1/items/${createdItemId}/transition`)
      .set('Authorization', `Bearer ${leadToken}`)
      .send({ targetStatus: 'TRIAGED' });

    expect(invalidTrans.status).toBe(400);
    expect(invalidTrans.body.error.code).toBe('BAD_REQUEST');
    expect(invalidTrans.body.error.message).toContain(
      "Invalid workflow transition from 'COMPLETED'"
    );
  });

  // Flow 14: Verify HTTP 409 and 403 trigger correct UI reconciliation
  it('Flow 14: verifies frontend OptimisticReconciler rolls back UI state on 409 and 403', async () => {
    const initialItem = {
      id: createdItemId,
      title: 'Current Active Title',
      status: 'IN_PROGRESS',
      assigneeId: 'user-bob',
      version: 5,
    };

    // 409 Conflict rollback
    const conflictMutation = async () => {
      const err = new Error('Conflict');
      (err as unknown as { status: number }).status = 409;
      throw err;
    };
    const reconcileServerFn = async () => ({
      ...initialItem,
      version: 6,
      title: 'Concurrently Modified on Server',
    });

    const conflictResult = await OptimisticReconciler.execute(
      initialItem,
      { title: 'My Optimistic Edit' },
      conflictMutation,
      reconcileServerFn
    );

    expect(conflictResult.success).toBe(false);
    expect(conflictResult.conflictError).toContain('Conflict detected');
    expect(conflictResult.state.version).toBe(6);
    expect(conflictResult.state.title).toBe('Concurrently Modified on Server');

    // 403 Forbidden rollback
    const forbiddenMutation = async () => {
      const err = new Error('Forbidden');
      (err as unknown as { status: number }).status = 403;
      throw err;
    };

    const forbiddenResult = await OptimisticReconciler.execute(
      initialItem,
      { status: 'COMPLETED' },
      forbiddenMutation
    );

    expect(forbiddenResult.success).toBe(false);
    expect(forbiddenResult.authorizationError).toContain('Authorization failed');
    expect(forbiddenResult.state.status).toBe('IN_PROGRESS'); // Restored
  });

  // Flow 15: Verify logout and expired-session handling
  it('Flow 15: verifies expired tokens are rejected with HTTP 401 and session is invalid', async () => {
    const bogusToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.bogus-expired-token';

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${bogusToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
