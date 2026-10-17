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

---

## ADR 010: Atomic Conditional Work-Item Claiming

### Context

In high-stress operations, multiple responders often attempt to claim the same critical incident or task at the exact same millisecond. Traditional `read-then-write` logic (`if (!item.assigneeId) update(...)`) is vulnerable to race conditions where two simultaneous requests both observe an unassigned state and overwrite each other.

### Decision

Implement atomic conditional database updates directly inside a Prisma interactive transaction:

```sql
UPDATE "WorkItem"
SET "assigneeId" = :userId, "status" = 'IN_PROGRESS', "version" = "version" + 1
WHERE "id" = :itemId AND "assigneeId" IS NULL;
```

Check the affected row count:

- If `count === 1`: The caller won the atomic race. Emit `ActivityEvent` (`CLAIMED`) and schedule an `OutboxJob` within the same transaction.
- If `count === 0`: The item was claimed concurrently by another operator. Fetch the winner's identity and return `HTTP 409 Conflict` with diagnostic metadata (`claimedBy`, `claimedAt`).

### Trade-offs

- _Pros_: Zero deadlock potential, single round-trip atomicity, mathematical guarantee of exactly one assignee under high concurrent load.
- _Cons_: Requires callers to handle HTTP 409 and refresh their local workboard.

---

## ADR 011: Optimistic Concurrency Control via Version Tokens

### Context

Concurrent edits by multiple operators on the same work item (e.g. updating description, priority, or tags) can cause the "lost update" anomaly, where Operator B silently overwrites changes just submitted by Operator A.

### Decision

Implement integer version-based optimistic locking on `PATCH /api/v1/items/:id`:

1. Every `WorkItem` contains an integer `version` field (initialized at 1).
2. Clients submit their known `version` alongside mutation fields.
3. The server updates conditionally:

```sql
UPDATE "WorkItem"
SET ..., "version" = "version" + 1
WHERE "id" = :itemId AND "version" = :submittedVersion;
```

4. If `count === 0`, the server aborts the transaction, queries the latest server version, and returns `HTTP 409 Conflict` with `{ currentVersion, submittedVersion }`. No activity events or outbox jobs are written.

### Trade-offs

- _Pros_: Prevents silent data corruption without expensive database row locks; completely non-blocking for read-heavy operational dashboards.
- _Cons_: Stale clients must reconcile their local state before re-applying changes.

---

## ADR 012: Idempotent Mutation Engine via Request Fingerprinting

### Context

Network disconnects, automated retries, and double-clicks by frantic operators can produce duplicate work items or redundant operations.

### Decision

Implement an express middleware supporting standard `Idempotency-Key` headers:

1. Fingerprint calculation: Deterministic SHA-256 hash of `HTTP Method + Path + Request Body + User ID`.
2. Atomic record reservation in PostgreSQL (`IdempotencyKey` table) with status `PROCESSING`.
3. If duplicate request arrives while `PROCESSING`: Return `HTTP 409 Conflict` to prevent simultaneous execution races.
4. If key is reused with a **different payload**: Reject with `HTTP 409 Conflict` ("Idempotency key was previously used with a different request payload").
5. When the request resolves (`< 400`): Cache status code and response body; replay cached response with `X-Cache-Lookup: HIT` on identical future retries.
6. If the request fails (`>= 400`): Clean up the key to allow safe retries.

### Trade-offs

- _Pros_: Guarantees exactly-once semantics for item creation; protects database from retry storms.
- _Cons_: Requires periodic cleanup of expired idempotency keys (TTL-based index).

---

## ADR 013: Reliable Asynchronous Event Dispatching via Transactional Outbox

### Context

When work items are created, claimed, or transitioned, external side effects (e.g. webhook notifications, Slack alerts, audit sync) must be executed reliably. Firing network calls directly inside API handlers risks partial failure (e.g. database commits, but notification fails or crashes the process).

### Decision

Implement the **Transactional Outbox Pattern**:

