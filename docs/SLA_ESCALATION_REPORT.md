# Newtonite Ops — Step 6: Production-Oriented SLA and Escalation Engine Report

## 1. Executive Summary

This report documents the architectural design, implementation, and automated verification of the **Production-Oriented Service Level Agreement (SLA) & Escalation Engine** for the **Newtonite Ops** platform.

The system ensures that operational commitments are tracked deterministically on the server, escalations execute with atomic idempotency (zero duplicate timeline events across concurrent workers and retries), and live urgency cues are presented to operators directly in the dashboard UI.

---

## 2. Design Decision for SLA Deadlines & Semantics

### 2.1 Deadline Calculation Policy
In high-reliability enterprise operations, SLA commitments represent non-negotiable service guarantees:
1. **Contractual Maximum SLA Deadline**:
   - `slaDeadline = createdAt + SLA_CONFIG[priority].durationMs`
   - Configurable default durations by priority:
     - `CRITICAL`: 2 hours (120 minutes)
     - `URGENT`: 6 hours (360 minutes)
     - `HIGH`: 24 hours (1,440 minutes)
     - `MEDIUM`: 72 hours (4,320 minutes)
     - `LOW`: 168 hours (10,080 minutes)
2. **Explicit User-Provided `dueDate` vs. SLA**:
   - If an operator assigns an explicit `dueDate`, the target deadline is calculated as:
     $$\text{targetDeadline} = \min(\text{dueDate}, \text{slaDeadline})$$
   - **Rationale**: An operator may schedule an incident for immediate triage earlier than the 2-hour SLA window, and that commitment is respected. However, an operator **cannot** schedule a due date 5 days in the future to bypass a critical 2-hour SLA guarantee.
   - The user-provided `dueDate` stored in PostgreSQL is **never overwritten** or mutated.
3. **Status Categorization**:
   - `RESOLVED`: Terminal items (`status === 'COMPLETED'` or `status === 'CANCELLED'`). Closed items **never** generate active escalations or breach alerts.
   - `BREACHED`: Active items where `timeRemainingMs <= 0`.
   - `AT_RISK`: Active items where `timeRemainingMs <= warningBufferMs` (warning buffer is $\le 25\%$ of duration or $\le 30$ minutes).
   - `HEALTHY`: Active items with comfortable resolution buffer.

### 2.2 Injectable Deterministic Clocks
All calculation functions and scanner services accept an injectable `now?: Date = new Date()` parameter. This permits instant, 100% deterministic test assertions without `setTimeout` delays or clock drift.

---

## 3. Idempotent Atomic Escalation & Outbox Architecture

```mermaid
sequenceDiagram
    autonumber
    participant Worker as Background / Scheduled Worker
    participant SlaSvc as SlaService
    participant DB as PostgreSQL (Prisma Tx)
    participant Outbox as OutboxWorker

    Worker->>SlaSvc: scanAndEscalate({ now })
    SlaSvc->>DB: Query active items (Take 50, Indexed)
    loop For Each Candidate Work Item
        SlaSvc->>SlaSvc: calculateSlaStatus(item, now)
        alt SLA Status Changed (e.g. AT_RISK or BREACHED)
            SlaSvc->>DB: BEGIN Transaction
            SlaSvc->>DB: UPDATE WorkItem SET lastEscalationStatus = :target WHERE id = :id AND lastEscalationStatus = :oldStatus
            alt Affected Rows == 0 (Race or already escalated)
                SlaSvc->>DB: ROLLBACK / Skip (No-Op)
            else Affected Rows == 1
                SlaSvc->>DB: INSERT ActivityEvent (action: ESCALATED, newState, metadata)
                SlaSvc->>DB: INSERT OutboxJob (eventType: WORK_ITEM_ESCALATED)
                SlaSvc->>DB: COMMIT Transaction
            end
        else SLA Status Unchanged or HEALTHY
            SlaSvc->>SlaSvc: Skip (Idempotent No-Op)
        end
    end
    Outbox->>DB: processBatch(100)
    Outbox->>Outbox: Dispatch WORK_ITEM_ESCALATED
```

