# Bugs, Root Causes, and Verification Fixes — Newtonite Ops

> **Document Version:** 1.0.0  
> **Evaluation Phase:** Comprehensive End-to-End QA & Deep Operational Verification  
> **Status:** All Confirmed Defects Remediated and Regression-Tested

---

## 1. Defect Summary Table

| Defect ID   | Severity | Category         | Component                                      |  Status   | Regression Test                     |
| :---------- | :------: | :--------------- | :--------------------------------------------- | :-------: | :---------------------------------- |
| **BUG-001** |   High   | AI Integration   | Groq AI Provider Model Resolution              | **FIXED** | `ai-assistant.integration.test.ts`  |
| **BUG-002** |   High   | AI Integration   | Groq 401 Unauthorized API Key Handling         | **FIXED** | `ai-assistant.integration.test.ts`  |
| **BUG-003** |  Medium  | Frontend / State | Dynamic Logo Persistence Across Reboots        | **FIXED** | Browser agent reload verification   |
| **BUG-004** |  Medium  | Settings / SMTP  | Offline SMTP Socket Timeout Resilience         | **FIXED** | `settings-configuration.test.ts`    |
| **BUG-005** |   High   | Team Directory   | Dedicated Team List Navigation Decoupling      | **FIXED** | Browser agent e2e journey           |
| **BUG-006** |   Low    | UI / Ergonomics  | Sidebar Layout Clutter & RBAC Switcher Removal | **FIXED** | Browser agent snapshot verification |
| **BUG-007** |  Medium  | TypeScript / DB  | Prisma InputJsonValue Type Casting in Teardown | **FIXED** | `npm run typecheck`                 |
| **BUG-008** |  Medium  | Frontend API     | CreateUserAdmin Schema Property Alignment      | **FIXED** | `npm run typecheck`                 |

---

## 2. Detailed Bug Reports and Resolutions

### BUG-001: Groq AI Provider 404 Model Not Found

- **Severity:** High
- **Discovered In:** AI Operations Assistant initialization
- **Reproduction Steps:**
  1. Set AI Provider to `groq` in Settings Center.
  2. Attempt to query the assistant using default model `llama-3.3-70b-versatile` on accounts without tier-3 beta access.
  3. API threw `404 invalid_request_error: The model does not exist or you do not have access to it`.
- **Root Cause:** Certain Groq API keys only possess default access to lightweight instant models like `llama-3.1-8b-instant`.
- **Fix:**
  - Added intelligent fallback mechanism in `apps/api/src/modules/ai/groq.provider.ts`: if the requested model returns `model_not_found`, the provider attempts a safe retry with `llama-3.1-8b-instant`.
  - Added specific error diagnostics instructing the administrator to select `llama-3.1-8b-instant` in Settings.
- **Verification:** Tested with both Groq API keys and simulated provider errors; confirmed graceful fallback and 100% test pass.

---

### BUG-002: Groq 401 Unauthorized API Key Exception

- **Severity:** High
- **Discovered In:** AI Operations Assistant live invocation
- **Reproduction Steps:**
  1. Start application with an invalid, revoked, or placeholder Groq API key (`gsk_...`).
  2. Query the assistant endpoint `POST /api/v1/ai/assistant`.
  3. System threw unhandled 401 error.
- **Root Cause:** Provider threw native SDK error without mapping it to Newtonite's standardized `AppError` envelope.
- **Fix:**
  - Added error catch block in `groq.provider.ts` translating `invalid_api_key` to `AppError(401, "Invalid Groq API Key. Please update your API key in Settings -> AI Configuration.")`.
  - Added pre-flight check in `ai-assistant.service.ts` checking if API key is populated before initiating remote socket connection.
- **Verification:** Verified in integration tests; client receives clean 401 JSON error with user-actionable instructions.

---

### BUG-003: Dynamic Logo Resetting on Page Reload / Server Restart

- **Severity:** Medium
- **Discovered In:** Frontend Branding & Appearance
- **Reproduction Steps:**
  1. Upload custom logo in Settings Center.
  2. Restart the backend API or refresh the browser before API `/settings/public/branding` responds.
  3. UI briefly rendered default fallback logo and lost customized visual branding.
- **Root Cause:** React initial state defaulted to empty fallback before the async API response resolved, creating visual flickering and stale state on slow connections.
- **Fix:**
  - Implemented persistent localStorage cache `newtonite_branding_cache` in `apps/web/src/app/App.tsx`.
  - React initial state now hydrates synchronously from `localStorage.getItem('newtonite_branding_cache')` instantly on first render frame.
  - Asynchronously reconciles with `/settings/public/branding` upon network completion.
