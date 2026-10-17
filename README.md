# Newtonite Operations Platform

> **Newtonite Software Engineering Challenge — Operations Under Pressure**  
> High-Reliability Mission-Critical Operational Workflow Engine

---

## 1. Project Purpose

The Newtonite Operations Platform is designed for high-stress operational environments where multiple operators concurrently triage, claim, resolve, and audit mission-critical items across incidents, payment disputes, customer escalations, and compliance tasks.

The system is engineered for resilience against race conditions, duplicate mutations, network retries, and unauthorized state transitions.

---

## 2. Architecture Overview

```
newtonite-ops/
├── apps/
│   ├── api/                   # Express + TypeScript REST API Engine
│   │   └── src/
│   │       ├── config/        # Zod environment variable validation
│   │       ├── middleware/    # Request ID, Logging, Error Handling
│   │       ├── modules/       # Health, Auth, WorkItems, etc.
│   │       ├── shared/        # Logger, Errors, HTTP, Database (Prisma)
│   │       ├── app.ts         # Express app factory
│   │       └── server.ts      # Server bootstrap with graceful shutdown
│   └── web/                   # React + TypeScript + Vite Dashboard
│       └── src/
│           ├── app/           # App root & CSS design system
│           ├── services/      # API client
│           └── types/         # Web types
├── packages/
│   └── shared/                # Shared domain enums, Zod schemas, API types (src/index.ts)
├── prisma/
│   ├── schema.prisma          # PostgreSQL relational schema
│   ├── migrations/            # Versioned SQL migrations
│   └── seed.ts                # Deterministic seed generator
├── tests/
│   ├── integration/           # Integration tests
│   └── fixtures/              # Test fixtures
├── docs/
│   ├── ARCHITECTURE.md        # Comprehensive architectural blueprint
│   └── API_DESIGN.md          # REST API specifications and envelopes
├── docker-compose.yml         # Containerized PostgreSQL infrastructure
├── .env.example               # Environment variables template
├── ENGINEERING_DECISIONS.md   # Architectural Decision Records (ADRs)
└── KNOWN_LIMITATIONS.md       # Explicit scope boundary and pending features
```

---

## 3. Prerequisites

- **Node.js**: `v20+` or `v24+` (tested on `v24.16.0`)
- **npm**: `v10+` or `v11+`
- **PostgreSQL**: `v16+` (via Docker Compose or local PostgreSQL service)

---

## 4. Environment & Database Setup

### 1. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Ensure `DATABASE_URL` points to your PostgreSQL instance:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/newtonite?schema=public"
```

### 2. Start PostgreSQL via Docker Compose (Optional)

If running via Docker:

```bash
docker compose up -d
```

### 3. Run Migrations & Seed Development Data

Apply the initial schema migration and deterministic seed data:

```bash
npm run db:migrate
npm run db:seed
```

---

## 5. Development & Testing Commands

| Command                | Description                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| `npm run dev`          | Start both API backend and Web frontend simultaneously            |
| `npm run dev:api`      | Run backend API service with hot-reload (`http://localhost:4000`) |
| `npm run dev:web`      | Start frontend Vite development server (`http://localhost:5173`)  |
| `npm run build`        | Build both backend API and frontend Web production bundles        |
| `npm run typecheck`    | Run strict TypeScript compiler verification across all projects   |
| `npm run lint`         | Run ESLint checks across monorepo                                 |
| `npm run format`       | Format codebase using Prettier                                    |
| `npm run format:check` | Verify codebase formatting against Prettier rules                 |
| `npm test`             | Run Vitest test suites                                            |
| `npm run db:migrate`   | Apply Prisma database migrations                                  |
| `npm run db:seed`      | Execute deterministic database seed script                        |

---

## 6. Seeded Demo Accounts

All demo accounts are provisioned with the development password:  
**`Demo@Newtonite2026!`**

| Email                         | Role         | Scoped Teams                                  |
| ----------------------------- | ------------ | --------------------------------------------- |
| `alice.admin@newtonite.dev`   | System Admin | Core Operations (Admin), Platform Eng (Admin) |
| `bob.lead@newtonite.dev`      | Team Lead    | Core Operations                               |
| `charlie.lead@newtonite.dev`  | Team Lead    | Platform Engineering                          |
| `diana.lead@newtonite.dev`    | Team Lead    | Security & Compliance                         |
| `evan.member@newtonite.dev`   | Member       | Core Operations                               |
| `fiona.member@newtonite.dev`  | Member       | Platform Engineering                          |
| `george.member@newtonite.dev` | Member       | Customer Support                              |
| `hannah.member@newtonite.dev` | Member       | Security & Compliance                         |
| `ian.viewer@newtonite.dev`    | Viewer       | Core Operations                               |
| `julia.viewer@newtonite.dev`  | Viewer       | Customer Support                              |

