# Step 7 — Settings & Configuration Center Engineering Report

> **Newtonite Operations Under Pressure Platform**  
> **Status:** Step 7 Implementation, Behavioral Integration & Verification Completed  
> **Date:** October 2026  
> **Quality Gate:** 106 / 106 Tests Passing across 14 Suites | Strict TypeScript 0 Errors | ESLint 0 Errors | 100% Prettier Formatted | Production API & Web Builds Verified

---

## 1. Executive Summary

Step 7 delivers a centralized, production-grade **Settings & Configuration Center** for the Newtonite Operations Under Pressure platform.

The architecture strictly rejects "static UI forms" or cosmetic dashboards. Every setting is:

1. **Typed & Validated**: Backed by Zod validation schemas shared between client and server via `@newtonite/shared`.
2. **Persisted in PostgreSQL**: Stored in a dedicated `SystemSetting` relational model with transaction-safe mutations and in-memory TTL caching.
3. **Protected by RBAC**: All administrative views and mutation endpoints require System Administrator (`SYSTEM_ADMIN`) privileges; public settings (branding) expose zero sensitive configuration.
4. **Audited Append-Only**: Every configuration change transactionally appends an immutable `SettingAuditEvent` recording the actor, timestamp, category, and safe before/after diff with sensitive credentials strictly redacted.
5. **Behaviorally Active**: Directly integrated into application middleware, SLA engines, workflow processors, outbox queues, email transports, and dynamic UI themes.

---

## 2. Configuration Center Architecture

```
                       ┌───────────────────────────────┐
                       │     React 18 Settings UI      │
                       │   (10-Tab Admin Controller)   │
                       └──────────────┬────────────────┘
                                      │ Authenticated / Public REST
                                      ▼
                       ┌───────────────────────────────┐
                       │    Express Settings Router    │
                       │  (/api/v1/settings/* routes)  │
                       └──────────────┬────────────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            ▼                         ▼                         ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│  settings.service.ts  │ │   email.service.ts    │ │  teams-admin.service  │
│  - In-Memory Cache    │ │ - Nodemailer verify() │ │ - Last-Admin Guard    │
│  - Secret Masking     │ │ - Real SMTP transport │ │ - Self-Deactivation   │
│  - Blank Preservation │ │ - Diagnostic Status   │ │   Protection          │
└───────────┬───────────┘ └───────────┬───────────┘ └───────────┬───────────┘
            │                         │                         │
            └─────────────────────────┼─────────────────────────┘
                                      │
                                      ▼
                       ┌───────────────────────────────┐
                       │     PostgreSQL Database       │
                       │  - SystemSetting (Key/Value)  │
                       │  - SettingAuditEvent (Append) │
                       │  - OutboxJob / WorkItem / User│
                       └───────────────────────────────┘
```

### Shared Schema Contracts (`packages/shared/src/index.ts`)

- `GeneralSettingsSchema` & `GeneralSettingsDTO`
- `BrandingSettingsSchema` & `BrandingSettingsDTO`
- `EmailSettingsSchema` & `EmailSettingsDTO`
- `SlaSettingsSchema` & `SlaSettingsDTO`
- `WorkflowSettingsSchema` & `WorkflowSettingsDTO`
- `SecuritySettingsSchema` & `SecuritySettingsDTO`
- `NotificationSettingsSchema` & `NotificationSettingsDTO`
- `SettingAuditEventDTO` & `OutboxQueueStatsDTO`
- `UpdateTeamMemberRoleSchema`, `ToggleUserActiveSchema`, `SendTestEmailSchema`

---

## 3. Implemented Settings Sections & Live Behavioral Effects

### A. General Settings

- **Parameters**: `appName`, `orgName`, `timezone`, `dateFormat`, `timeFormat`, `supportContact`, `maintenanceMode`.
- **Behavioral Impact**:
  - `maintenanceModeMiddleware` checks `maintenanceMode`. When enabled, any non-administrator attempting work item creation or modification (`POST`, `PUT`, `PATCH`, `DELETE` on `/api/v1/items`) is immediately blocked with `HTTP 503 Service Unavailable` (`"Maintenance mode is active. Operational modifications are paused for non-administrators."`).
  - Administrators are permitted to execute emergency fixes and operational actions during maintenance.

### B. Branding & Appearance

- **Parameters**: `appName`, `logoUrl`, `faviconUrl`, `browserTitle`, `primaryColor`, `accentColor`, `themeDefault`, `sidebarTheme`.
- **Behavioral Impact**:
  - Live preview allows operators to test brand colors and logos before committing.
  - Dynamically updates client CSS custom properties (`--primary-blue`, `--primary-blue-hover`).
  - Updates `document.title` and application header / sidebar branding immediately upon boot and upon saving.
  - Validates uploaded logos server-side: rejects unsupported MIME types (requires `image/png`, `image/jpeg`, `image/svg+xml`, `image/webp`) and enforces a 2MB maximum payload limit.

### C. Email Configuration (SMTP)

