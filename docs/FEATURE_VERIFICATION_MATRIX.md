# Feature Verification Matrix — Newtonite Ops

> **Document Version:** 1.0.0  
> **Evaluation Scope:** Steps 1–9 Complete Verification  
> **Environment:** Node.js v24+, React 18, Vite, Express, PostgreSQL 16+, Prisma ORM  
> **Automated Test Results:** 15 Test Files, 119/119 Tests Passing (100%)

---

## 1. Classification Scheme

Every feature is classified strictly according to the five standardized categories:

1. **[VERIFIED]** Implemented and verified end-to-end against live database and runtime.
2. **[FAILING]** Implemented but currently failing.
3. **[PARTIAL]** Partially implemented with functional gaps.
4. **[MISSING]** Missing or not connected to the real backend.
5. **[UNTESTABLE]** Not testable in the current local/offline environment without external infrastructure.

---

## 2. Core Operational Features Matrix

| Feature / Subsystem                     | Target Layer |     Status     | Primary Test / Verification Method                         | Verified Scenarios & Edge Cases                                                                                                                                   |
| :-------------------------------------- | :----------- | :------------: | :--------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **User Authentication**                 | API / Web    | **[VERIFIED]** | `auth.test.ts`, Browser agent                              | Valid credentials return JWT; invalid password returns 401; missing fields return 422; expired token returns 401; tampered signature rejected.                    |
| **Session Scoping & Logout**            | API / Web    | **[VERIFIED]** | `auth.test.ts`, `AppLayout.tsx`                            | Tokens stored securely in sessionStorage; `GET /api/v1/auth/me` validates session; Logout clears token and redirects to login screen.                             |
| **Multi-Team RBAC Hierarchy**           | API / Shared | **[VERIFIED]** | `work-items.test.ts`, `end-to-end-user-flows.test.ts`      | 4 roles enforced: `VIEWER`, `MEMBER`, `LEAD`, `ADMIN`. Viewers cannot mutate items (403); Members cannot approve (403); Leads and Admins can approve transitions. |
| **Cross-Team Resource Isolation**       | API / DB     | **[VERIFIED]** | `work-items.test.ts`, `ai-assistant.integration.test.ts`   | Accessing work items from unassigned team returns 404 Not Found to prevent metadata enumeration attacks.                                                          |
| **Dashboard Metrics Aggregation**       | API / Web    | **[VERIFIED]** | `DashboardPage.tsx`, browser agent                         | Aggregates Total Active, Within SLA, SLA At Risk (≤25% left), and SLA Breached across the active team context.                                                    |
| **Work Items Registry (List & Keyset)** | API / Web    | **[VERIFIED]** | `work-items.test.ts`, `WorkItemsPage.tsx`                  | Stable keyset pagination (`cursor`, `limit`, `hasMore`, `nextCursor`); sorting by priority, status, and creation date.                                            |
| **Work Item Creation & Validation**     | Full-Stack   | **[VERIFIED]** | `idempotency.test.ts`, `WorkItemFormModal.tsx`             | Validates title length (3–255), description (<4000), team scoping; returns 201 Created; auto-increments version to 1.                                             |
| **Atomic Conditional Claiming**         | API / DB     | **[VERIFIED]** | `concurrency.test.ts`                                      | Atomic query `WHERE id = :id AND assigneeId IS NULL`; concurrent claims produce exactly 1 winner (200) and competitor receives 409 Conflict.                      |
| **Optimistic Concurrency Locking**      | API / Web    | **[VERIFIED]** | `concurrency.test.ts`, `optimistic-reconciliation.test.ts` | `PATCH /items/:id` verifies submitted version against database version; stale writes fail with 409 Conflict without modifying database or history.                |
| **Idempotency Protection**              | API / DB     | **[VERIFIED]** | `idempotency.test.ts`                                      | SHA-256 payload fingerprinting; identical retries return cached result with `X-Cache-Lookup: HIT`; payload tampering returns 409 Conflict.                        |
| **Workflow State Machine**              | API / Web    | **[VERIFIED]** | `work-items.test.ts`, `TransitionModal.tsx`                | Enforces valid transitions: `BACKLOG -> TRIAGED -> IN_PROGRESS -> IN_REVIEW -> COMPLETED`. Disallowed jumps return 422 Unprocessable Entity.                      |
| **Lead / Admin Approval Gate**          | API / Shared | **[VERIFIED]** | `work-items.test.ts`                                       | Approving items from `IN_REVIEW -> COMPLETED` requires `LEAD` or `ADMIN` role and records `WORKFLOW_APPROVED` event.                                              |
| **Work Item Comments & Discussions**    | Full-Stack   | **[VERIFIED]** | `work-items.test.ts`, `WorkItemDetailPage.tsx`             | Author validation; team-scoped retrieval; comments record activity events and update work item timestamp.                                                         |
| **Immutable Activity Audit Trail**      | API / DB     | **[VERIFIED]** | `work-items.test.ts`, `WorkItemDetailPage.tsx`             | Append-only `ActivityEvent` records: `CREATED`, `CLAIMED`, `ASSIGNED`, `STATUS_CHANGED`, `COMMENTED`, `ESCALATED`, `WORKFLOW_APPROVED`.                           |