---

---

## 7. API Reference & Sample Requests

All API responses follow the standard JSON envelope:
`{ "success": true, "data": ..., "meta": { "timestamp": "...", "requestId": "..." } }`
or `{ "success": false, "error": { "code": "...", "message": "...", "details": [...] } }`.

### Authentication Endpoints

| Method | Endpoint             | Auth Required | Role Required | Description                                               |
| ------ | -------------------- | ------------- | ------------- | --------------------------------------------------------- |
| `POST` | `/api/v1/auth/login` | No            | None          | Authenticate with email & password, returns JWT & profile |
| `GET`  | `/api/v1/auth/me`    | Yes (Bearer)  | Any           | Returns authenticated user profile and team memberships   |

### Work Item Endpoints

| Method  | Endpoint                       | Auth Required | Minimum Role | Description                                                        |
| ------- | ------------------------------ | ------------- | ------------ | ------------------------------------------------------------------ |
| `POST`  | `/api/v1/items`                | Yes (Bearer)  | `MEMBER`     | Create a new work item assigned to a specific team                 |
| `GET`   | `/api/v1/items`                | Yes (Bearer)  | `VIEWER`     | List work items scoped to user's teams with filtering & pagination |
| `GET`   | `/api/v1/items/:id`            | Yes (Bearer)  | `VIEWER`     | Retrieve item by ID (returns `404` if not in user's teams)         |
| `PATCH` | `/api/v1/items/:id`            | Yes (Bearer)  | `MEMBER`     | Update title, description, priority, tags, metadata                |
| `POST`  | `/api/v1/items/:id/claim`      | Yes (Bearer)  | `MEMBER`     | Atomically claim work item (`409 Conflict` if already claimed)     |
| `POST`  | `/api/v1/items/:id/transition` | Yes (Bearer)  | `MEMBER`\*   | Transition status (`IN_REVIEW -> COMPLETED` requires `LEAD`)       |
| `GET`   | `/api/v1/items/:id/activity`   | Yes (Bearer)  | `VIEWER`     | Retrieve audit activity timeline for an item                       |
| `GET`   | `/api/v1/items/:id/comments`   | Yes (Bearer)  | `VIEWER`     | List chronological discussion comments for an item                 |
| `POST`  | `/api/v1/items/:id/comments`   | Yes (Bearer)  | `MEMBER`     | Append a discussion comment to an item                             |
| `GET`   | `/api/v1/items/sla/overview`   | Yes (Bearer)  | `VIEWER`     | Retrieve team-scoped SLA metrics, counts & urgent escalation queue |
| `POST`  | `/api/v1/items/sla/escalate`   | Yes (Bearer)  | `MEMBER`     | Trigger manual or scheduled SLA escalation scan cycle              |

\* _Note: Approving an item from `IN_REVIEW` to `COMPLETED` strictly requires `LEAD` or `ADMIN` role in that team._

---

### Sample cURL Commands

#### 1. Login to receive JWT token:

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"bob.lead@newtonite.dev","password":"Demo@Newtonite2026!"}'
```

#### 2. Get Authenticated Profile (`/auth/me`):

```bash
curl http://localhost:4000/api/v1/auth/me \
  -H "Authorization: Bearer <TOKEN>"
```

#### 3. Create a Work Item:

```bash
curl -X POST http://localhost:4000/api/v1/items \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "teamId": "<TEAM_ID>",
    "title": "Investigate latency spike on payment gateway",
    "description": "5xx error rate exceeded 3% over the last 15 minutes.",
    "type": "INCIDENT",
    "priority": "P0_CRITICAL",
    "tags": ["payments", "p0", "latency"]
  }'
```

#### 4. List Work Items with Filtering & Cursor Pagination:

```bash
curl "http://localhost:4000/api/v1/items?status=OPEN&priority=P0_CRITICAL&limit=10" \
  -H "Authorization: Bearer <TOKEN>"
```

#### 5. Claim a Work Item:

```bash
curl -X POST http://localhost:4000/api/v1/items/<ITEM_ID>/claim \
  -H "Authorization: Bearer <TOKEN>"
```

#### 6. Transition Workflow State:

```bash
curl -X POST http://localhost:4000/api/v1/items/<ITEM_ID>/transition \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "targetStatus": "IN_PROGRESS",
    "reason": "Starting investigation"
  }'
```

#### 7. Post a Comment:

```bash
curl -X POST http://localhost:4000/api/v1/items/<ITEM_ID>/comments \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "body": "Root cause identified as database connection pool exhaustion."
  }'
