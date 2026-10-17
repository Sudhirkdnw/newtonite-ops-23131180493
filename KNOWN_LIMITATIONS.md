# Known Limitations & Step 2 Boundary

This document explicitly lists features that are **implemented in Step 2** versus those that remain **pending for subsequent implementation steps** in the Newtonite Operations Under Pressure platform.

---

## Status of Critical Behaviors

| #   | Capability                                               | Current Status in Step 2                                                                                                                                                                                                    | Planned Implementation Step        |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | **Concurrent Claim**                                     | Basic claim API (`POST /api/v1/items/:id/claim`) is implemented with role checking and assigned status conflict checking. Advanced atomic conditional concurrency stress testing under parallel requests is scheduled next. | Step 3 (High-Pressure Concurrency) |
| 2   | **Stale-Version Update Handling**                        | Version field increments on updates. Explicit HTTP 409 `If-Match` optimistic concurrency middleware and conflict recovery handling is prepared for next step.                                                               | Step 3 (High-Pressure Concurrency) |
| 3   | **Idempotency Replay**                                   | Schema ready (`IdempotencyKey` table with unique constraint and response cache fields). Middleware interceptor and replay cache pending.                                                                                    | Step 4 (Reliability & Resilience)  |
| 4   | **Server-Enforced Workflow Transitions & Lead Approval** | **IMPLEMENTED & TESTED** ✅ State machine transition map enforced; `IN_REVIEW -> COMPLETED` approval strictly restricted to Lead and Admin roles with `WORKFLOW_APPROVED` audit events.                                     | Completed in Step 2                |
| 5   | **Resource-Level Authorization (Team & Role Scoped)**    | **IMPLEMENTED & TESTED** ✅ JWT auth, team membership resolution, permission matrix (Viewer/Member/Lead/Admin), and cross-team 404 isolation enforced.                                                                      | Completed in Step 2                |
| 6   | **Transactional Outbox Worker**                          | Schema ready (`OutboxJob` table with status, attempts, nextRetryAt). Polling worker process and message publisher pending.                                                                                                  | Step 4 (Reliability & Resilience)  |
| 7   | **Optimistic UI Reconciliation on HTTP 409/403**         | Backend returns standardized 403 and 409 error envelopes. Interactive frontend reconciliation modal pending.                                                                                                                | Step 6 (Operations Dashboard)      |

---

## Implemented in Step 2:

- JWT Authentication (`POST /api/v1/auth/login`, `GET /api/v1/auth/me`).
- Team-scoped RBAC and permission matrix middleware.
- Full Work-Item API (`POST /items`, `GET /items`, `GET /items/:id`, `PATCH /items/:id`, `POST /items/:id/claim`, `POST /items/:id/transition`, `GET /items/:id/activity`, `POST /items/:id/comments`).
- Transactional activity audit logging on all state mutations.
- Multi-field filtering (status, priority, type, assignee), text search, and cursor-based pagination.
- 39 integration tests verifying authentication, authorization, workflow approvals, and cross-team security.

---

## Other Out-of-Scope Elements

- **Live WebSockets / Push Notifications**: Real-time subscriptions are not part of Step 2.
- **External Third-Party Integrations**: Real Stripe APIs, SAML Identity Providers, or email gateways are not integrated; structures are prepared for outbox simulation.