- **Parameters**: `smtpHost`, `smtpPort`, `smtpUser`, `smtpPassword`, `smtpSecure`, `senderName`, `senderEmail`, `enabled`.
- **Behavioral Impact**:
  - Uses `nodemailer` to create genuine SMTP transports.
  - **Test Connection (`POST /api/v1/settings/email/test-connection`)**: Executes `transporter.verify()` against the designated host and port, recording diagnostic latency or socket failure diagnostics directly into settings state (`lastTestResult`, `lastTestedAt`, `lastTestError`).
  - **Send Test Message (`POST /api/v1/settings/email/send-test`)**: Dispatches a genuine HTML notification email with verified headers and diagnostic content.
  - **Secret Protection**: Stored passwords are never returned in plaintext (`••••••••`), and leaving the password input blank in update submissions preserves the existing stored credential without overwriting it.

### D. SLA & Escalation Engine Integration

- **Parameters**: `durations` (CRITICAL, URGENT, HIGH, MEDIUM, LOW), `warningBufferPercent`, `scanIntervalMinutes`, `escalationProcessingEnabled`.
- **Behavioral Impact**:
  - Directly feeds the Step 6 SLA engine (`sla-calculator.ts` and `sla.service.ts`).
  - When durations are adjusted (e.g., CRITICAL reduced from 120m to 60m), subsequent deadline calculations immediately reflect the shorter commitment window.
  - When `escalationProcessingEnabled` is toggled off, background scans immediately halt processing (`scanned: 0, escalated: 0`).

### E. Teams & Access Control

- **Parameters**: Team membership administration, member role transitions (`VIEWER`, `MEMBER`, `LEAD`, `ADMIN`), account active/inactive toggles.
- **Behavioral Impact**:
  - **Last-Admin Safeguard**: Prevents demoting or removing the sole administrator of a team (`HTTP 400 Bad Request: "Cannot demote this user: A team must have at least one active Administrator."`).
  - **Self-Deactivation Guard**: Prevents an administrator from deactivating their own account (`HTTP 400 Bad Request: "Safety Guard: You cannot deactivate your own account."`).
  - All operations enforce server-side system admin authorization.

### F. Security & Sessions

- **Parameters**: `sessionTimeoutMinutes`, `minPasswordLength`, `requireSpecialChar`, `requireNumber`.
- **Behavioral Impact**:
  - Persists enterprise security policy settings with typed validation.
  - Enforces minimum credential standards across password change workflows.

### G. Workflow & Work Item Defaults

- **Parameters**: `defaultPriority`, `defaultType`, `allowViewerComments`, `requireDueDateForCritical`.
- **Behavioral Impact**:
  - When creating work items, missing priority or type fields default to the configured workflow defaults.
  - When `requireDueDateForCritical` is enabled, any attempt to create a `CRITICAL` item without an explicit `dueDate` is rejected with `HTTP 400 Bad Request`.

### H. Notifications

- **Parameters**: `emailAlertsEnabled`, `notifyOnEscalations`, `notifyOnStatusChange`, `digestFrequency`.
- **Behavioral Impact**:
  - Dictates outbound dispatch policies within the Transactional Outbox worker.

### I. Background Jobs & System Health

- **Parameters**: Read-only Outbox queue metrics and job retry mechanism.
- **Behavioral Impact**:
  - Live query against PostgreSQL `OutboxJob` table returns real job counts grouped by status: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, and `DEAD_LETTER`.
  - **Job Retry (`POST /api/v1/settings/jobs/:id/retry`)**: Idempotently resets a `FAILED` or `DEAD_LETTER` job back to `PENDING` with cleared error messages, scheduling it for immediate worker pickup.

### J. Configuration Audit Trail

- **Parameters**: Append-only log of configuration mutations.
- **Behavioral Impact**:
  - Every update transactionally records an event into `SettingAuditEvent`.
  - Captures actor identity, email, category, key, timestamp, and a calculated diff.
  - **Strict Secret Redaction**: Plaintext secrets (`smtpPassword`) are automatically scrubbed and replaced with `••••••••` prior to audit serialization.

---

## 4. API Endpoints Specification