```

#### 8. Idempotent Creation (Network Retry Safe):

```bash
curl -X POST http://localhost:4000/api/v1/items \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Idempotency-Key: 8a7c2e39-1456-42bb-92a1-12cba8973d42" \
  -H "Content-Type: application/json" \
  -d '{
    "teamId": "<TEAM_ID>",
    "title": "Idempotent operational task",
    "type": "TASK",
    "priority": "HIGH"
  }'
```

_(Subsequent calls with the same key and payload replay the cached response with `X-Cache-Lookup: HIT` without duplicate records)._

#### 9. Optimistic Concurrency Update (Version-Checked):

```bash
curl -X PATCH http://localhost:4000/api/v1/items/<ITEM_ID> \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated title with version guarantee",
    "version": 2
  }'
```

_(If the item has already been modified to version 3+, returns `HTTP 409 Conflict` with latest and submitted version metadata)._

---

## 8. Current Implementation Status

### Completed (Steps 1–6: Foundation, Core APIs, Critical Behaviours, Dashboard Frontend, E2E Integration & SLA Escalation Engine):

- [x] **Monorepo Architecture**: Single unified root `package.json` and single `node_modules` running Express backend (`apps/api`), Vite frontend (`apps/web`), and shared contracts (`packages/shared`).
- [x] **PostgreSQL & Prisma Schema**: Relational models for `User`, `Team`, `Membership`, `WorkItem`, `ActivityEvent`, `Comment`, `IdempotencyKey`, and `OutboxJob`.
- [x] **Deterministic Seeding**: 4 teams, 10 users with bcrypt-hashed passwords across 4 roles, and 10 work items with activities and comments.
- [x] **Authentication Engine**: JWT signing & verification, bcrypt comparison, `POST /auth/login` and `GET /auth/me`.
- [x] **Team-Based Authorization (RBAC)**: Role hierarchy (`VIEWER` < `MEMBER` < `LEAD` < `ADMIN`), team membership enforcement, and cross-team resource isolation returning `404 Not Found` to prevent enumeration attacks.
- [x] **Work-Item Lifecycle & State Machine**:
  - Full CRUD operations with Zod validation.
  - Strict state transition enforcement (`BACKLOG -> TRIAGED -> IN_PROGRESS -> IN_REVIEW -> COMPLETED`, plus `BLOCKED` and `CANCELLED`).
  - Lead-only approval enforcement for `IN_REVIEW -> COMPLETED`.
- [x] **Critical Behaviour 1 — Concurrent Work-Item Claiming**:
  - Atomic conditional database update (`WHERE id = :id AND assigneeId IS NULL`) with row-count check.
  - High-concurrency stress test with 10 simultaneous claims asserting strictly 1 winner and 9 `HTTP 409 Conflict` rejections.
- [x] **Critical Behaviour 2 — Optimistic Locking for Stale Updates**:
  - Integer `version` tokens submitted on mutations (`PATCH /items/:id`).
  - Stale updates rejected with `HTTP 409 Conflict` and diagnostic `{ currentVersion, submittedVersion }` metadata without altering database or appending misleading activity logs.
- [x] **Critical Behaviour 3 — Idempotency for Repeated Requests**:
  - Support for `Idempotency-Key` header with SHA-256 request fingerprinting.
  - Safe replay of cached responses (`X-Cache-Lookup: HIT`) for network retries and duplicate submissions.
  - Protection against key reuse with altered payloads (`HTTP 409 Conflict`).
- [x] **Critical Behaviour 4 — Server-Enforced Workflow State Machine**: Centralized transition validator with Lead-only approval gates and immutable audit logs.
- [x] **Critical Behaviour 5 — Multi-Team Resource-Level Authorization**: Strict boundary enforcement and 404 isolation across all 9 REST endpoints.
- [x] **Critical Behaviour 6 — Transactional Outbox Pattern**:
  - Outbox jobs scheduled atomically in same Prisma transaction as business entity.
  - Asynchronous `OutboxWorker` claiming jobs with atomic conditional lock, exponential backoff retries, and terminal dead-letter state tracking.
- [x] **Critical Behaviour 7 — Optimistic UI Reconciliation Pattern**:
  - Pure `OptimisticReconciler` and `useOptimisticWorkItem` hook implementing snapshot preservation, optimistic local update, automatic rollback on 409/403, and server reconciliation.
- [x] **Operations Dashboard Frontend (Step 4)**:
  - React 18 + TypeScript + Vite with token-based CSS design system (zero Tailwind, bespoke enterprise UI).
  - Dark mode navigation with active team switcher, profile menu, and live role badge.
  - Operations overview with real-time KPI metrics, critical queue cards, and recent timeline.
  - Server-side filtered & keyset cursor paginated work items catalog (`limit`, `cursor`, `status`, `priority`, `type`, `search`).
  - Full item detail view with inline optimistic editor, state transition modal, claim action, comment discussion feed, and immutable activity timeline.
- [x] **Critical Behaviour 8 — Production-Oriented SLA & Escalation Engine (Step 6)**:
  - Configurable SLA durations by priority (`CRITICAL: 2h`, `URGENT: 6h`, `HIGH: 24h`, `MEDIUM: 72h`, `LOW: 168h`).
  - Deterministic target deadline calculation: `min(dueDate, slaDeadline)` ensuring operator-specified due dates are respected without permitting contractual SLA extension.
  - Idempotent atomic conditional escalation updates (`WHERE id = :id AND lastEscalationStatus = :oldStatus`) inside Prisma transactions.
  - Asynchronous event emission via Transactional Outbox (`WORK_ITEM_ESCALATED`) and immutable audit timeline logs (`ActivityAction.ESCALATED`).
  - Terminal state exclusion: closed items (`COMPLETED`, `CANCELLED`) never trigger active escalations.
  - Dashboard integration: SLA KPI performance banner, Urgent Escalation queue, and countdown badges.
  - Team-scoped authorization returning `404 Not Found` for cross-team probes.
- [x] **Critical Behaviour 9 — Centralized Settings & Configuration Center (Step 7)**:
  - 10 functional settings categories backed by typed PostgreSQL models (`SystemSetting`, `SettingAuditEvent`) and in-memory caching.
  - Public branding endpoint (`GET /api/v1/settings/public/branding`) delivering dynamic CSS variables (`--primary-blue`), browser title, and verified Base64 logo uploads (PNG/SVG <= 2MB).
  - Secret masking (`••••••••`) and blank-preservation pattern protecting sensitive credentials (`smtpPassword`).
  - Active Nodemailer transport verification and real test email sending action.
  - Maintenance Mode middleware intercepting non-admin work-item mutations with `HTTP 503 Service Unavailable`.
  - Dynamic SLA duration configuration and escalation scanner pause switch integrated with Step 6 engine.
  - Team & access control administration with server-side last-admin safeguard and self-deactivation protection.
  - Live Background Jobs queue statistics (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `DEAD_LETTER`) and idempotent retry endpoint.
  - Append-only configuration audit history with redacted secrets in diff logs.
- [x] **Step 7 Quality Gates & Verification**:
  - **106 / 106 automated tests passing** across 14 test suites (12/12 settings configuration, 9/9 SLA escalation, 15/15 E2E flows, 6/6 SLA calculator, 12/12 frontend ops, 3/3 optimistic reconciliation, 49/49 core backend).
  - TypeScript strict mode: **0 type errors** (`tsc --noEmit`).
  - ESLint: **0 errors, 0 warnings** (`eslint .`).
  - Prettier: **100% formatted** (`prettier --check .`).
  - Production builds: API & Web bundles compile cleanly.
  - Comprehensive documentation in `docs/SETTINGS_CONFIGURATION_REPORT.md`.
- [x] **Step 6 Quality Gates & Verification**:
  - **94 / 94 automated tests passing** across 13 test suites (15/15 E2E flows, 9/9 SLA escalation, 6/6 SLA calculator, 10/10 frontend ops, 3/3 optimistic reconciliation, 51/51 core backend).
  - TypeScript strict mode: **0 type errors** (`tsc --noEmit`).
  - ESLint: **0 errors, 0 warnings** (`eslint .`).
  - Prettier: **100% formatted** (`prettier --check .`).
  - Production builds: API & Web bundles compile cleanly.
  - Comprehensive documentation in `docs/SLA_ESCALATION_REPORT.md`.
- [x] **Step 5 Full-Stack Integration & Quality Gates**:
  - **79 / 79 automated tests passing** across 11 test suites (15/15 E2E user flows, 10/10 frontend operations, 3/3 optimistic reconciliation, 49/49 backend domain & concurrency suites).
  - TypeScript strict mode: **0 type errors** (`tsc --noEmit`).
  - ESLint: **0 errors, 0 warnings** (`eslint .`).
  - Prettier: **100% formatted** (`prettier --check .`).
  - Production builds: API & Web bundles compile cleanly.
  - Comprehensive documentation in `docs/END_TO_END_TEST_REPORT.md`.

_Refer to [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) and [ENGINEERING_DECISIONS.md](./ENGINEERING_DECISIONS.md) for architectural records._
