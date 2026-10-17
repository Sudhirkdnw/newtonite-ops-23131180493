# Engineering Decisions (ADR)

This document records the architectural and engineering decisions made during the foundation of the Newtonite Operations Under Pressure platform.

---

## ADR 001: Technology Stack & Monorepo Architecture

### Context

The Newtonite platform requires high reliability, reproducible development, end-to-end type safety, and clear separation between backend business logic, database contracts, and frontend presentation.

### Options Considered

1. **Polyglot Monorepo (Go/Rust Backend + React Frontend)**: Maximum raw execution performance, but adds dual runtime overhead, duplicates domain types, and slows iteration speed.
2. **Standard Node.js / TypeScript Monorepo (npm workspaces)**: Unified TypeScript types across database (Prisma), backend (Express), shared contracts, and frontend (React + Vite). Fast, dependable, and standard.
3. **Multi-Repo Split**: Independent repositories for API and Web. Requires publishing private packages for shared types or duplicating schemas.

### Decision

Adopt an npm workspaces monorepo with:

- **Backend**: Node.js, Express, TypeScript, Zod.
- **Frontend**: React, TypeScript, Vite.
- **Database**: PostgreSQL with Prisma ORM.
- **Contracts**: `@newtonite/shared` package for single-source-of-truth types and schemas.

### Trade-offs

- _Pros_: Zero type divergence between frontend and backend; single command builds and type-checks; lightweight standard tooling without proprietary monorepo lock-in.
- _Cons_: Must carefully structure tsconfig project references and build order to prevent circular workspace references.

---

## ADR 002: Optimistic Locking for WorkItem Concurrency

### Context

In high-pressure operations, multiple operators frequently view and attempt to update the same critical incident or task simultaneously. Blind updates cause the "last write wins" anomaly, silently overwriting critical triage decisions.

### Options Considered

1. **Pessimistic Locking (`SELECT FOR UPDATE`)**: Locks rows at database level during transaction read. High contention causes transaction queuing, lock timeouts, and potential deadlocks during high traffic.
2. **Optimistic Locking with Version Counter**: Add an integer `version` column to `WorkItem`. Updates only succeed if `WHERE id = :id AND version = :expectedVersion`, incrementing `version = version + 1`.
3. **Timestamp-Based Conflict Detection (`updatedAt`)**: Compare timestamps. Vulnerable to clock skew, microsecond precision discrepancies across database drivers, and concurrent writes within the same millisecond.

### Decision

Implement **Optimistic Locking via an integer `version` field** starting at 1. Mutating endpoints must check `version` atomically and return `HTTP 409 Conflict` on mismatch.

### Trade-offs

- _Pros_: Non-blocking reads; zero lock contention; deterministic detection; directly compatible with standard HTTP `If-Match` / `ETag` paradigms.
- _Cons_: Conflicts must be handled client-side by fetching the latest state and reconciling user input.

---

## ADR 003: Append-Only Activity Log Design

### Context

Regulatory compliance (SOC2/GDPR) and incident post-mortems require an immutable, tamper-evident record of all operational state transitions.

### Options Considered

1. **In-place Status History (updating previous record timestamps)**: Can be corrupted or modified; lacks immutability guarantees.
2. **Separate Append-Only `ActivityEvent` Table**: Only `INSERT` operations allowed at application level. Captures `previousState`, `newState`, `actorId`, `action`, and `createdAt`.
3. **PostgreSQL Event Sourcing (Reconstructing full state purely from events)**: High complexity; requires snapshotting and event replay projections for every query.

### Decision

Use a **dedicated append-only `ActivityEvent` table** alongside the current state in `WorkItem`. Domain transactions commit the state mutation and the activity event record within the same atomic database transaction.

### Trade-offs

- _Pros_: Fast reads for work-item summaries; simple audit trail queries; zero event-sourcing complexity; immutable audit trail.
- _Cons_: Storage growth over time; requires application-level enforcement prohibiting `UPDATE` and `DELETE` on `ActivityEvent`.