---

## 3. SLA & Escalation Engine Matrix

| Feature / Subsystem                 | Target Layer     |     Status     | Primary Test / Verification Method | Verified Scenarios & Edge Cases                                                                                                                    |
| :---------------------------------- | :--------------- | :------------: | :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Priority-Specific SLA Durations** | API / Shared     | **[VERIFIED]** | `sla-calculator.test.ts`           | Calculates deadlines: Critical (1h), Urgent (4h), High (12h), Medium (24h), Low (48h). Dynamic overrides supported from System Settings.           |
| **Risk Threshold Calculation**      | API / Shared     | **[VERIFIED]** | `sla-calculator.test.ts`           | Classifies items: `HEALTHY` (>25% remaining), `AT_RISK` (≤25% remaining), `BREACHED` (deadline passed). Completed items remain `COMPLETED`.        |
| **Server-Side Escalation Worker**   | API / Background | **[VERIFIED]** | `sla-escalation.test.ts`           | Scans overdue and at-risk items; updates `lastEscalationStatus` atomically; records `ESCALATED` activity; queues `WORK_ITEM_ESCALATED` outbox job. |
| **Duplicate Escalation Prevention** | API / DB         | **[VERIFIED]** | `sla-escalation.test.ts`           | Idempotent scan prevents repeated notifications for the same escalation level; back-to-back runs produce 0 duplicate records.                      |
| **Dashboard SLA Countdown Visuals** | Web              | **[VERIFIED]** | `DashboardPage.tsx`, browser agent | Overdue badges render `Breached (Xm overdue)`; approaching items render `At Risk (Xm left)`; updates dynamically in UI.                            |

---

## 4. Settings & Configuration Center Matrix

| Feature / Subsystem                    | Target Layer |     Status     | Primary Test / Verification Method                   | Verified Scenarios & Edge Cases                                                                                                       |
| :------------------------------------- | :----------- | :------------: | :--------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ |
| **General Settings & Maintenance**     | API / Web    | **[VERIFIED]** | `settings-configuration.test.ts`                     | Admin can toggle Maintenance Mode; non-admin work-item mutations blocked with 503 Service Unavailable; admin access preserved.        |
| **Branding & Appearance**              | Full-Stack   | **[VERIFIED]** | `SettingsPage.tsx`, browser agent                    | Updates app name, primary color, accent color; dynamic CSS variable injection (`--primary-blue`); persistent localStorage logo cache. |
| **Logo Upload Validation**             | Full-Stack   | **[VERIFIED]** | `settings-configuration.test.ts`                     | Rejects non-image MIME types (400); rejects files >2MB (413); stores valid PNG/SVG as Base64 in PostgreSQL JSONB.                     |
| **Email SMTP Configuration**           | API / Web    | **[VERIFIED]** | `settings-configuration.test.ts`, `email.service.ts` | Redacts SMTP passwords (`••••••••`); preserves existing password if left blank; verifies socket connection; tests message sending.    |
| **Dynamic SLA Durations**              | Full-Stack   | **[VERIFIED]** | `settings-configuration.test.ts`, `sla.service.ts`   | Admins can customize resolution hours per priority; changes take effect immediately in SLA calculator and escalation worker.          |
| **Workflow Defaults & Rules**          | Full-Stack   | **[VERIFIED]** | `settings-configuration.test.ts`                     | Configures default priority, default type, and required due dates for Critical items.                                                 |
| **Team Management & User Accounts**    | Full-Stack   | **[VERIFIED]** | `TeamListPage.tsx`, `teams-admin.service.ts`         | Create new users with instant team allocation; add existing users to teams; change team roles; toggle user active status.             |
| **Security Safeguards (Anti-Lockout)** | API / Web    | **[VERIFIED]** | `settings-configuration.test.ts`                     | Prevents demoting the last active ADMIN; prevents self-deactivation of logged-in admin account.                                       |
| **Background Jobs & Outbox Queue**     | Full-Stack   | **[VERIFIED]** | `settings-configuration.test.ts`, `outbox.test.ts`   | Real-time queue metrics (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `DEAD_LETTER`); manual idempotent retry trigger.             |
| **Append-Only Config Audit Trail**     | API / DB     | **[VERIFIED]** | `settings-configuration.test.ts`                     | Every setting mutation logs `SettingAuditEvent` with actor, timestamp, category, and sanitized old/new JSON diffs.                    |

---

## 5. AI Operations Assistant Matrix

