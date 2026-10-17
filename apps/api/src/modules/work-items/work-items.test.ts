import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { prisma } from '../../shared/database/prisma';

describe('Work Items API & Team Authorization', () => {
  const PASSWORD = 'Demo@Newtonite2026!';

  let aliceToken: string; // Admin in Core Ops
  let bobToken: string; // Lead in Core Ops
  let evanToken: string; // Member in Core Ops
  let ianToken: string; // Viewer in Core Ops
  let dianaToken: string; // Lead in Security & Compliance (different team)

  let coreOpsTeamId: string;
  let secComplianceTeamId: string;

  beforeAll(async () => {
    // Authenticate test users to acquire JWTs
    const [aliceRes, bobRes, evanRes, ianRes, dianaRes] = await Promise.all([
      request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'alice.admin@newtonite.dev', password: PASSWORD }),
      request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'bob.lead@newtonite.dev', password: PASSWORD }),
      request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'evan.member@newtonite.dev', password: PASSWORD }),
      request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'ian.viewer@newtonite.dev', password: PASSWORD }),
      request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'diana.lead@newtonite.dev', password: PASSWORD }),
    ]);

    aliceToken = aliceRes.body.data.token;
    bobToken = bobRes.body.data.token;
    evanToken = evanRes.body.data.token;
    ianToken = ianRes.body.data.token;
    dianaToken = dianaRes.body.data.token;

    // Fetch team IDs from database
    const coreOps = await prisma.team.findUniqueOrThrow({ where: { slug: 'core-ops' } });
    const secComp = await prisma.team.findUniqueOrThrow({ where: { slug: 'sec-compliance' } });
    coreOpsTeamId = coreOps.id;
    secComplianceTeamId = secComp.id;
  });

  describe('1. Work Item Creation & Role Enforcement', () => {
    it('allows a Member to create a work item in their team and transactionally creates ActivityEvent', async () => {
      const response = await request(app)
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${evanToken}`)
        .send({
          title: 'High latency detected in payment gateway webhook endpoint',
          description:
            'Webhook queue depth reached 1200 items. Processing latency spike to 4500ms.',
          type: 'INCIDENT',
          priority: 'URGENT',
          teamId: coreOpsTeamId,
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.status).toBe('BACKLOG');
      expect(response.body.data.version).toBe(1);

      // Verify corresponding ActivityEvent was persisted in the same transaction
      const activityEvents = await prisma.activityEvent.findMany({
        where: { workItemId: response.body.data.id },
      });
      expect(activityEvents.length).toBe(1);
      expect(activityEvents[0].action).toBe('CREATED');
      expect(activityEvents[0].actorId).toBeDefined();
    });

    it('rejects a Viewer attempting to create a work item with HTTP 403 Forbidden', async () => {
      const response = await request(app)
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${ianToken}`)
        .send({
          title: 'Viewer should not be able to create this item',
          type: 'TASK',
          teamId: coreOpsTeamId,
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    it('rejects creating a work item in a team the user does not belong to with HTTP 403 Forbidden', async () => {
      // Diana is in sec-compliance, not core-ops
      const response = await request(app)
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${dianaToken}`)
        .send({
          title: 'Cross-team creation attempt',
          type: 'INCIDENT',
          teamId: coreOpsTeamId,
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('rejects invalid work item payload with HTTP 422', async () => {
      const response = await request(app)
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${evanToken}`)
        .send({
          title: 'No', // Too short (min 3 chars)
          type: 'INVALID_TYPE',
          teamId: coreOpsTeamId,
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
    });
  });

  describe('2. Cross-Team Resource Isolation', () => {
    let coreOpsItemId: string;

    beforeAll(async () => {
      // Find an item belonging to Core Operations
      const item = await prisma.workItem.findFirstOrThrow({
        where: { teamId: coreOpsTeamId },
      });
      coreOpsItemId = item.id;
      expect(item.teamId).not.toBe(secComplianceTeamId);
    });

    it('allows a team member to retrieve their team work item', async () => {
      const response = await request(app)
        .get(`/api/v1/items/${coreOpsItemId}`)
        .set('Authorization', `Bearer ${evanToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(coreOpsItemId);
    });

    it('returns HTTP 404 when an unauthorized user from another team attempts to access the item', async () => {
      // Diana is in sec-compliance, not core-ops
      const response = await request(app)
        .get(`/api/v1/items/${coreOpsItemId}`)
        .set('Authorization', `Bearer ${dianaToken}`);

      // Expect 404 to avoid leaking cross-team resource existence
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
    });

    it('prevents cross-team update attempts with HTTP 404', async () => {
      const response = await request(app)
        .patch(`/api/v1/items/${coreOpsItemId}`)
        .set('Authorization', `Bearer ${dianaToken}`)
        .send({ title: 'Hacked Title' });

      expect(response.status).toBe(404);
    });

    it('prevents cross-team comments with HTTP 404', async () => {
      const response = await request(app)
        .post(`/api/v1/items/${coreOpsItemId}/comments`)
        .set('Authorization', `Bearer ${dianaToken}`)
        .send({ body: 'Unauthorized cross-team comment' });

      expect(response.status).toBe(404);
    });

    it('prevents cross-team activity log access with HTTP 404', async () => {
      const response = await request(app)
        .get(`/api/v1/items/${coreOpsItemId}/activity`)
        .set('Authorization', `Bearer ${dianaToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('3. Work Item Updates & Optimistic Version Increment', () => {
    it('allows a Member to update permitted fields and increments version', async () => {
      // Create fresh item
      const createRes = await request(app)
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${evanToken}`)
        .send({
          title: 'Initial Title for Update Test',
          type: 'TASK',
          priority: 'LOW',
          teamId: coreOpsTeamId,
        });

      const itemId = createRes.body.data.id;
      expect(createRes.body.data.version).toBe(1);

      // Update priority and title
      const updateRes = await request(app)
        .patch(`/api/v1/items/${itemId}`)
        .set('Authorization', `Bearer ${evanToken}`)
        .send({
          title: 'Updated Title After Triage',
          priority: 'HIGH',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.title).toBe('Updated Title After Triage');
      expect(updateRes.body.data.priority).toBe('HIGH');
      expect(updateRes.body.data.version).toBe(2);

      // Verify audit activity was created
      const activityRes = await request(app)
        .get(`/api/v1/items/${itemId}/activity`)
        .set('Authorization', `Bearer ${evanToken}`);

      expect(activityRes.status).toBe(200);
      const actions = activityRes.body.data.map((a: { action: string }) => a.action);
      expect(actions).toContain('CREATED');
      expect(actions).toContain('UPDATED');
    });

    it('rejects a Viewer trying to update a work item with HTTP 403', async () => {
      const item = await prisma.workItem.findFirstOrThrow({ where: { teamId: coreOpsTeamId } });

      const response = await request(app)
        .patch(`/api/v1/items/${item.id}`)
        .set('Authorization', `Bearer ${ianToken}`)
        .send({ title: 'Viewer update attempt' });

      expect(response.status).toBe(403);
    });
  });

  describe('4. Claiming Work Items', () => {
    it('allows a Member to claim an unassigned work item', async () => {
      // Create unassigned item
      const createRes = await request(app)
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${evanToken}`)
        .send({
          title: 'Unassigned incident waiting for claim',
          type: 'INCIDENT',
          teamId: coreOpsTeamId,
        });

      const itemId = createRes.body.data.id;

      // Evan claims it
      const claimRes = await request(app)
        .post(`/api/v1/items/${itemId}/claim`)
        .set('Authorization', `Bearer ${evanToken}`);

      expect(claimRes.status).toBe(200);
      expect(claimRes.body.data.assigneeId).toBeDefined();
      expect(claimRes.body.data.status).toBe('IN_PROGRESS');

      // Verify CLAIMED activity record
      const activities = await prisma.activityEvent.findMany({ where: { workItemId: itemId } });
      const actions = activities.map((a) => a.action);
      expect(actions).toContain('CLAIMED');
    });

    it('rejects claiming an item that is already claimed by someone else with HTTP 409 Conflict', async () => {
      // Create item claimed by Bob
      const createRes = await request(app)
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          title: 'Claim contention test item',
          type: 'INCIDENT',
          teamId: coreOpsTeamId,
        });

      const itemId = createRes.body.data.id;
      // Bob claims it
      await request(app)
        .post(`/api/v1/items/${itemId}/claim`)
        .set('Authorization', `Bearer ${bobToken}`);

      // Evan tries to claim already claimed item
      const conflictRes = await request(app)
        .post(`/api/v1/items/${itemId}/claim`)
        .set('Authorization', `Bearer ${evanToken}`);

      expect(conflictRes.status).toBe(409);
      expect(conflictRes.body.error.code).toBe('CONFLICT');
      expect(conflictRes.body.error.message).toContain('already claimed');
    });

    it('rejects a Viewer trying to claim an item with HTTP 403', async () => {
      const item = await prisma.workItem.findFirstOrThrow({ where: { teamId: coreOpsTeamId } });

      const response = await request(app)
        .post(`/api/v1/items/${item.id}/claim`)
        .set('Authorization', `Bearer ${ianToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('5. Workflow State Machine & Lead-Only Approval', () => {
    it('enforces valid status transitions and rejects invalid state jumps with HTTP 400', async () => {
      const createRes = await request(app)
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${evanToken}`)
        .send({
          title: 'Workflow state machine test item',
          type: 'TASK',
          teamId: coreOpsTeamId,
        });

      const itemId = createRes.body.data.id;
      expect(createRes.body.data.status).toBe('BACKLOG');

      // Invalid transition: BACKLOG directly to COMPLETED
      const invalidRes = await request(app)
        .post(`/api/v1/items/${itemId}/transition`)
        .set('Authorization', `Bearer ${evanToken}`)
        .send({ targetStatus: 'COMPLETED' });

      expect(invalidRes.status).toBe(400);
      expect(invalidRes.body.error.code).toBe('BAD_REQUEST');
      expect(invalidRes.body.error.message).toContain('Invalid workflow transition');

      // Valid transition: BACKLOG -> TRIAGED
      const validRes = await request(app)
        .post(`/api/v1/items/${itemId}/transition`)
        .set('Authorization', `Bearer ${evanToken}`)
        .send({ targetStatus: 'TRIAGED' });

      expect(validRes.status).toBe(200);
      expect(validRes.body.data.status).toBe('TRIAGED');
    });

    it('enforces that ONLY a Lead or Admin can approve an item in IN_REVIEW to COMPLETED', async () => {
      // 1. Create item and advance to IN_REVIEW
      const createRes = await request(app)
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${evanToken}`)
        .send({
          title: 'Item requiring Lead approval before completion',
          type: 'COMPLIANCE',
          teamId: coreOpsTeamId,
        });

      const itemId = createRes.body.data.id;

      // BACKLOG -> IN_PROGRESS
      await request(app)
        .post(`/api/v1/items/${itemId}/transition`)
        .set('Authorization', `Bearer ${evanToken}`)
        .send({ targetStatus: 'IN_PROGRESS' });

      // IN_PROGRESS -> IN_REVIEW
      await request(app)
        .post(`/api/v1/items/${itemId}/transition`)
        .set('Authorization', `Bearer ${evanToken}`)
        .send({ targetStatus: 'IN_REVIEW' });

      // 2. Member (Evan) tries to approve: IN_REVIEW -> COMPLETED => EXPECT 403 FORBIDDEN
      const memberApprovalRes = await request(app)
        .post(`/api/v1/items/${itemId}/transition`)
        .set('Authorization', `Bearer ${evanToken}`)
        .send({ targetStatus: 'COMPLETED' });

      expect(memberApprovalRes.status).toBe(403);
      expect(memberApprovalRes.body.error.code).toBe('FORBIDDEN');
      expect(memberApprovalRes.body.error.message).toContain('Lead or Admin');

      // 3. Lead (Bob) approves: IN_REVIEW -> COMPLETED => EXPECT 200 OK
      const leadApprovalRes = await request(app)
        .post(`/api/v1/items/${itemId}/transition`)
        .set('Authorization', `Bearer ${bobToken}`)
        .send({
          targetStatus: 'COMPLETED',
          reason: 'Reviewed compliance evidence and verified controls',
        });

      expect(leadApprovalRes.status).toBe(200);
      expect(leadApprovalRes.body.data.status).toBe('COMPLETED');
      expect(leadApprovalRes.body.data.completedAt).toBeDefined();

      // 4. Verify WORKFLOW_APPROVED event in activity history
      const activities = await prisma.activityEvent.findMany({ where: { workItemId: itemId } });
      const actions = activities.map((a) => a.action);
      expect(actions).toContain('WORKFLOW_APPROVED');

      // 5. Admin (Alice) can re-open completed item
      const adminReopenRes = await request(app)
        .post(`/api/v1/items/${itemId}/transition`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ targetStatus: 'IN_PROGRESS' });
      expect(adminReopenRes.status).toBe(200);
      expect(adminReopenRes.body.data.status).toBe('IN_PROGRESS');
    });
  });

  describe('6. Comments and Activity Timeline', () => {
    it('allows adding and reading comments on accessible work items', async () => {
      const item = await prisma.workItem.findFirstOrThrow({ where: { teamId: coreOpsTeamId } });

      const commentRes = await request(app)
        .post(`/api/v1/items/${item.id}/comments`)
        .set('Authorization', `Bearer ${evanToken}`)
        .send({
          body: 'Investigated upstream logs. Identified query lock contention on orders table.',
        });

      expect(commentRes.status).toBe(201);
      expect(commentRes.body.data.body).toContain('Investigated upstream logs');
      expect(commentRes.body.data.authorName).toBe('Evan Member');

      // Verify ActivityEvent recorded COMMENT_ADDED
      const activities = await prisma.activityEvent.findMany({
        where: { workItemId: item.id, action: 'COMMENT_ADDED' },
      });
      expect(activities.length).toBeGreaterThan(0);
    });
  });

  describe('7. Filtering, Search, and Keyset Cursor Pagination', () => {
    it('filters items by status and team-scope', async () => {
      const response = await request(app)
        .get(`/api/v1/items?teamId=${coreOpsTeamId}&status=IN_PROGRESS`)
        .set('Authorization', `Bearer ${bobToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      for (const item of response.body.data) {
        expect(item.teamId).toBe(coreOpsTeamId);
        expect(item.status).toBe('IN_PROGRESS');
      }
    });

    it('supports text search across titles and descriptions', async () => {
      const response = await request(app)
        .get('/api/v1/items?search=connection')
        .set('Authorization', `Bearer ${bobToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeGreaterThan(0);
      const matches = response.body.data.some(
        (item: { title: string; description: string | null }) =>
          item.title.toLowerCase().includes('connection') ||
          (item.description && item.description.toLowerCase().includes('connection'))
      );
      expect(matches).toBe(true);
    });

    it('enforces maximum page size limit and provides cursor for next page', async () => {
      const response = await request(app)
        .get('/api/v1/items?limit=3')
        .set('Authorization', `Bearer ${bobToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeLessThanOrEqual(3);
      if (response.body.meta.hasMore) {
        expect(response.body.meta.nextCursor).toBeDefined();

        // Fetch next page using cursor
        const nextRes = await request(app)
          .get(`/api/v1/items?limit=3&cursor=${response.body.meta.nextCursor}`)
          .set('Authorization', `Bearer ${bobToken}`);

        expect(nextRes.status).toBe(200);
        expect(nextRes.body.data.length).toBeGreaterThan(0);
        // Ensure no overlapping IDs between pages
        const firstIds = response.body.data.map((i: { id: string }) => i.id);
        const secondIds = nextRes.body.data.map((i: { id: string }) => i.id);
        expect(firstIds.some((id: string) => secondIds.includes(id))).toBe(false);
      }
    });
  });
});