---

## ADR 004: Transactional Outbox Pattern for Background Jobs

### Context

Operations triggers external notifications, webhooks, and asynchronous workflows. Writing directly to a message broker (e.g., RabbitMQ, SQS) during an HTTP request creates a dual-write problem: if the message broker succeeds but the database transaction rolls back (or vice-versa), state diverges.

### Options Considered

1. **Direct Dual-Write to Message Broker**: High risk of lost events or ghost events on rollbacks.
2. **Two-Phase Commit (XA Transactions)**: Complex, heavy, poor cloud database support, easily blocks pools.
3. **Transactional Outbox Table**: Store `OutboxJob` rows in the same relational transaction as domain updates. A separate polling worker processes jobs with bounded retries and exponential backoff.

### Decision

Model an **`OutboxJob` table** directly in the database with status (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `DEAD_LETTER`), `attempts`, `nextRetryAt`, and error details.

### Trade-offs

- _Pros_: 100% atomic guarantee: no events lost on database rollbacks; works natively with PostgreSQL ACID transactions.
- _Cons_: Background worker polling latency (typically 500ms–2s); requires at-least-once message handling and deduplication downstream.

---

## ADR 005: Idempotency Key Design

### Context

Network timeouts and client retries during network pressure can lead to duplicate payments, duplicated work items, or double refunds.

### Options Considered

1. **Client-Side Deduplication Only**: Ineffective against network disconnects where the server received the request but the client timed out before receiving the response.
2. **Redis In-Memory Key Cache**: Fast, but keys are lost if Redis crashes or is evicted, risking duplicate side effects.
3. **Relational `IdempotencyKey` Table**: Durable storage holding request hash, path, method, status (`PROCESSING`, `RESOLVED`), and cached response body.

### Decision

Model a durable **`IdempotencyKey` table in PostgreSQL** with a unique constraint on `key`. It caches response headers and response body for 24 hours.

### Trade-offs

- _Pros_: Survives server restarts; enforces atomic deduplication inside transactional boundaries; replays identical responses safely.
- _Cons_: Slight database write overhead per mutating request; requires periodic cleanup of expired keys (`expiresAt` index).

---

## ADR 006: Scoped Role-Based Access Control (RBAC)

### Context

Operators belong to multiple teams and should have different privileges per team (e.g., Lead in Core Ops, Viewer in Platform Eng).

### Options Considered

1. **Flat Global Roles**: Simple `role` on `User` table. Cannot express team-specific authority.
2. **Membership-Scoped Roles**: Role (`VIEWER`, `MEMBER`, `LEAD`, `ADMIN`) defined on the `Membership` join record between User and Team, combined with a coarse `systemRole` (`USER`, `SYSTEM_ADMIN`) on User.

### Decision

Adopt **Membership-Scoped Roles** with a compound unique constraint `@@unique([userId, teamId])`. Work item actions are evaluated against the actor's membership role within the target team.

### Trade-offs

- _Pros_: Granular, realistic multi-tenant team security; prevents privilege leaks across departments.
- _Cons_: Authorization checks must resolve team membership for each resource.

---

## ADR 007: Team-Scoped Role-Based Access Control & Permission Matrix

### Context

Work items, audit trails, and discussions in Newtonite belong strictly to functional teams. Operators hold team-specific roles (`VIEWER`, `MEMBER`, `LEAD`, `ADMIN`) that govern their capabilities within each assigned team.

### Decision

Enforce permissions exclusively on the server side across all routes. The permissions matrix is enforced as follows:

| Action                                                                                    |  Viewer  |  Member  | Lead | Admin / System Admin |
| ----------------------------------------------------------------------------------------- | :------: | :------: | :--: | :------------------: |
| `GET /items` (List team items)                                                            |    ✅    |    ✅    |  ✅  |          ✅          |
| `GET /items/:id` (View item)                                                              |    ✅    |    ✅    |  ✅  |          ✅          |
| `GET /items/:id/activity` (Audit timeline)                                                |    ✅    |    ✅    |  ✅  |          ✅          |
| `POST /items` (Create work item)                                                          | ❌ (403) |    ✅    |  ✅  |          ✅          |
| `PATCH /items/:id` (Update fields)                                                        | ❌ (403) |    ✅    |  ✅  |          ✅          |
| `POST /items/:id/claim` (Claim unassigned)                                                | ❌ (403) |    ✅    |  ✅  |          ✅          |
| `POST /items/:id/comments` (Add discussion)                                               | ❌ (403) |    ✅    |  ✅  |          ✅          |
| `POST /items/:id/transition` (Routine: Backlog, Triaged, In Progress, Blocked, In Review) | ❌ (403) |    ✅    |  ✅  |          ✅          |
| `POST /items/:id/transition` (Approval: In Review -> Completed)                           | ❌ (403) | ❌ (403) |  ✅  |          ✅          |
| `POST /items/:id/transition` (Re-open: Completed / Cancelled -> In Progress / Backlog)    | ❌ (403) | ❌ (403) |  ✅  |          ✅          |

### Trade-offs

- _Pros_: Complete prevention of privilege escalation; deterministic server-side enforcement independent of UI state.
- _Cons_: Requires every request to resolve caller's membership role within the target item's team.

---

## ADR 008: Workflow State Transition Model & Lead Approval Gate

### Context

Operational integrity requires that work items follow strict operational stages and that mission-critical items cannot be arbitrarily marked `COMPLETED` without Lead or Admin sign-off.

### Decision

Implement a deterministic state machine on the server:

- `BACKLOG` -> `TRIAGED`, `IN_PROGRESS`, `CANCELLED`
- `TRIAGED` -> `IN_PROGRESS`, `CANCELLED`
- `IN_PROGRESS` -> `BLOCKED`, `IN_REVIEW`, `CANCELLED`
- `BLOCKED` -> `IN_PROGRESS`, `CANCELLED`
- `IN_REVIEW` -> `COMPLETED` (**Lead or Admin approval strictly required**), `IN_PROGRESS`
- `COMPLETED` -> `IN_PROGRESS` (Re-open, Lead or Admin required)
- `CANCELLED` -> `BACKLOG` (Re-open, Lead or Admin required)

Invalid transitions are rejected with `HTTP 400 Bad Request`. Transitioning `IN_REVIEW -> COMPLETED` by a Member or Viewer returns `HTTP 403 Forbidden`. Successful approval records a dedicated `WORKFLOW_APPROVED` audit event.

### Trade-offs

- _Pros_: Prevents unverified bypass of quality or compliance controls; verifiable audit log of approvals.
- _Cons_: Leads become a required participant in resolving items in review.

---

## ADR 009: Cross-Team Resource Isolation: 404 vs 403 Security Policy

### Context

A user belonging to Team A should never be able to discover or manipulate resources belonging to Team B. If an API returns `HTTP 403 Forbidden` for an item ID in another team, an attacker can enumerate IDs and deduce resource existence.

### Decision

Apply a strict multi-tenant boundary policy:

1. **Resource Identification (`/items/:id`)**: If an item does not exist **OR** if the caller is not a member of the item's team, the server returns **`HTTP 404 Not Found`**.
2. **Team-Scoped Action (`/items` with `teamId`)**: If the caller explicitly queries or creates an item specifying a `teamId` to which they do not belong, the server returns **`HTTP 403 Forbidden`** (explicit boundary rejection).
3. **Role Violations (within caller's team)**: If the caller is a member of the team but lacks sufficient authority (e.g. Viewer mutating an item, or Member approving an `IN_REVIEW` item), the server returns **`HTTP 403 Forbidden`**.

### Trade-offs

- _Pros_: Total elimination of ID enumeration / oracle attacks across functional teams; secure-by-default behavior.
- _Cons_: Developers debugging client requests on mismatched IDs must verify their active team memberships.