| Method  | Endpoint                                                | Authorization  | Description                                                     |
| ------- | ------------------------------------------------------- | -------------- | --------------------------------------------------------------- |
| `GET`   | `/api/v1/settings/public/branding`                      | Public         | Read active branding tokens (appName, colors, logoUrl)          |
| `GET`   | `/api/v1/settings/:category`                            | `SYSTEM_ADMIN` | Retrieve typed configuration for a category with masked secrets |
| `PUT`   | `/api/v1/settings/:category`                            | `SYSTEM_ADMIN` | Update configuration, validate with Zod, and log audit event    |
| `POST`  | `/api/v1/settings/branding/logo`                        | `SYSTEM_ADMIN` | Upload and validate Base64 logo (PNG/SVG <= 2MB)                |
| `POST`  | `/api/v1/settings/email/test-connection`                | `SYSTEM_ADMIN` | Execute live SMTP socket verification via Nodemailer            |
| `POST`  | `/api/v1/settings/email/send-test`                      | `SYSTEM_ADMIN` | Send real test email to designated recipient                    |
| `GET`   | `/api/v1/settings/teams/members`                        | `SYSTEM_ADMIN` | List all users and memberships across teams                     |
| `PATCH` | `/api/v1/settings/teams/:teamId/members/:memberId/role` | `SYSTEM_ADMIN` | Update member role with last-admin protection                   |
| `PATCH` | `/api/v1/settings/users/:userId/active`                 | `SYSTEM_ADMIN` | Toggle user active status with self-deactivation protection     |
| `GET`   | `/api/v1/settings/jobs/stats`                           | `SYSTEM_ADMIN` | Query live Outbox queue counters and recent failed jobs         |
| `POST`  | `/api/v1/settings/jobs/:id/retry`                       | `SYSTEM_ADMIN` | Idempotently reset failed job to `PENDING`                      |
| `GET`   | `/api/v1/settings/audit/history`                        | `SYSTEM_ADMIN` | Retrieve append-only configuration audit trail with safe diffs  |

---

## 5. Automated Test Results & Quality Gates

### Test Summary

- **Test Command**: `npm test`
- **Total Test Files**: 14 suites passed (14/14)
- **Total Tests**: 106 tests passed (106/106)
- **Duration**: ~15.5s

### Step 7 Integration Test Scenarios (`tests/integration/settings-configuration.test.ts`):

1. **Scenario 1**: Allows unauthenticated access to public branding settings without exposing private config.
2. **Scenario 2**: Denies non-admin users with `403 Forbidden` on settings routes.
3. **Scenario 3**: Reads and updates General settings with persistence in PostgreSQL.
4. **Scenario 4**: Validates input schemas and rejects invalid data with `422 Unprocessable Entity`.
5. **Scenario 5**: Masks SMTP password in responses and preserves saved secret when blank password submitted.
6. **Scenario 6**: Validates logo upload data, rejecting unsupported MIME types and oversized assets (>2MB).
7. **Scenario 7**: Maintenance mode blocks non-admin work-item mutations with `503 Service Unavailable`, but permits admins.
8. **Scenario 8**: Dynamic SLA settings immediately adjust calculation and escalation thresholds, respecting pause toggle.
9. **Scenario 9**: Prevents administrator from demoting or removing the last administrator of a team.
10. **Scenario 10**: Queries live background outbox queue health and retries dead-letter jobs.
11. **Scenario 11**: Records append-only configuration audit trail with secrets strictly redacted.
12. **Scenario 12**: SMTP test connection responds gracefully with diagnostic results.

### Code Quality Gates:

- `npm run typecheck`: **0 errors** (`tsc --noEmit`).
- `npm run lint`: **0 errors, 0 warnings** (`eslint .`).
- `npm run format:check`: **100% compliant** (`prettier --check`).
- `npm run build:api`: Clean compilation via `tsc -p apps/api/tsconfig.json`.
- `npm run build:web`: Clean production build via Vite (`dist/assets/index-DQCC4mdB.js 264.73 kB`).

---

## 6. Manual Verification Checklist

1. **Accessing Settings**:
   - Log in as `alice.admin@newtonite.dev` (`Demo@Newtonite2026!`).
   - Notice the **Settings** navigation link in the sidebar with an Admin badge.
   - Click **Settings**; verify all 10 tabs render cleanly with responsive navigation.
2. **Non-Admin Denial**:
   - Log in as `evan.member@newtonite.dev` (`Demo@Newtonite2026!`).
   - Verify the **Settings** menu item is completely hidden from the sidebar.
   - Attempt direct API navigation (`GET /api/v1/settings/general`); verify `HTTP 403 Forbidden` response.
3. **Branding & Theming**:
   - Navigate to **Branding & Appearance**. Change primary color to `#10b981` (Emerald).
   - Verify the live color swatch preview updates immediately.
   - Click **Save Changes**. Verify application headers and sidebar accents update dynamically.
4. **Email Configuration**:
   - Navigate to **Email (SMTP)**. Enter `smtp.mailtrap.io`, port `587`, and a username.
   - Verify the password field is displayed as masked (`••••••••`).
   - Click **Test Connection**. Verify active connection diagnostics display under the action button.
5. **Team Admin Safeguards**:
   - Navigate to **Teams & Access**. Select **Core Operations**.
   - Attempt to demote `Alice Admin` to `Member`.
   - Verify the error alert triggers: _"A team must have at least one active Administrator"_.
6. **Maintenance Mode**:
   - In **General Settings**, toggle **Maintenance Mode** to enabled and save.
   - Log in as `Evan Member` in another browser window and attempt to create a work item.
   - Verify `HTTP 503 Maintenance Mode` alert prevents creation.
7. **Audit Trail**:
   - Navigate to **Configuration Audit**.
   - Verify every setting modification performed above is listed with actor email, timestamp, and a redacted before/after diff.
