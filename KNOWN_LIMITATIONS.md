# Known Limitations & Step 3 Boundary

This document explicitly lists features that are **implemented and tested in Step 3** versus those that remain **pending for subsequent implementation steps** (Frontend UI Dashboard & Observability Metrics).

---

## Status of Critical Behaviors Beyond CRUD

| #   | Capability                                            | Current Status in Step 3                                                                                                                                                                                                       | Verification & Tests Added          |
| --- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| 1   | **Concurrent Work-Item Claim**                        | **IMPLEMENTED & TESTED** ✅ Atomic conditional database update (`WHERE id = :id AND assigneeId IS NULL`) with affected-row count checking. Exactly one winner permitted, all concurrent competitors receive HTTP 409 Conflict. | `concurrency.test.ts`               |
| 2   | **Optimistic Locking for Stale Updates**              | **IMPLEMENTED & TESTED** ✅ Version-token optimistic concurrency on `PATCH /items/:id`. Stale submitted versions rejected with HTTP 409 Conflict returning current and submitted versions without altering DB or history.      | `concurrency.test.ts`               |
| 3   | **Idempotency for Repeated Requests**                 | **IMPLEMENTED & TESTED** ✅ Standard `Idempotency-Key` header with SHA-256 fingerprinting. Identical retries replay cached response with `X-Cache-Lookup: HIT`. Payload tampering on reused key rejected with 409 Conflict.    | `idempotency.test.ts`               |
| 4   | **Server-Enforced Workflow Rules & Lead Approval**    | **IMPLEMENTED & TESTED** ✅ Centralized workflow state machine with allowed-transition map. `IN_REVIEW -> COMPLETED` approval strictly restricted to Lead and Admin roles with `WORKFLOW_APPROVED` audit events.               | `work-items.test.ts`                |
| 5   | **Resource-Level Authorization (Multi-Team RBAC)**    | **IMPLEMENTED & TESTED** ✅ Full role hierarchy (`VIEWER` < `MEMBER` < `LEAD` < `ADMIN`). Strict cross-team resource isolation returning `HTTP 404 Not Found` to prevent enumeration and oracle attacks.                       | `work-items.test.ts`                |
| 6   | **Reliable Asynchronous Processing — Outbox Pattern** | **IMPLEMENTED & TESTED** ✅ Outbox jobs inserted atomically in same Prisma transaction as business entity. Worker claims jobs with atomic lock, implements exponential backoff retry, and enforces max retry failure state.    | `outbox.test.ts`                    |
| 7   | **Optimistic UI Reconciliation Pattern**              | **IMPLEMENTED & TESTED** ✅ Snapshotting, optimistic local patching, automatic rollback on 409 Conflict with server reconciliation, and rollback on 403 authorization denial.                                                  | `optimistic-reconciliation.test.ts` |

---

## Implemented in Step 3:

- Atomic conditional claiming with 10-operator concurrent stress testing (`Promise.all`).
- Version-based optimistic locking with HTTP 409 conflict diagnostics.
- Idempotency middleware with payload fingerprinting and cache playback.
- Transactional Outbox pattern with atomic scheduling, exponential backoff retries, and failure dead-lettering.
- Optimistic UI reconciler and React hook (`useOptimisticWorkItem`).
- 52 integration tests passing across 9 test suites with 100% test pass rate.

---

## Pending for Step 4 & Beyond:

- **Interactive Operations Dashboard UI**: Visual triage Kanban board, live filters, claim/transition buttons, and activity audit drawer (planned for Step 4).
- **Live Push Subscriptions / WebSockets**: Optional real-time board updates beyond HTTP polling.
- **Prometheus Metrics Endpoint**: `/metrics` capturing claim race contention rates and outbox latency (planned for Step 5).
