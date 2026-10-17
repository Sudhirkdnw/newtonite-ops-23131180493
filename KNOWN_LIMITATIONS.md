# Known Limitations & Step 1 Boundary

This document explicitly lists features that are **not implemented yet** in the Newtonite Operations Under Pressure platform as of **Step 1 (Foundation)**.

While the database schema, relational constraints, and core architectural envelopes have been established to support these requirements, no business logic or tests have been implemented for them yet.

---

## Explicitly Pending Critical Behaviors

The following critical operational behaviors are deferred to subsequent implementation steps:

| #   | Capability                                               | Current Status in Step 1                                                                                                                                        | Planned Implementation Step            |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1   | **Concurrent Claim**                                     | Schema ready (`assigneeId` foreign key and indexes exist). No atomic conditional claim endpoint (`UPDATE WHERE assigneeId IS NULL`) is implemented yet.         | Step 3 (Work Item Operations)          |
| 2   | **Stale-Version Update Handling**                        | Schema ready (`version Int @default(1)`). No optimistic locking middleware or HTTP 409 Conflict handler is implemented for work items yet.                      | Step 3 (Work Item Operations)          |
| 3   | **Idempotency Replay**                                   | Schema ready (`IdempotencyKey` table with unique constraint and response cache fields). No idempotency middleware or request deduplication logic is active yet. | Step 4 (Reliability & Resilience)      |
| 4   | **Server-Enforced Workflow Transitions & Lead Approval** | Schema ready (`WorkItemStatus` enum, `ActivityAction.WORKFLOW_APPROVED`). No state transition machine or Lead-only approval guard is enforced yet.              | Step 3 & Step 5 (Authorization)        |
| 5   | **Resource-Level Authorization (Team & Role Scoped)**    | Schema ready (`Membership` table with `role` and `@@unique([userId, teamId])`). No JWT authentication extraction or team RBAC guards are mounted yet.           | Step 2 (Auth & RBAC)                   |
| 6   | **Transactional Outbox Worker**                          | Schema ready (`OutboxJob` table with status, attempts, nextRetryAt). No background polling worker or message publisher is running yet.                          | Step 4 (Reliability & Resilience)      |
| 7   | **Optimistic UI Reconciliation on HTTP 409/403**         | Frontend shell and health status monitor exist. No work-item management UI or conflict reconciliation modal is built yet.                                       | Step 6 (Frontend Operations Dashboard) |

---

## Other Out-of-Scope Elements

- **Live WebSockets / Push Notifications**: Real-time subscriptions are not part of Step 1 foundation.
- **External Third-Party Integrations**: Real Stripe APIs, SAML Identity Providers, or email gateways are not integrated; event structures are prepared for outbox simulation.
- **Production Secret Management**: Development uses documented demo secrets and environment variables. Production deployment requires AWS Secrets Manager, HashiCorp Vault, or equivalent.