1. Within the exact same database transaction that modifies the `WorkItem` and appends the `ActivityEvent`, insert an `OutboxJob` row (`PENDING`).
2. An asynchronous `OutboxWorker` polls and claims pending jobs using atomic conditional updates (`status: PROCESSING`, `attempts: increment`).
3. Failed jobs undergo exponential backoff retry (`1s, 2s, 4s, 8s...` up to `60s`) until `maxAttempts` (default 5).
4. Permanent failures are marked `FAILED` with diagnostics preserved.
5. Crashed workers leave jobs in `PROCESSING`; the worker automatically reclaims jobs stuck in `PROCESSING` older than 5 minutes.

### Trade-offs

- _Pros_: 100% transactional consistency between database mutations and dispatched asynchronous events; zero external message queue dependencies (pure PostgreSQL).
- _Cons_: Slightly higher write amplification (one extra row inserted per business mutation).

---

## ADR 014: Frontend Authentication, Token Storage Strategy, and Route Protection

### Context

Step 4 requires an enterprise authentication architecture that protects routes, manages user sessions safely, retrieves real profiles and team memberships, and handles token expiration (HTTP 401) and forbidden operations (HTTP 403) without exposing sensitive credentials.

### Options Considered

1. **`localStorage`**: Persistent across browser restarts and all tabs. High vulnerability to token theft via Cross-Site Scripting (XSS) and accidental cross-persona leakage when testing multiple roles in adjacent tabs.
2. **`sessionStorage` + In-Memory State**: Scoped strictly to the individual browser tab and purged when the tab is closed. Allows opening separate tabs with different roles (e.g. Lead in tab 1, Member in tab 2) without cookie conflicts.
3. **Pure In-Memory (React state only)**: Maximum security, but every page refresh forces re-authentication, disrupting operator workflows during crisis triage.

### Decision

Adopt **`sessionStorage` paired with React `AuthContext`**:

1. Upon successful `POST /api/v1/auth/login`, store the bearer token in `sessionStorage.getItem('newtonite_auth_token')`.
2. On app mount or reload, verify the token by invoking `GET /api/v1/auth/me`. If invalid or expired (HTTP 401), immediately purge the storage and reset state.
3. On user logout, remove the token from `sessionStorage` and reset context.
4. If any subsequent API call returns HTTP 401, trigger automatic session eviction and redirect to the Login view.

### Trade-offs

- _Pros_: Secure tab isolation for role testing; survives page refreshes within the same tab; zero token persistence on shared workstations after tab closure.
- _Cons_: Operators must log in again when opening new tabs.

---

## ADR 015: Server-Side Cursor Pagination & Real Operational Dashboard Queues

### Context

Enterprise operational backlogs can contain thousands of incidents and tasks. Downloading the entire database to the client and filtering locally wastes bandwidth, causes client UI freezes, and fails under production scale. Furthermore, classic `OFFSET / LIMIT` pagination skips or duplicates rows when items are created or deleted concurrently.

### Decision

1. **Server-Side Cursor Pagination**:
   - The backend encodes cursor tokens based on the keyset `(createdAt, id)` in Base64.
   - The frontend `fetchWorkItems` client transmits `cursor`, `limit`, `teamId`, `status`, `priority`, `type`, and `search` query parameters.
   - The frontend maintains a cursor stack (`cursorStack`) enabling deterministic Previous / Next navigation across pages.
2. **Real Operational Queues on Dashboard**:
   - The Main Dashboard queries the backend and strictly categorizes items into 5 operational queues:
     1. **Assigned to Me**: Filtered by active user ID.
     2. **Unassigned Urgent**: Filtered by missing assignee and `CRITICAL` or `URGENT` priority.
     3. **Awaiting My Approval**: Filtered by `IN_REVIEW` status in teams where the operator holds `LEAD` or `ADMIN` role.
     4. **Work Requiring Attention**: Filtered by `BLOCKED` status or untriaged backlog items.
     5. **Recent Work Items**: Latest audited operational records.
   - Zero fabricated metrics or mock tasks are used.