### 3.1 Idempotency Guarantee
- The `WorkItem` model maintains `lastEscalationStatus String @default("NONE")`.
- When an escalation is evaluated, an atomic conditional query is executed inside a database transaction:
  ```sql
  UPDATE "WorkItem"
  SET "lastEscalationStatus" = 'BREACHED'
  WHERE "id" = :id
    AND "lastEscalationStatus" != 'BREACHED'
    AND "status" NOT IN ('COMPLETED', 'CANCELLED');
  ```
- If two background workers scan the same work item simultaneously, exactly one succeeds; the second receives an affected row count of `0` and safely skips.
- Repeated worker executions generate **strictly zero duplicate activity events** and **strictly zero duplicate outbox jobs**.

---

## 4. Summary of Files Changed & Created

| File | Status | Description |
| :--- | :---: | :--- |
| `packages/shared/src/index.ts` | **Modified** | Added `SlaStatus`, `SLA_CONFIG`, `SlaMetadata`, `SlaOverviewDTO`, `ActivityAction.ESCALATED`, and updated `WorkItemSummaryDTO`. |
| `prisma/schema.prisma` | **Modified** | Added `lastEscalationStatus` and `@@index([teamId, status, lastEscalationStatus])` to `WorkItem`. Added `ESCALATED` to `ActivityAction`. |
| `prisma/migrations/20261017132936_add_sla_escalation/` | **Created** | PostgreSQL migration adding schema columns and enum values. |
| `apps/api/src/modules/sla/sla-calculator.ts` | **Created** | Deterministic SLA calculator with injectable clock and warning buffer calculation. |
| `apps/api/src/modules/sla/sla-calculator.test.ts` | **Created** | Unit test suite covering healthy, at-risk, breached, priority durations, and closed items. |
| `apps/api/src/modules/sla/sla.service.ts` | **Created** | `SlaService` implementing `scanAndEscalate` and `getTeamSlaOverview` with team RBAC. |
| `apps/api/src/modules/outbox/outbox.worker.ts` | **Modified** | Registered built-in `WORK_ITEM_ESCALATED` handler and added `scanEscalations()` hook. |
| `apps/api/src/modules/work-items/work-items.service.ts` | **Modified** | Integrated `calculateSlaStatus` into `mapToDTO` for all list/detail/mutation endpoints. |
| `apps/api/src/modules/work-items/work-items.router.ts` | **Modified** | Added `GET /api/v1/items/sla/overview` and `POST /api/v1/items/sla/escalate` routes. |
| `apps/web/src/components/ui/Badge.tsx` | **Modified** | Added `SlaBadge` component with status styling (`Within SLA`, `At Risk`, `Breached`). |
| `apps/web/src/pages/DashboardPage.tsx` | **Modified** | Added SLA KPI overview banner, Urgent Attention queue, and SLA badges on item cards. |
| `apps/web/src/pages/WorkItemsPage.tsx` | **Modified** | Added `SLA Deadline` table column and badge rendering in work items catalog. |
| `apps/web/src/pages/WorkItemDetailPage.tsx` | **Modified** | Added SLA badge in header and SLA Commitment block in metadata grid. |
| `tests/integration/sla-escalation.test.ts` | **Created** | 9-scenario integration suite testing end-to-end SLA tracking, concurrency, and RBAC. |
| `ENGINEERING_DECISIONS.md` | **Modified** | Added ADR 016 covering SLA deadline derivation and escalation mechanics. |
| `KNOWN_LIMITATIONS.md` | **Modified** | Updated verified critical behaviours and documented operational boundaries. |
| `README.md` | **Modified** | Updated endpoints table and implementation status to reflect Step 6 completion. |

---

## 5. Actual Test Execution & Verification

### 5.1 Test Suite Summary
- **Test Files**: **13 passed**, 0 failed
- **Total Tests**: **94 passed**, 0 failed
- **Duration**: ~5.31s

