# Known Limitations & Step 6 Boundary

This document explicitly lists features that are **implemented and verified in Steps 1–6** versus architectural extensions that remain **known boundaries**.

---

## Status of Critical Behaviors Beyond CRUD

| #   | Capability                                            | Current Status in Step 6                                                                                                                                                                                           | Verification & Tests                                               |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| 1   | **Concurrent Work-Item Claim**                        | **VERIFIED** ✅ Atomic conditional database update (`WHERE id = :id AND assigneeId IS NULL`) with affected-row count checking. Exactly one winner permitted, all concurrent competitors receive HTTP 409 Conflict. | `concurrency.test.ts`, `end-to-end-user-flows.test.ts`             |
| 2   | **Optimistic Locking for Stale Updates**              | **VERIFIED** ✅ Version-token optimistic concurrency on `PATCH /items/:id`. Stale submitted versions rejected with HTTP 409 Conflict returning current and submitted versions without altering DB or history.      | `concurrency.test.ts`, `end-to-end-user-flows.test.ts`             |
| 3   | **Idempotency for Repeated Requests**                 | **VERIFIED** ✅ Standard `Idempotency-Key` header with SHA-256 fingerprinting. Identical retries replay cached response with `X-Cache-Lookup: HIT`. Payload tampering on reused key rejected with 409 Conflict.    | `idempotency.test.ts`, `end-to-end-user-flows.test.ts`             |
| 4   | **Server-Enforced Workflow Rules & Lead Approval**    | **VERIFIED** ✅ Centralized workflow state machine with allowed-transition map. `IN_REVIEW -> COMPLETED` approval strictly restricted to Lead and Admin roles with `WORKFLOW_APPROVED` audit events.               | `work-items.test.ts`, `end-to-end-user-flows.test.ts`              |
| 5   | **Resource-Level Authorization (Multi-Team RBAC)**    | **VERIFIED** ✅ Full role hierarchy (`VIEWER` < `MEMBER` < `LEAD` < `ADMIN`). Strict cross-team resource isolation returning `HTTP 404 Not Found` to prevent enumeration and oracle attacks.                       | `work-items.test.ts`, `end-to-end-user-flows.test.ts`              |
| 6   | **Reliable Asynchronous Processing — Outbox Pattern** | **VERIFIED** ✅ Outbox jobs inserted atomically in same Prisma transaction as business entity. Worker claims jobs with atomic lock, implements exponential backoff retry, and enforces max retry failure state.    | `outbox.test.ts`                                                   |
| 7   | **Optimistic UI Reconciliation Pattern**              | **VERIFIED** ✅ Snapshotting, optimistic local patching, automatic rollback on 409 Conflict with server reconciliation, and rollback on 403 authorization denial.                                                  | `optimistic-reconciliation.test.ts`, `frontend-operations.test.ts` |
| 8   | **Production-Oriented SLA & Escalation Engine**       | **VERIFIED** ✅ Priority-specific SLA calculation, server-side deadline tracking, atomic conditional escalation, ActivityEvent (ESCALATED), OutboxJob (WORK_ITEM_ESCALATED), and team-scoped SLA overview metrics.       | `sla-calculator.test.ts`, `sla-escalation.test.ts`               |

---

## Implemented and Verified in Steps 1–6:

- **Full-Stack Monorepo**: Single unified `package.json` with Express TypeScript backend, React Vite frontend, and shared domain contracts.
- **Relational PostgreSQL Schema**: Models for `User`, `Team`, `Membership`, `WorkItem`, `ActivityEvent`, `Comment`, `IdempotencyKey`, and `OutboxJob`.
- **Deterministic Seed Data**: 4 operational teams, 10 seeded users across roles, and 10 work items with activities and comments.
- **Enterprise Operations Dashboard UI**:
  - Operational SLA Performance Overview Banner (Active Operations, Within SLA, SLA At Risk, SLA Breached).
  - Urgent SLA Escalations Attention Queue rendering countdown timers and overdue badges.
  - 5 Operational Command Queues (Assigned to Me, Unassigned Urgent, Awaiting Approval, Attention Required, Recent Items).
  - Filterable Work Items Registry with server-side keyset cursor pagination (`cursor`, `limit`, `hasMore`, `nextCursor`) and SLA Deadline column.
  - Work Item Detail View with metadata, SLA Commitment status, immutable audit timeline, discussion comments, and permitted actions.
  - Create and Edit Work Items forms with live validation and idempotency tokens.
  - State Transition Modal with audit reason input and Lead approval checks.
- **SLA & Escalation Engine**:
  - Configurable SLA durations by priority (`CRITICAL: 2h`, `URGENT: 6h`, `HIGH: 24h`, `MEDIUM: 72h`, `LOW: 168h`).
  - Deterministic target deadline derivation: `min(dueDate, slaDeadline)` ensuring operator schedules are honored without bypassing contractual maximums.
  - Idempotent atomic conditional escalation updates (`WHERE id = :id AND lastEscalationStatus = :old`).
  - Terminal state exclusion: closed items (`COMPLETED`, `CANCELLED`) never generate active escalations.
  - Asynchronous event dispatching via Outbox pattern with zero duplicate timeline events.
- **94 Automated Tests** passing across 13 test suites with 100% test success rate.

---

## Known Boundaries & Future Extensions:

- **Live Push Subscriptions / WebSockets**: The current frontend polls the `/api/v1/ready` health endpoint every 15 seconds and refreshes state on demand. Future extensions could introduce SSE (Server-Sent Events) or WebSockets for instant live streaming.
- **Outbox External Dispatchers**: The Outbox Worker polls and processes jobs with exponential backoff and dead-lettering, logging dispatched events. Real webhook delivery to third-party endpoints (e.g. Slack/PagerDuty) uses local dispatchers.
- **Session Scoping**: Tokens are held in `sessionStorage` per browser tab to allow simultaneous multi-role testing; opening a new tab requires re-authentication.
