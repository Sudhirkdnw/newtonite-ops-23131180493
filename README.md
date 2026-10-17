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
│   │   ├── src/
│   │   │   ├── config/        # Zod environment variable validation
│   │   │   ├── middleware/    # Request ID, Logging, Error Handling
│   │   │   ├── modules/       # Health, Auth, WorkItems, etc.
│   │   │   ├── shared/        # Logger, Errors, HTTP, Database (Prisma)
│   │   │   ├── app.ts         # Express app factory
│   │   │   └── server.ts      # Server bootstrap with graceful shutdown
│   │   └── package.json
│   └── web/                   # React + TypeScript + Vite Dashboard
│       ├── src/
│       │   ├── app/           # App root & CSS design system
│       │   ├── services/      # API client
│       │   └── types/         # Web types
│       └── package.json
├── packages/
│   └── shared/                # Shared domain enums, Zod schemas, API types
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

| Command                | Description                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `npm run dev`          | Start backend API with hot-reload (`tsx watch`)                                        |
| `npm run dev:api`      | Run backend API service                                                                |
| `npm run dev:web`      | Start frontend Vite development server (`http://localhost:5173`)                       |
| `npm run build`        | Build all workspace packages (`@newtonite/shared`, `@newtonite/api`, `@newtonite/web`) |
| `npm run typecheck`    | Run strict TypeScript compiler verification across all projects                        |
| `npm run lint`         | Run ESLint checks across monorepo                                                      |
| `npm run format`       | Format codebase using Prettier                                                         |
| `npm run format:check` | Verify codebase formatting against Prettier rules                                      |
| `npm test`             | Run Vitest test suites                                                                 |
| `npm run db:migrate`   | Apply Prisma database migrations                                                       |
| `npm run db:seed`      | Execute deterministic database seed script                                             |

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

## 7. Current Implementation Status (Step 1 Foundation)

### Completed Foundation:

- [x] Monorepo structure with npm workspaces (`packages/shared`, `apps/api`, `apps/web`).
- [x] Strict TypeScript configuration with project references.
- [x] Complete PostgreSQL Prisma schema modeling:
  - `User`, `Team`, `Membership` (with `@@unique([userId, teamId])`).
  - `WorkItem` (with optimistic locking `version`, type, priority, status, indexes).
  - `ActivityEvent` (append-only timeline schema).
  - `Comment` (chronological discussions).
  - `IdempotencyKey` (unique key, request hash, response caching).
  - `OutboxJob` (status, attempts, retry schedule).
- [x] Initial database migration `20261017061147_init_foundation`.
- [x] Repeatable, deterministic seed script with 4 teams, 10 users across 4 roles, and 10 work items.
- [x] Centralized Express infrastructure:
  - Zod environment variable validation (`env.ts`).
  - Request ID / Correlation ID middleware (`X-Request-Id`).
  - Structured logger with automatic sensitive field redaction.
  - Centralized error handler with standardized JSON envelope.
  - `GET /health` and `GET /ready` (verifies PostgreSQL connection & latency).
  - Graceful shutdown lifecycle management (`SIGTERM` / `SIGINT`).
  - Security headers (`helmet`) and configurable CORS.
- [x] Frontend shell (React + Vite + dark mode design tokens).
- [x] Test suite passing with 100% test success rate.
- [x] Linting and formatting quality gates passing with 0 warnings and 0 errors.

_Refer to [KNOWN_LIMITATIONS.md](./KNOWN_LIMITATIONS.md) for pending business logic slated for subsequent steps._