```text
 ✓ apps/api/src/config/env.test.ts (4 tests)
 ✓ apps/api/src/modules/sla/sla-calculator.test.ts (6 tests)
 ✓ apps/api/src/modules/outbox/outbox.test.ts (4 tests)
 ✓ apps/api/src/modules/concurrency/concurrency.test.ts (6 tests)
 ✓ apps/api/src/modules/idempotency/idempotency.test.ts (6 tests)
 ✓ apps/api/src/modules/auth/auth.test.ts (11 tests)
 ✓ tests/integration/health.integration.test.ts (2 tests)
 ✓ tests/integration/optimistic-reconciliation.test.ts (3 tests)
 ✓ tests/integration/frontend-operations.test.ts (10 tests)
 ✓ tests/integration/end-to-end-user-flows.test.ts (15 tests)
 ✓ tests/integration/sla-escalation.test.ts (9 tests)
 ✓ apps/api/src/modules/work-items/work-items.test.ts (20 tests)

 Test Files  13 passed (13)
      Tests  94 passed (94)
```

### 5.2 Specific SLA Verification Scenarios Tested
1. **Scenario 1 (Calculated Metadata Exposure)**: Verified `GET /api/v1/items` and `GET /api/v1/items/:id` include valid `sla` structure.
2. **Scenario 2 (AT_RISK Escalation)**: Simulating `now` within warning buffer transitions `lastEscalationStatus` to `AT_RISK` and creates `ActivityEvent (ESCALATED)`.
3. **Scenario 3 (BREACHED Escalation)**: Simulating `now` past deadline transitions `lastEscalationStatus` to `BREACHED` and creates `OutboxJob (WORK_ITEM_ESCALATED)`.
4. **Scenario 4 (Priority Duration Mapping)**: Verified exact milliseconds for `CRITICAL (2h)`, `URGENT (6h)`, `HIGH (24h)`, `MEDIUM (72h)`, and `LOW (168h)`.
5. **Scenario 5 (Closed Items Exclusion)**: Verified items in `COMPLETED` or `CANCELLED` status produce `RESOLVED` SLA and **never** trigger active escalations even far in the future.
6. **Scenario 6 (Idempotent Repeated Runs)**: Repeated worker executions produce **zero duplicate** activity events and outbox records.
7. **Scenario 7 (Concurrent Worker Safety)**: 4 simultaneous workers executing `scanAndEscalate` concurrently update the item exactly once without duplicates.
8. **Scenario 8 (Team RBAC & Isolation)**: Cross-team request to `/sla/overview?teamId=<other>` returns `404 Not Found`.
9. **Scenario 9 (Manual Escalation API)**: `POST /api/v1/items/sla/escalate` triggers on-demand scanning with audit output.

---

## 6. Quality Gate Results

| Quality Gate | Command | Result |
| :--- | :--- | :---: |
| **All Automated Tests** | `npm test` | **PASS** (94 passed, 0 failed across 13 suites) |
| **TypeScript Strict Typecheck** | `npm run typecheck` (`tsc --noEmit`) | **PASS** (0 errors) |
| **ESLint Quality Check** | `npm run lint` (`eslint .`) | **PASS** (0 errors, 0 warnings) |
| **Code Style Formatting** | `npm run format:check` (`prettier --check`) | **PASS** (100% compliant) |
| **API Production Build** | `npm run build:api` (`tsc -p apps/api/tsconfig.json`) | **PASS** (Clean build) |
| **Web Production Build** | `npm run build:web` (`vite build apps/web`) | **PASS** (`dist/assets/index-UxF41BJa.js` 219.07 kB) |
| **Database Seeding** | `npm run db:seed` (`tsx prisma/seed.ts`) | **PASS** (4 teams, 10 users, 10 work items in <3s) |

---

## 7. Known Limitations & Architectural Boundaries

1. **Scheduled Polling Interval**: The SLA engine can be triggered via `POST /api/v1/items/sla/escalate` or run inside the existing `OutboxWorker` polling loop. In production, an external cron or K8s CronJob can ping `/sla/escalate` every 60 seconds.
2. **Third-Party Webhook Dispatchers**: Outbox worker logs dispatched `WORK_ITEM_ESCALATED` events. Integrating actual outbound webhook push (e.g. Slack/PagerDuty/OpsGenie) can attach to the existing registered outbox event handler without changing database models.
3. **Session Scoping**: Authentication tokens remain in `sessionStorage` per browser tab, supporting simultaneous multi-role testing while ensuring shared workstations leave no persisted session on tab closure.