- **Verification:** Verified across page reloads and simulated cold-start restarts; custom logo persists instantly with zero layout shifts.

---

### BUG-004: Offline SMTP Socket Timeout Resilience

- **Severity:** Medium
- **Discovered In:** Settings Center Email Configuration
- **Reproduction Steps:**
  1. Trigger email connection test in an environment without internet access or invalid SMTP host.
  2. Request hung for default OS TCP timeout (up to 60 seconds).
- **Root Cause:** Nodemailer default connection timeout was unbounded.
- **Fix:**
  - Set explicit 5,000ms connection timeout and socket timeout in `apps/api/src/modules/settings/email.service.ts`:
    ```typescript
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
    ```
  - Wrapped connection in structured try-catch returning clean diagnostic message (`"SMTP connection failed: Host unreachable or connection timed out after 5s"`).
- **Verification:** Tested in offline simulated test environment; returns clean 400 error in <5.2s without process hang.

---

### BUG-005: Dedicated Team List Navigation Decoupling

- **Severity:** High
- **Discovered In:** Sidebar navigation usability review
- **Reproduction Steps:**
  1. User clicked "Team List" in the sidebar.
  2. UI redirected to Settings Center (`/settings?tab=teams`), blurring the separation between operational squad management and system configuration.
- **Root Cause:** Team management lacked a dedicated top-level route and was nested solely as sub-tab 5 of the Settings page.
- **Fix:**
  - Created standalone `apps/web/src/pages/TeamListPage.tsx`.
  - Added operational squad cards (showing member counts, slugs, descriptions, and interactive click-to-filter capability).
  - Added dual-view workspace: Team Memberships table and All System Accounts directory.
  - Updated `AppLayout.tsx` and `App.tsx` to handle `currentView === 'teams'` as a first-class operational view.
- **Verification:** Browser agent verified clicking "Team List" opens the standalone Team Directory page while "Setting" remains completely separate.

---

### BUG-006: Sidebar Layout Clutter & RBAC Switcher Removal

- **Severity:** Low
- **Discovered In:** Production UI readiness audit
- **Reproduction Steps:**
  1. Sidebar rendered an oversized "ACTIVE PERSONA (RBAC)" card occupying ~200px of vertical space with stacked buttons for Bob, Evan, Ian, and Alice.
  2. Cluttered operational view and pushed user profile off small screens.
- **Root Cause:** Persona switcher card from development prototype remained visible in the production layout.
- **Fix:**
  - Removed persona switcher card cleanly from `apps/web/src/components/layout/AppLayout.tsx`.
  - Replaced bulky emojis with crisp Lucide-style vector SVG icons.
  - Kept user profile avatar, role badge, and exit button cleanly anchored at the bottom footer.
- **Verification:** Browser automation captured desktop screenshot showing clean, balanced, professional SaaS layout.

---

### BUG-007: Prisma InputJsonValue Type Casting in Test Teardown

- **Severity:** Medium
- **Discovered In:** TypeScript compilation gate
- **Reproduction Steps:**
  1. Ran `npm run typecheck` (`tsc --noEmit`).
  2. Received `error TS2322: Type 'Record<string, unknown>' is not assignable to type 'JsonNull | InputJsonValue | undefined'`.
- **Root Cause:** Prisma 6 strictly types JSON field inputs in `SystemSettingUpdateInput`.
- **Fix:**
  - Imported `type { Prisma } from '@prisma/client'`.
  - Cast original value to `Prisma.InputJsonValue` in `tests/integration/ai-assistant.integration.test.ts`.
- **Verification:** `tsc --noEmit` exits with code 0 across the entire workspace.

---

### BUG-008: CreateUserAdmin Schema Property Alignment

- **Severity:** Medium
- **Discovered In:** `TeamListPage.tsx` type checking
- **Reproduction Steps:**
  1. `TeamListPage.tsx` invoked `createUserAdmin` passing `initialTeamId` and `initialTeamRole`.
  2. Typecheck failed with `TS2353: 'initialTeamId' does not exist in type 'CreateUserAdminInput'`.
- **Root Cause:** Shared domain schema defines properties as `teamId` and `teamRole`.
- **Fix:**
  - Aligned property names in `TeamListPage.tsx` to `teamId` and `teamRole`.
  - Removed unused variable `activeMembers`.
- **Verification:** `npm run typecheck` and `npm run lint` pass with 0 errors.
