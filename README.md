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
| `POST`  | `/api/v1/items/:id/comments`   | Yes (Bearer)  | `MEMBER`     | Append a discussion comment to an item                             |

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

---

## 8. Current Implementation Status

### Completed (Step 1 Foundation + Step 2 Core Operations Engine):

- [x] **Monorepo Architecture**: Single unified root `package.json` and single `node_modules` running Express backend (`apps/api`), Vite frontend (`apps/web`), and shared contracts (`packages/shared`).
- [x] **PostgreSQL & Prisma Schema**: Relational models for `User`, `Team`, `Membership`, `WorkItem`, `ActivityEvent`, `Comment`, `IdempotencyKey`, and `OutboxJob`.
- [x] **Deterministic Seeding**: 4 teams, 10 users with bcrypt-hashed passwords across 4 roles, and 10 work items with activities and comments.
- [x] **Authentication Engine**: JWT signing & verification, bcrypt comparison, `POST /auth/login` and `GET /auth/me`.
- [x] **Team-Based Authorization (RBAC)**: Role hierarchy (`VIEWER` < `MEMBER` < `LEAD` < `ADMIN`), team membership enforcement, and cross-team resource isolation returning `404 Not Found` to prevent enumeration attacks.
- [x] **Work-Item Lifecycle & State Machine**:
  - Full CRUD operations with Zod validation.
  - Strict state transition enforcement (`OPEN -> CLAIMED -> IN_PROGRESS -> IN_REVIEW -> COMPLETED`, plus `BLOCKED` and `CANCELED`).
  - Lead-only approval enforcement for `IN_REVIEW -> COMPLETED`.
  - Atomic claiming mechanism with `409 Conflict` prevention on already claimed items.
- [x] **Transactional Audit Logging**: Every state mutation atomically writes an immutable `ActivityEvent` to the item's timeline.
- [x] **Activity Timeline & Comments**: Paginated timeline retrieval and discussion threads.
- [x] **Quality Gates & Test Coverage**: Vitest integration tests covering auth, RBAC, state transitions, claim conflicts, and pagination with 100% test pass rate.

_Refer to [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) and [ENGINEERING_DECISIONS.md](./ENGINEERING_DECISIONS.md) for architectural records and future step roadmaps._
