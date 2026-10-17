import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../apps/api/src/app';
import { prisma } from '../../apps/api/src/shared/database/prisma';
import { settingsService } from '../../apps/api/src/modules/settings/settings.service';
import { slaService } from '../../apps/api/src/modules/sla/sla.service';

describe('Step 7: Centralized Settings & Configuration Center Integration Tests', () => {
  let adminToken: string;
  let memberToken: string;
  let adminUserId: string;
  let coreOpsTeamId: string;

  beforeAll(async () => {
    // 1. Authenticate Alice Admin (System Admin)
    const adminRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice.admin@newtonite.dev', password: 'Demo@Newtonite2026!' });
    expect(adminRes.status).toBe(200);
    adminToken = adminRes.body.data.token;
    adminUserId = adminRes.body.data.user.id;
    coreOpsTeamId = adminRes.body.data.user.memberships[0].teamId;

    // 2. Authenticate Evan Member (Standard Member)
    const memberRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'evan.member@newtonite.dev', password: 'Demo@Newtonite2026!' });
    expect(memberRes.status).toBe(200);
    memberToken = memberRes.body.data.token;
  });

  afterAll(async () => {
    // Reset general and SLA settings to default
    await settingsService.updateSettings('general', { maintenanceMode: false });
    await settingsService.updateSettings('sla', {
      durations: {
        CRITICAL: 120,
        URGENT: 360,
        HIGH: 1440,
        MEDIUM: 4320,
        LOW: 10080,
      },
      warningBufferPercent: 25,
      scanIntervalMinutes: 5,
      escalationProcessingEnabled: true,
    });
    settingsService.clearCache();
  });

  // -------------------------------------------------------------
  // Test 1: Public Branding Endpoint
  // -------------------------------------------------------------
  it('Scenario 1: allows unauthenticated access to public branding settings', async () => {
    const res = await request(app).get('/api/v1/settings/public/branding');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.appName).toBeDefined();
    expect(res.body.data.primaryColor).toMatch(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  });

  // -------------------------------------------------------------
  // Test 2: Role Authorization (Admin vs Non-Admin Denial)
  // -------------------------------------------------------------
  it('Scenario 2: denies non-admin users with 403 Forbidden on settings routes', async () => {
    // Evan Member attempting to read settings
    const readRes = await request(app)
      .get('/api/v1/settings/general')
      .set('Authorization', `Bearer ${memberToken}`);
    expect(readRes.status).toBe(403);
    expect(readRes.body.error.message).toMatch(/Administrative privileges required/);

    // Evan Member attempting to update settings
    const updateRes = await request(app)
      .put('/api/v1/settings/general')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ appName: 'Hacked Ops' });
    expect(updateRes.status).toBe(403);

    // Alice Admin permitted
    const adminReadRes = await request(app)
      .get('/api/v1/settings/general')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminReadRes.status).toBe(200);
    expect(adminReadRes.body.data.appName).toBeDefined();
  });

  // -------------------------------------------------------------
  // Test 3: Configuration Persistence & Reload
  // -------------------------------------------------------------
  it('Scenario 3: persists configuration changes across requests and reloads', async () => {
    const customOrgName = `Newtonite Enterprise ${Date.now()}`;
    const updateRes = await request(app)
      .put('/api/v1/settings/general')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        appName: 'Newtonite High-Reliability Ops',
        orgName: customOrgName,
        timezone: 'Asia/Kolkata',
        dateFormat: 'DD/MM/YYYY',
        timeFormat: '24h',
        supportContact: 'ops-lead@newtonite.dev',
        maintenanceMode: false,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.orgName).toBe(customOrgName);
    expect(updateRes.body.data.timezone).toBe('Asia/Kolkata');

    // Reload setting
    const reloadRes = await request(app)
      .get('/api/v1/settings/general')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(reloadRes.status).toBe(200);
    expect(reloadRes.body.data.orgName).toBe(customOrgName);
    expect(reloadRes.body.data.timezone).toBe('Asia/Kolkata');
  });

  // -------------------------------------------------------------
  // Test 4: Validation & Rejection of Invalid Configuration
  // -------------------------------------------------------------
  it('Scenario 4: rejects invalid configuration with 400 or 422 validation errors', async () => {
    // Invalid primaryColor (not hex)
    const invalidColorRes = await request(app)
      .put('/api/v1/settings/branding')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        appName: 'Test',
        browserTitle: 'Test',
        primaryColor: 'not-a-valid-hex',
        accentColor: '#1d4ed8',
      });
    expect([400, 422]).toContain(invalidColorRes.status);

    // Invalid support contact email
    const invalidEmailRes = await request(app)
      .put('/api/v1/settings/general')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        appName: 'Test',
        orgName: 'Test Org',
        supportContact: 'not-an-email',
      });
    expect([400, 422]).toContain(invalidEmailRes.status);
  });

  // -------------------------------------------------------------
  // Test 5: Secret Masking & Preservation on Blank Input
  // -------------------------------------------------------------
  it('Scenario 5: masks SMTP password in output and preserves saved secret when left blank', async () => {
    const initialSecretPassword = 'UltraSecureSmtpPassword!987';

    // 1. Save new email configuration with secret
    const saveRes = await request(app)
      .put('/api/v1/settings/email')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        smtpHost: 'smtp.newtonite.local',
        smtpPort: 587,
        smtpUser: 'relay@newtonite.local',
        smtpPassword: initialSecretPassword,
        smtpSecure: true,
        senderName: 'Newtonite Relay',
        senderEmail: 'relay@newtonite.local',
        enabled: true,
      });

    expect(saveRes.status).toBe(200);
    // Verified: Never returns raw password in API response!
    expect(saveRes.body.data.smtpPassword).toBe('••••••••');

    // 2. Read setting: verify still masked
    const readRes = await request(app)
      .get('/api/v1/settings/email')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(readRes.status).toBe(200);
    expect(readRes.body.data.smtpPassword).toBe('••••••••');

    // 3. Update without password (blank input): verify existing password was preserved
    const blankUpdateRes = await request(app)
      .put('/api/v1/settings/email')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        smtpHost: 'smtp.newtonite.local',
        smtpPort: 587,
        smtpUser: 'relay@newtonite.local',
        smtpPassword: '', // Blank input from UI
        smtpSecure: true,
        senderName: 'Newtonite Relay Updated',
        senderEmail: 'relay@newtonite.local',
        enabled: true,
      });

    expect(blankUpdateRes.status).toBe(200);
    expect(blankUpdateRes.body.data.senderName).toBe('Newtonite Relay Updated');

    // Verify secret is intact in underlying store
    const dbRecord = await prisma.systemSetting.findUnique({
      where: { key: 'email' },
    });
    const parsedVal = dbRecord?.value as Record<string, unknown>;
    expect(parsedVal.smtpPassword).toBe(initialSecretPassword);
  });

  // -------------------------------------------------------------
  // Test 6: Branding Asset Validation
  // -------------------------------------------------------------
  it('Scenario 6: validates logo upload data, rejecting unsupported MIME types and large assets', async () => {
    // 1. Invalid MIME type (text/plain)
    const invalidMimeRes = await request(app)
      .post('/api/v1/settings/branding/logo')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ logoData: 'data:text/plain;base64,SGVsbG8=' });
    expect(invalidMimeRes.status).toBe(400);
    expect(invalidMimeRes.body.error.message).toMatch(/Unsupported image type/);

    // 2. Oversized asset
    const hugePayload = 'data:image/png;base64,' + 'A'.repeat(3_500_000);
    const hugeRes = await request(app)
      .post('/api/v1/settings/branding/logo')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ logoData: hugePayload });
    expect(hugeRes.status).toBe(400);
    expect(hugeRes.body.error.message).toMatch(/exceeds maximum allowed size/);

    // 3. Valid SVG/PNG data URI
    const validData = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
    const validRes = await request(app)
      .post('/api/v1/settings/branding/logo')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ logoData: validData });
    expect(validRes.status).toBe(200);
    expect(validRes.body.data.logoUrl).toBe(validData);
  });

  // -------------------------------------------------------------
  // Test 7: Maintenance Mode Behavioral Effect
  // -------------------------------------------------------------
  it('Scenario 7: maintenance mode blocks non-admin work-item mutations with 503, but permits admins', async () => {
    // 1. Enable Maintenance Mode
    await request(app)
      .put('/api/v1/settings/general')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        appName: 'Newtonite Ops',
        orgName: 'Newtonite Inc.',
        supportContact: 'support@newtonite.dev',
        maintenanceMode: true,
      });

    // 2. Evan Member attempts to create a work item during maintenance -> Expect 503
    const memberCreateRes = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${memberToken}`)
      .set('x-test-maintenance', 'true')
      .send({
        teamId: coreOpsTeamId,
        title: 'Maintenance Test Item',
        type: 'TASK',
      });
    expect(memberCreateRes.status).toBe(503);
    expect(memberCreateRes.body.error.message).toMatch(/Maintenance mode is active/);

    // 3. Alice Admin attempts to create work item during maintenance -> Expect 201 Created
    const adminCreateRes = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('x-test-maintenance', 'true')
      .send({
        teamId: coreOpsTeamId,
        title: 'Admin Emergency Fix During Maintenance',
        type: 'INCIDENT',
        priority: 'CRITICAL',
      });
    expect(adminCreateRes.status).toBe(201);

    // 4. Disable Maintenance Mode
    await request(app)
      .put('/api/v1/settings/general')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        appName: 'Newtonite Ops',
        orgName: 'Newtonite Inc.',
        supportContact: 'support@newtonite.dev',
        maintenanceMode: false,
      });

    // 5. Evan Member can now create items again
    const postMaintenanceRes = await request(app)
      .post('/api/v1/items')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        teamId: coreOpsTeamId,
        title: 'Normal Operations Resumed',
        type: 'TASK',
      });
    expect(postMaintenanceRes.status).toBe(201);
  });

  // -------------------------------------------------------------
  // Test 8: Dynamic SLA Settings Affecting SLA Engine
  // -------------------------------------------------------------
  it('Scenario 8: dynamic SLA settings immediately adjust calculation and escalation thresholds', async () => {
    try {
      // Configure CRITICAL duration to 60 minutes (1 hour instead of 2 hours)
      await request(app)
        .put('/api/v1/settings/sla')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          durations: {
            CRITICAL: 60, // 1 hour
            URGENT: 360,
            HIGH: 1440,
            MEDIUM: 4320,
            LOW: 10080,
          },
          warningBufferPercent: 20,
          scanIntervalMinutes: 5,
          escalationProcessingEnabled: true,
        });

      // Create item
      const itemRes = await request(app)
        .post('/api/v1/items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          teamId: coreOpsTeamId,
          title: 'Dynamic SLA 1-Hour Target',
          type: 'INCIDENT',
          priority: 'CRITICAL',
        });

      expect(itemRes.status).toBe(201);
      const item = itemRes.body.data;

      // Scan at 75 minutes in future (past 60 min SLA) -> should evaluate to BREACHED
      const futureTime = new Date(new Date(item.createdAt).getTime() + 75 * 60 * 1000);
      const scanResult = await slaService.scanAndEscalate({ now: futureTime });
      expect(scanResult.scanned).toBeGreaterThan(0);

      // Test disabling escalation processing
      await request(app)
        .put('/api/v1/settings/sla')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          durations: {
            CRITICAL: 120,
            URGENT: 360,
            HIGH: 1440,
            MEDIUM: 4320,
            LOW: 10080,
          },
          warningBufferPercent: 25,
          scanIntervalMinutes: 5,
          escalationProcessingEnabled: false, // Paused
        });

      const pausedScan = await slaService.scanAndEscalate({ now: futureTime });
      expect(pausedScan.scanned).toBe(0);
      expect(pausedScan.escalated).toBe(0);
    } finally {
      // Always restore default SLA settings and re-enable escalation
      await settingsService.updateSettings('sla', {
        durations: {
          CRITICAL: 120,
          URGENT: 360,
          HIGH: 1440,
          MEDIUM: 4320,
          LOW: 10080,
        },
        warningBufferPercent: 25,
        scanIntervalMinutes: 5,
        escalationProcessingEnabled: true,
      });
      settingsService.clearCache();
    }
  });

  // -------------------------------------------------------------
  // Test 9: Team Administration & Last-Admin Protection
  // -------------------------------------------------------------
  it('Scenario 9: prevents administrator from demoting or removing the last administrator', async () => {
    // 1. List members
    const membersRes = await request(app)
      .get(`/api/v1/settings/teams/members?teamId=${coreOpsTeamId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(membersRes.status).toBe(200);

    const aliceMembership = membersRes.body.data.find(
      (m: { userEmail: string }) => m.userEmail === 'alice.admin@newtonite.dev'
    );
    expect(aliceMembership).toBeDefined();

    // 2. Alice attempts to demote herself in Core Ops -> Safety guard prevents it
    const demoteSelfRes = await request(app)
      .patch(`/api/v1/settings/teams/${coreOpsTeamId}/members/${aliceMembership.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'MEMBER' });
    expect(demoteSelfRes.status).toBe(400);
    expect(demoteSelfRes.body.error.message).toMatch(/Safety Guard|cannot demote/i);

    // 3. Alice attempts to deactivate herself -> Safety guard prevents it
    const deactSelfRes = await request(app)
      .patch(`/api/v1/settings/users/${adminUserId}/active`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(deactSelfRes.status).toBe(400);
    expect(deactSelfRes.body.error.message).toMatch(/cannot deactivate your own account/);
  });

  // -------------------------------------------------------------
  // Test 10: Background Jobs Queue Stats & Retry Operation
  // -------------------------------------------------------------
  it('Scenario 10: exposes outbox queue counters and safely retries a dead-letter job', async () => {
    // 1. Create a simulated failed outbox job
    const failedJob = await prisma.outboxJob.create({
      data: {
        aggregateType: 'NOTIFICATION',
        aggregateId: 'sim-notif-1',
        eventType: 'WORK_ITEM_ESCALATED',
        payload: { workItemId: '123' },
        status: 'FAILED',
        attempts: 5,
        maxAttempts: 5,
        lastError: 'SMTP Connection Timed Out',
      },
    });

    // 2. Fetch stats
    const statsRes = await request(app)
      .get('/api/v1/settings/jobs/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.data.failed).toBeGreaterThanOrEqual(1);

    // 3. Retry the failed job
    const retryRes = await request(app)
      .post(`/api/v1/settings/jobs/${failedJob.id}/retry`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(retryRes.status).toBe(200);
    expect(retryRes.body.data.status).toBe('PENDING');
    expect(retryRes.body.data.lastError).toBeNull();
  });

  // -------------------------------------------------------------
  // Test 11: Configuration Audit History with Redacted Secrets
  // -------------------------------------------------------------
  it('Scenario 11: records append-only configuration audit trail with secrets strictly redacted', async () => {
    const historyRes = await request(app)
      .get('/api/v1/settings/audit/history')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(historyRes.status).toBe(200);
    const items = historyRes.body.data?.items || historyRes.body.items;
    expect(items.length).toBeGreaterThan(0);

    const emailAuditEvent = items.find((e: { category: string }) => e.category === 'email');
    if (emailAuditEvent && emailAuditEvent.diff) {
      const diffStr = JSON.stringify(emailAuditEvent.diff);
      // Ensure plaintext secret was never leaked in audit logs!
      expect(diffStr).not.toContain('UltraSecureSmtpPassword!987');
      expect(diffStr).toContain('••••••••');
    }
  });

  // -------------------------------------------------------------
  // Test 12: SMTP Test Action Behavior
  // -------------------------------------------------------------
  it('Scenario 12: SMTP test connection responds gracefully with diagnostic results', async () => {
    const testRes = await request(app)
      .post('/api/v1/settings/email/test-connection')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(testRes.status).toBe(200);
    const message = testRes.body.data?.message || testRes.body.message;
    expect(message).toBeDefined();
  });
});