| Feature / Subsystem                   | Target Layer |     Status     | Primary Test / Verification Method                        | Verified Scenarios & Edge Cases                                                                                                                    |
| :------------------------------------ | :----------- | :------------: | :-------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Multi-Provider Architecture**       | API          | **[VERIFIED]** | `ai-assistant.integration.test.ts`                        | Provider abstraction supporting Groq Cloud (`llama-3.1-8b-instant`, `llama-3.3-70b-versatile`), Google Gemini, and deterministic `MockAiProvider`. |
| **Context Assembly & RBAC Isolation** | API          | **[VERIFIED]** | `ai-assistant.integration.test.ts`                        | Queries strictly scoped to user's authorized team; querying items from unauthorized teams returns 404 Not Found.                                   |
| **Prompt Injection Resistance**       | API          | **[VERIFIED]** | `ai-assistant.integration.test.ts`                        | Work item titles, descriptions, and comments wrapped in `<untrusted_content>` tags; system prompt instructs LLM to ignore instruction overrides.   |
| **Sensitive Secret Redaction**        | API          | **[VERIFIED]** | `ai-assistant.integration.test.ts`                        | Database passwords, API keys, JWT tokens, and SMTP credentials automatically redacted from context before LLM prompt generation.                   |
| **Sliding-Window Rate Limiting**      | API          | **[VERIFIED]** | `ai-assistant.integration.test.ts`                        | Limits users to 30 requests per minute per user; bursts exceeding limit rejected with HTTP 429 Too Many Requests.                                  |
| **Escalation Email Drafting**         | Full-Stack   | **[VERIFIED]** | `ai-assistant.integration.test.ts`, `AiAssistantPage.tsx` | AI generates structured subject and body based on SLA overdue status; user reviews and edits draft; requires explicit human confirmation.          |
| **AI Assistant UI Workspace**         | Web          | **[VERIFIED]** | `AiAssistantPage.tsx`, browser agent                      | Diagnostics badge (Active/Mock/Not Configured); 6 operational quick prompts; referenced work item links; markdown rendering.                       |

---

## 6. Background Workers & Outbox Matrix

| Feature / Subsystem                | Target Layer     |     Status     | Primary Test / Verification Method | Verified Scenarios & Edge Cases                                                                                                                   |
| :--------------------------------- | :--------------- | :------------: | :--------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Transactional Outbox Insertion** | API / DB         | **[VERIFIED]** | `outbox.test.ts`                   | Outbox jobs inserted within the exact same database transaction as work item mutations, guaranteeing zero orphaned events.                        |
| **Atomic Worker Job Claim**        | API / DB         | **[VERIFIED]** | `outbox.test.ts`                   | Worker uses conditional update with row-locking to ensure each job is claimed by exactly one runner process.                                      |
| **Exponential Backoff & Retries**  | API / Background | **[VERIFIED]** | `outbox.test.ts`                   | Transient failures increment `attempts` count and reschedule execution with exponential backoff: $t_{retry} = 2^{attempts} \times 1000\text{ms}$. |
| **Dead-Letter State Handling**     | API / Background | **[VERIFIED]** | `outbox.test.ts`                   | Jobs exceeding `maxAttempts` (3) transition to `DEAD_LETTER` with recorded `lastError`; admins can inspect and retry via Settings Center.         |

---

## 7. Infrastructure, Health, and Operational Gates

| Component                      | Target Layer    |     Status     | Primary Test / Verification Method                | Verified Scenarios & Edge Cases                                                                                   |
| :----------------------------- | :-------------- | :------------: | :------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------- |
| **Database Migrations**        | DB / Prisma     | **[VERIFIED]** | `npx prisma migrate status`                       | 3 migrations verified and up to date against PostgreSQL.                                                          |
| **Database Seeding**           | DB / TypeScript | **[VERIFIED]** | `prisma/seed.ts`                                  | Deterministic seed data: 4 teams, 10 users, 10 work items with activities and comments.                           |
| **Health Probe (`/health`)**   | API             | **[VERIFIED]** | `health.test.ts`, `Invoke-RestMethod`             | Returns 200 OK with `uptimeSeconds`, `environment`, `version`.                                                    |
| **Readiness Probe (`/ready`)** | API / DB        | **[VERIFIED]** | `health.integration.test.ts`, `Invoke-RestMethod` | Performs live `SELECT 1` database query; returns 200 OK with latency in ms; returns 503 if database disconnected. |
| **TypeScript Typecheck**       | Monorepo        | **[VERIFIED]** | `npm run typecheck` (`tsc --noEmit`)              | 0 type errors across all packages (`apps/api`, `apps/web`, `packages/shared`, `tests`).                           |
| **ESLint Quality Check**       | Monorepo        | **[VERIFIED]** | `npm run lint`                                    | 0 errors and 0 warnings across entire workspace.                                                                  |
| **Prettier Formatting**        | Monorepo        | **[VERIFIED]** | `npm run format:check`                            | 100% compliant with Prettier code style.                                                                          |
| **Production API Build**       | Monorepo        | **[VERIFIED]** | `npm run build:api`                               | Compiles clean TypeScript to `dist/apps/api`.                                                                     |
| **Production Web Build**       | Monorepo        | **[VERIFIED]** | `npm run build:web`                               | Vite bundle created: `dist/index.html` (0.84 kB), JS bundle (394.96 kB), CSS bundle (2.46 kB).                    |
