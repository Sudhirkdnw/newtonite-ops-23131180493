# Known Limitations & Release Boundary (Step 9)

This document explicitly lists features that are **implemented and verified in Steps 1–9** versus architectural extensions that remain **known boundaries**.

---

## Status of Critical Behaviors Beyond CRUD

| #   | Capability                                            | Current Status in Step 6                                                                                                                                                                                                                                                                                                                                                                                                                 | Verification & Tests                                               |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | **Concurrent Work-Item Claim**                        | **VERIFIED** ✅ Atomic conditional database update (`WHERE id = :id AND assigneeId IS NULL`) with affected-row count checking. Exactly one winner permitted, all concurrent competitors receive HTTP 409 Conflict.                                                                                                                                                                                                                       | `concurrency.test.ts`, `end-to-end-user-flows.test.ts`             |
| 2   | **Optimistic Locking for Stale Updates**              | **VERIFIED** ✅ Version-token optimistic concurrency on `PATCH /items/:id`. Stale submitted versions rejected with HTTP 409 Conflict returning current and submitted versions without altering DB or history.                                                                                                                                                                                                                            | `concurrency.test.ts`, `end-to-end-user-flows.test.ts`             |
| 3   | **Idempotency for Repeated Requests**                 | **VERIFIED** ✅ Standard `Idempotency-Key` header with SHA-256 fingerprinting. Identical retries replay cached response with `X-Cache-Lookup: HIT`. Payload tampering on reused key rejected with 409 Conflict.                                                                                                                                                                                                                          | `idempotency.test.ts`, `end-to-end-user-flows.test.ts`             |
| 4   | **Server-Enforced Workflow Rules & Lead Approval**    | **VERIFIED** ✅ Centralized workflow state machine with allowed-transition map. `IN_REVIEW -> COMPLETED` approval strictly restricted to Lead and Admin roles with `WORKFLOW_APPROVED` audit events.                                                                                                                                                                                                                                     | `work-items.test.ts`, `end-to-end-user-flows.test.ts`              |
| 5   | **Resource-Level Authorization (Multi-Team RBAC)**    | **VERIFIED** ✅ Full role hierarchy (`VIEWER` < `MEMBER` < `LEAD` < `ADMIN`). Strict cross-team resource isolation returning `HTTP 404 Not Found` to prevent enumeration and oracle attacks.                                                                                                                                                                                                                                             | `work-items.test.ts`, `end-to-end-user-flows.test.ts`              |
| 6   | **Reliable Asynchronous Processing — Outbox Pattern** | **VERIFIED** ✅ Outbox jobs inserted atomically in same Prisma transaction as business entity. Worker claims jobs with atomic lock, implements exponential backoff retry, and enforces max retry failure state.                                                                                                                                                                                                                          | `outbox.test.ts`                                                   |
| 7   | **Optimistic UI Reconciliation Pattern**              | **VERIFIED** ✅ Snapshotting, optimistic local patching, automatic rollback on 409 Conflict with server reconciliation, and rollback on 403 authorization denial.                                                                                                                                                                                                                                                                        | `optimistic-reconciliation.test.ts`, `frontend-operations.test.ts` |
| 8   | **Production-Oriented SLA & Escalation Engine**       | **VERIFIED** ✅ Priority-specific SLA calculation, server-side deadline tracking, atomic conditional escalation, ActivityEvent (ESCALATED), OutboxJob (WORK_ITEM_ESCALATED), and team-scoped SLA overview metrics.                                                                                                                                                                                                                       | `sla-calculator.test.ts`, `sla-escalation.test.ts`                 |
| 9   | **Centralized Settings & Configuration Center**       | **VERIFIED** ✅ 10 settings sections, PostgreSQL typed persistence, secret masking (`••••••••`), blank preservation, maintenance mode 503 blocking, live CSS branding variables, real nodemailer SMTP test, dynamic SLA durations, team admin safeguards, live outbox stats, job retry, and append-only redacted audit trail.                                                                                                            | `settings-configuration.test.ts`                                   |
| 10  | **Secure AI Operations Assistant**                    | **VERIFIED** ✅ Provider abstraction using official `@google/genai` SDK, MockAiProvider fallback for tests, server-side secret management with masking, prompt injection defense with `<untrusted_content>` containment and secret redaction, strict team RBAC isolation (404 on cross-team items), deterministic SLA operational analytics, editable email drafting with required human confirmation, and sliding-window rate limiting. | `ai-assistant.integration.test.ts`                                 |

---

## Implemented and Verified in Steps 1–9:

- **Full-Stack Monorepo**: Single unified `package.json` with Express TypeScript backend, React Vite frontend, and shared domain contracts.
- **Relational PostgreSQL Schema**: Models for `User`, `Team`, `Membership`, `WorkItem`, `ActivityEvent`, `Comment`, `IdempotencyKey`, `OutboxJob`, `SystemSetting`, and `SettingAuditEvent`.
- **Deterministic Seed Data**: 4 operational teams, 10 seeded users across roles, and 10 work items with activities and comments.
- **Enterprise Operations Dashboard UI**:
  - Operational SLA Performance Overview Banner (Active Operations, Within SLA, SLA At Risk, SLA Breached).
  - Urgent SLA Escalations Attention Queue rendering countdown timers and overdue badges.
  - 5 Operational Command Queues (Assigned to Me, Unassigned Urgent, Awaiting Approval, Attention Required, Recent Items).
  - Filterable Work Items Registry with server-side keyset cursor pagination (`cursor`, `limit`, `hasMore`, `nextCursor`) and SLA Deadline column.
  - Work Item Detail View with metadata, SLA Commitment status, immutable audit timeline, discussion comments, and permitted actions.
  - Create and Edit Work Items forms with live validation and idempotency tokens.
  - State Transition Modal with audit reason input and Lead approval checks.
- **Centralized Settings & Configuration Center (Step 7)**:
  - 11-Tab Admin Configuration Layout (including AI Operations Assistant tab) with dirty form tracking, live color pickers, and logo preview.
  - General Settings with real Maintenance Mode blocking non-admin work-item mutations with HTTP 503.
  - Branding Settings with live CSS variable injection (`--primary-blue`, `--primary-blue-hover`), logo upload validation (PNG/SVG, 2MB max), browser title and document favicon updates.
  - Email Settings with SMTP secret masking (`••••••••`), blank-password preservation, active socket verification via `nodemailer`, and real test email sending modal.
  - SLA & Escalation Settings driving live calculations in the SLA engine and background escalation pausing.
  - AI Assistant Settings allowing dynamic API key configuration with server-side masking, model selection, temperature tuning, and system prompt customization.
  - Teams & Access Control with role changes, user activation toggling, last-admin demotion prevention, and self-deactivation safeguards.
  - Workflow & Work Item Defaults driving default priorities, default types, and critical item due-date requirements.
  - Security & Notification Settings with typed parameter persistence and audit tracking.
  - Background Jobs & System Health with real-time Outbox queue counters (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `DEAD_LETTER`) and idempotent job retry.
  - Append-Only Configuration Audit Trail recording actors, timestamps, and safe diffs with secrets strictly redacted.
- **AI Operations Assistant (Step 8)**:
  - Full-featured assistant panel with provider diagnostics badge (Active vs Mock vs Not Configured).
  - 6 Suggested Prompts (Urgent Overdue, Approaching SLA, Incident Summary, Root Cause, Next Steps, Email Draft).
  - Team selector and Work Item picker scoping operational queries to authorized contexts.
  - Distinctive "AI Generated • Verified Database Context" badge, clickable referenced work items, and clear separation of confirmed facts from AI-generated hypotheses.
  - Editable escalation email draft generator with explicit confirmation modal before any outbox queueing.
  - Complete security hardening: prompt injection defense via `<untrusted_content>` containment, credential scrubbing, 10s execution timeouts, sliding-window rate limiting (30 requests/min), and strict team RBAC.
- **119 Automated Tests** passing across 15 test suites with 100% test success rate.

---

## Known Boundaries & Future Extensions:

- **AI Model Token Budgeting & Context Windows**: Context sizes for work items and operational queries are bounded (top 20 overdue, top 30 approaching, 2,000 char descriptions) to avoid token limit overflow and keep response latencies low (<2s). Large multi-ticket bulk queries should use pagination.
- **Autonomous Action Boundary**: The AI Assistant operates strictly in read-only analysis and draft mode; it is deliberately forbidden from performing autonomous state transitions or sending unapproved emails to prevent liability and accidental operational mutations.
- **Branding Asset Storage**: Logo branding uploads use validated Base64 data URIs stored directly in PostgreSQL JSONB with a strict 2MB limit and image MIME verification. Production cloud deployments can configure S3/GCS bucket adapters without altering client contracts.
- **Email Relay Dependencies**: Email test actions attempt genuine SMTP connections via Nodemailer. In isolated offline test environments, network connection failures (`ENOTFOUND`) are recorded gracefully in settings diagnostics without crashing.
- **Live Push Subscriptions / WebSockets**: The current frontend polls the `/api/v1/ready` health endpoint every 15 seconds and refreshes state on demand. Future extensions could introduce SSE (Server-Sent Events) or WebSockets for instant live streaming.
- **Session Scoping**: Tokens are held in `sessionStorage` per browser tab to allow simultaneous multi-role testing; opening a new tab requires re-authentication.
