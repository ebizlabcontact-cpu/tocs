# TOCS Sprint 1 — Target State Specification

| Field | Value |
|-------|--------|
| **Version** | v1.0.0 |
| **Status** | **Acceptance specification — authoritative over task interpretation** |
| **Parent documents** | `TOCS_IMPLEMENTATION_MASTER_PLAN.md` v1.1.0, `SPRINT1_BACKLOG.md` v1.0.0 |
| **Branch baseline** | `tocs-frontend-design` @ `9046d2a` |
| **Last updated** | 2026-07-06 |
| **Mode** | Specification only — no code changes |

**Rule:** Sprint 1 tasks are complete **only if** the running system matches this document. Where backlog tasks and this spec differ, **this spec wins**.

**Closed decision (do not reopen):** Owning Company = Operating Scope (DL-050).

---

# 1. Sprint Goal

Sprint 1 establishes the **Formula read/create foundation** and the **operating boundary** between the product UI and the TOCS backend engine.

When Sprint 1 is finished:

- A user can **sign in**, **select an operating company**, **browse formulas scoped to that company**, **open a formula**, and **create a new formula** through the wizard with data **persisted in PostgreSQL** via existing MVP APIs.
- The frontend **no longer reads Formula list or Formula identity from `mock-data.ts`** for those core flows. All such reads go through `web/lib/data/repository.ts` and the HTTP API when `NEXT_PUBLIC_API_MODE=api` (or equivalent).
- **Child rows created during wizard orchestration** (participants, payment schedules, logistics legs, shares) are **readable from backend GET endpoints** where the Detail adapter loads them; they are **display-only** — no tab-level mutations.
- **Financial and lifecycle derivations** (realized profit, receivable/payable, expected profit, close readiness, settlement balances, timeline synthesis, attention alerts) **remain preview/mock** until later sprints pass semantic equivalence checks (Master Plan §6).
- **Payment, Invoice, Logistics status, Share edit, Version commit, Close, Cancel, Dashboard KPI, and Reports** remain **intentionally deferred** to Sprint 2+.

Sprint 1 does **not** deliver end-to-end trade operations. It delivers **authenticated, scoped Formula discovery and creation** as the first production-capable vertical slice.

---

# 2. Screen Target State

| Screen | Current (baseline @ `9046d2a`) | Target after Sprint 1 | Remaining mock | Deferred sprint |
|--------|--------------------------------|----------------------|----------------|-----------------|
| **Dashboard** | Full mock KPI, attention, loss ranking, profit chart (`mock-data.ts`) | Unchanged UX; **still mock-backed**. May require login + scope to view. | All KPI aggregates, attention rules, profit series, formula mini-rows | Sprint 5 (Dashboard API) |
| **Reports** | Mock aggregates (`web/lib/reports.ts`, `mock-data.ts`) | Unchanged UX; **still mock-backed** | All report datasets | Sprint 5 |
| **Formula List** | Mock list; page may be missing locally | **API-backed list** via `repository.listFormulas(scope)`; loading/error/empty states | Client-side attention/loss badges if derived locally; analytics perspective merge | Sprint 5 filters/pagination hardening |
| **Formula Detail** | Mock `getFormula(id)`; KPI pills from `deriveSettlement`; close from mock `closeable` | **API-backed formula header** (id, formula_no, six statuses, quantity, unit, item_id, is_closed); **read-only child tabs** for wizard-created data where adapter loads GET sub-resources; **preview KPI pills** unchanged | `deriveSettlement`, `deriveExpected`, `formula.closeable`, `getVersionHistory`, `buildTimeline` synthesis, all write actions | Sprint 2–5 per tab |
| **Formula Wizard** | 5-step UI; submit = `setTimeout` redirect | **Persist via `createFormulaOrchestration`**; redirect to real Detail id; validation + submit errors | Item picker labels from `web/lib/items.ts` (no Item API); live preview math remains client-side | Item API (G8); draft save (V2) |
| **Settlement** | Cross-formula mock page | Unchanged; **mock-backed** | All settlement aggregates | Sprint 2+ (per-formula settlement tab partially mock until Sprint 2) |
| **Calendar** | Mock events | Unchanged; **mock-backed** | Calendar events | No MVP calendar API — indefinite mock |
| **Company Context** | Hardcoded mock companies | **`me().companyIds`** drives switcher; scope sent on business API calls | Company display names if not loaded from `GET /companies` | Company update UI (G9) |
| **Authentication** | No login gate | **Login page**, token session, `RequireAuth` on business routes, 401 → login | Token refresh policy minimal | Full RBAC action hiding (Sprint 2+) |

---

# 3. Formula Detail Target

Legend: **API** = backend authoritative read; **Repo** = `repository` method; **Adapter** = `web/lib/api/adapters/*`; **Mock** = mock-data or client derivation; **Deferred** = not in Sprint 1 scope.

| Tab | Backend API (read) | Repository | Adapter | Mock / preview | Deferred |
|-----|-------------------|------------|---------|----------------|----------|
| **Overview** | `GET /api/v1/formulas/:id` | `getFormula` | `formula-adapter` | Six-status display mapping; **KPI pills** (`deriveSettlement`); **equation** (`deriveExpected`); six-status **write** actions | Status completion routes G1–G4; expected KPI API (Sprint 4) |
| **Participants** | `GET /api/v1/formulas/:id/participants` | `getFormula` composite or `listParticipants` | `formula-adapter` | Empty state if create skipped participants; company name labels if not resolved | Participant create/edit/delete UI (Sprint 4); perspective KPI (Sprint 5) |
| **Payments** | `GET .../payment-schedules`, `GET .../payment-records` | composite detail load | payment slice in adapter | Schedule fulfillment math; **no record create/cancel** | Sprint 2 mutations + confirmed KPI |
| **Invoices** | `GET .../invoices` (read exists) | optional composite read | invoice slice | Full tab if wizard did not create invoices (typical) | Sprint 3 create/status |
| **Logistics** | `GET .../logistics` | composite read | logistics slice | Vehicle cards beyond `vehicle_count`; delivery status action | Sprint 3 status; vehicle CRUD (G5) |
| **Shares** | `GET .../shares` | composite read | share slice | — | Sprint 4 share CRUD |
| **Settlement** | — | — | — | **Entire tab**: `deriveSettlement`, close checklist from mock `closeable` | Sprint 2–3 (balances from API); close API (Sprint 3) |
| **Versions** | `GET .../versions`, `GET .../versions/latest` (exist; optional wire) | not required for Sprint 1 exit | — | **`getVersionHistory(mock)`** default unless explicitly wired | Sprint 4 version/snapshot UI |
| **Timeline** | Status logs only inline from future mutations | — | — | **`buildTimeline(formula, mockVersionHistory)`** — client synthesis | Sprint 5 status log feed |

**Detail header (above tabs):** API authoritative for `formula_no`, trade type, six statuses, `is_closed`, dates, quantity, unit. **Close button:** display-only or disabled — **not** wired to `POST .../close` (Sprint 3). **Attention banner:** mock-derived (`derive.ts` / mock fields).

---

# 4. API Authority Matrix

| Screen / surface | Current source | Sprint 1 source | Authoritative backend endpoint | Preview-only | Mock |
|------------------|----------------|-----------------|-------------------------------|--------------|------|
| Login | None | API | `POST /api/v1/auth/login` | — | — |
| Session / user | None | API | `GET /api/v1/auth/me` | — | — |
| Company switcher | `mock-data.companies` | API + `me` | `GET /api/v1/auth/me`; optional `GET /api/v1/companies` | — | Fallback labels if companies GET skipped |
| Formula List | `mock-data` | API | `GET /api/v1/formulas` | — | Mock mode env flag only |
| Formula Detail — identity | `mock-data` | API | `GET /api/v1/formulas/:id` | — | Mock mode env flag |
| Formula Detail — participants | `mock-data` nested | API (composite) | `GET /api/v1/formulas/:id/participants` | — | Empty if not loaded |
| Formula Detail — schedules/records | `mock-data` nested | API (composite) | `GET .../payment-schedules`, `GET .../payment-records` | Fulfillment display | Preview math |
| Formula Detail — invoices | `mock-data` nested | Optional API read | `GET .../invoices` | — | Empty typical post-create |
| Formula Detail — logistics | `mock-data` nested | API (composite) | `GET .../logistics` | Vehicle UI | G5 gap |
| Formula Detail — shares | `mock-data` nested | API (composite) | `GET .../shares` | — | — |
| Formula Detail — KPI pills | `formula-math.deriveSettlement` | **Preview-only** | — | `deriveSettlement` | Until Sprint 2 equivalence |
| Formula Detail — equation | `formula-math.deriveExpected` | **Preview-only** | — | `deriveExpected` | Until Sprint 4 equivalence |
| Formula Detail — close state | `formula-math.isCloseable` / mock field | **Preview-only** | — | Mock closeable | `GET .../status` Sprint 3 |
| Formula Wizard — persist | None (fake redirect) | API | Orchestration: `POST /formulas`, `POST .../participants`, `POST .../payment-schedules`, `POST .../logistics`, `POST .../shares` (+ embedded version payloads) | Wizard step preview math | Item catalog `items.ts` |
| Dashboard | `mock-data` | **Mock** | — | — | Entire screen |
| Reports | `mock-data` / `reports.ts` | **Mock** | — | — | Entire screen |
| Calendar | `mock-data` | **Mock** | — | — | Entire screen |
| Cross-formula Payments/Invoices/Logistics pages | `mock-data` | **Mock** | — | — | Sprint 2+ |

---

# 5. Repository Completion

| Method | Sprint 1 status | Notes |
|--------|-----------------|-------|
| `login` | **Completed** (API) | Was rejected stub |
| `me` | **Completed** (API) | Drives scope |
| `listFormulas` | **Completed** (API + mock flag) | Scope required |
| `listFormulasInRange` | **Completed** (API + mock flag) | Maps query params |
| `getFormula` | **Completed** (API + mock flag) | May composite sub-reads |
| `createFormula` | **Completed** (API) | Single row |
| `createFormulaOrchestration` | **Completed** (API) | Wizard persist |
| `listCompanies` / `listAccessibleCompanies` | **Mock or partial API** | Labels for switcher |
| `getKpis` | **Mock** | Deferred Sprint 5 |
| `getProfitSeries` | **Mock** | Deferred Sprint 5 |
| `getCalendarEvents` | **Mock** | No calendar API |
| `getFormulaCloseStatus` | **Preview mock** | Deferred Sprint 3 |
| `closeFormula` | **Deferred** (rejected) | Sprint 3 |
| `getFormulaConfirmedKpi` | **Preview mock** | Deferred Sprint 2 |
| `getFormulaExpectedKpi` | **Preview mock** | Deferred Sprint 4 |
| `getFormulaReceivablePayable` | **Preview mock** | Deferred Sprint 2 |
| `listParticipantKpi` | **Preview mock** | Deferred Sprint 5 |
| `listUnmatchedPayments` | **Preview mock** | Deferred Sprint 5 |
| `createPaymentSchedule` / `createPaymentRecord` / `cancelPaymentRecord` | **Deferred** | Sprint 2 |
| `createInvoice` / `updateInvoiceStatus` | **Deferred** | Sprint 3 |
| `updateLogisticsStatus` | **Deferred** | Sprint 3 |
| `createShare` / `updateShare` / `deleteShare` | **Deferred** | Sprint 4 |
| `createVersion` | **Deferred** (orchestration internal only) | Sprint 4 UI |
| `cancelFormula` | **Deferred** | Sprint 5 |
| `updateFormula` | **Deferred** | Metadata patch P1 |
| `allFormulas` export | **Removed** from Sprint 1 pages | Direct import eliminated per T11 |

---

# 6. Formula Engine Coverage

Values that become **backend-authoritative** in Sprint 1 (read or write):

| Domain | Backend-authoritative in Sprint 1 | Source |
|--------|-----------------------------------|--------|
| **Formula metadata** | Yes | `formulas` row via `GET/POST /api/v1/formulas` — `formula_no`, `trade_type`, `quantity`, `unit`, `item_id`, `content`/`note` if sent on create, six status columns, `is_closed`, `closed_at`, timestamps |
| **Participants** | Yes (read after create) | `formula_participants` via `GET .../participants` and `POST` during orchestration |
| **Payment schedules** | Yes (read after create) | `formula_payment_schedules` via GET; created during orchestration |
| **Payment records** | Read only if pre-existing in DB | GET exists; wizard typically does not create records in Sprint 1 |
| **Logistics legs** | Yes (read after create) | `formula_logistics` via GET; created during orchestration |
| **Shares** | Yes (read after create) | `formula_shares` via GET; created during orchestration |
| **Versions / snapshots** | Written during orchestration; **not displayed authoritatively** | Version rows created as side effect of participant/logistics/share POST payloads; Versions tab remains mock unless explicitly wired |
| **Operating scope** | Yes | `X-Company-Id` / `X-Company-Scope` + backend scope filters on list |
| **Read model (list/detail identity)** | Yes | Formula list + detail identity fields from API |

**Explicitly NOT backend-authoritative in Sprint 1** (remain preview/mock — do not claim completion):

| Domain | Sprint 1 state |
|--------|----------------|
| Settlement balances | Preview (`deriveSettlement`) |
| Realized KPI | Preview |
| Payment rates (receive/payment rate) | Preview |
| Invoice verification / `amount_verified` display | Mock tab data |
| Perspective KPI | Preview |
| Close engine / `can_close` | Preview |
| Expected totals / expected profit | Preview (`deriveExpected`) |
| Attention / loss ranking | Mock derivation |
| Dashboard / Reports aggregates | Mock |

---

# 7. User Workflow Coverage

| Workflow | Status | Notes |
|----------|--------|-------|
| Login | **YES** | Email/password against backend; unauthenticated users blocked from business routes |
| Switch company | **YES** | Switcher from `me().companyIds`; SUPER_ADMIN all-scope if supported |
| Browse formulas | **YES** | Scoped list from API |
| Search | **PARTIAL** | No dedicated backend full-text search; client filter on loaded page only if UI provides search box |
| Filter | **PARTIAL** | Backend supports `trade_status`, `is_closed`, date range, pagination; UI maps subset |
| Open detail | **YES** | Navigate to `/formulas/:id` with API-backed header + read-only tabs |
| Create formula | **YES** | Wizard orchestration persists; lands on new Detail |
| Return to list | **YES** | Back link; list shows new formula after navigation |
| Refresh | **PARTIAL** | Re-navigation refetches; explicit pull-to-refresh/reload button optional |
| Edit formula metadata | **NO** | Deferred |
| Record payment / invoice / close / cancel | **NO** | Sprint 2+ |

---

# 8. Mock Retention Matrix

| Feature | Mock retained | Reason | Replacement sprint | Validation before removal |
|---------|:-------------:|--------|-------------------|---------------------------|
| Dashboard KPI cards | Yes | No Sprint 1 wiring | Sprint 5 | Confirmed KPI vs mock aggregates |
| Reports workspace | Yes | No Sprint 1 wiring | Sprint 5 | Report slice equivalence |
| Calendar events | Yes | No calendar API | Indefinite / composite | N/A |
| `formula-math` deriveSettlement | Yes | Semantic equivalence not done | Sprint 2 | `GET .../receivable-payable`, confirmed KPI |
| `formula-math` deriveExpected | Yes | Semantic equivalence not done | Sprint 4 | `GET .../kpi/expected` |
| `formula-math` isCloseable | Yes | Close API not wired | Sprint 3 | `GET .../status` |
| Detail Timeline synthesis | Yes | No status-log list API in Sprint 1 | Sprint 5 | Mutation response + logs |
| Versions tab history | Yes | Optional read not required for exit | Sprint 4 | `GET .../versions` |
| Attention widget | Yes | Client rules on mock fields | Sprint 5 | API-derived fields |
| Item catalog (`items.ts`) | Yes | No Item API (G8) | TBD / seed UUID | Item CRUD or seed contract |
| `mock-data.ts` (Dashboard, cross-pages) | Yes | Out of Sprint 1 scope | Sprint 5 | Per Master Plan §6 chain |
| Mock mode env flag | Yes | Offline/dev fallback | Post–Gate 6 | N/A |
| Wizard live preview math | Yes | Client preview only; not persistence | Sprint 4+ for expected display | Expected KPI equivalence |

---

# 9. Deferred Features

Explicitly **not** delivered in Sprint 1:

| Feature | Deferred to |
|---------|-------------|
| **Payments** — schedule/record create, cancel, fulfillment refresh | Sprint 2 |
| **Invoices** — create, status update, amount_verified UX | Sprint 3 |
| **Logistics** — status update, delivery action | Sprint 3 |
| **Shares** — CRUD UI | Sprint 4 |
| **Versions** — commit UI, snapshot display | Sprint 4 |
| **Snapshots** — authoritative expected profit display | Sprint 4 |
| **Cancel** formula | Sprint 5 |
| **Dashboard KPI** API | Sprint 5 |
| **Reports KPI** API | Sprint 5 |
| **Participant KPI** / perspective metrics | Sprint 5 |
| **Close API** — status pre-check + execute | Sprint 3 |
| Payment preview removal | Sprint 2 (post-equivalence) |
| Metadata PATCH (`content`, `note`, `unit`) | P1 |
| Company update | G9 / P1 |
| Six-status manual completion (trade/delivery/cash) | Backend route gaps G1–G4 |
| Auth RBAC action matrix (hide by role) | Sprint 2+ polish |
| Settlement cross-formula page | Sprint 2+ |

---

# 10. Sprint Exit Checklist

Sprint 1 is **complete only if** all items pass:

| # | Criterion | Evidence |
|---|-----------|----------|
| 1 | Repository complete for Sprint 1 scope | §5 — login, me, list, get, create, orchestration API-backed |
| 2 | API adapter complete | `formula-adapter`, `wizard-to-api`, error mapping; `SPRINT1_DTO_VALIDATION.md` |
| 3 | Formula DTO verified | T12 pass — no `item`/`item_id` divergence; `formula_no` read-only |
| 4 | Loading states complete | List, Detail, Wizard, Login |
| 5 | Error states complete | API errors surfaced; 401 → login; 409 visible on create failure |
| 6 | Empty states complete | Empty formula list; Detail 404 |
| 7 | Read/Create workflow complete | §7 — Login through Create → Detail → List |
| 8 | Typecheck pass | T13 |
| 9 | Build pass | T14 |
| 10 | Cursor Audit pass | T15 — Formula First, layer discipline, semantics |
| 11 | GPT Review pass | T16 sign-off |
| 12 | No Formula First divergence | No Deal/Order roots; all flows formula-scoped |
| 13 | No backend semantic divergence | Payment records do not imply cash status complete; receivable/payable not shown as close gate; preview labeled |
| 14 | Gate 2 packet published | T17 |
| 15 | Sprint 1 pages free of direct `mock-data` imports | T11 — List, Detail, Wizard steps, Company context |

**Not required for Sprint 1 exit:** Dashboard API, payment mutations, close button execution, mock preview removal (`formula-math`), Versions tab API read.

---

# 11. Sprint Success Definition

## What Sprint 1 delivers to an actual user

After Sprint 1, a TOCS user working for a registered company can **sign in**, **choose which company they are operating as**, and **see the real formulas that company participates in** — not a demo dataset frozen in the browser.

They can **open any formula** and see its **official formula number, trade type, quantities, and lifecycle status fields** as stored in the database, along with **participants, payment schedules, logistics legs, and shares** that were saved when the formula was created.

They can **start a new formula** in the wizard, walk through the trade chain and settlement structure, and **submit once** to create a durable record. The system assigns the formula number; the user is taken to the new formula’s detail page where they can confirm what was saved.

What they **cannot** yet do in the product — by design — is register bank movements, issue or match invoices, mark logistics complete, adjust shares, close the formula, or see company-wide profit on the dashboard driven by live bank-confirmed figures. Those figures may still appear on screen for orientation, but they are **preview calculations**, not the accounting truth.

Sprint 1’s business value is **trust in the foundation**: authenticated access, correct company scope, and **real Formula creation and discovery** — the minimum vertical slice on which every later settlement, invoice, and close workflow depends.

---

## Conflict Register (spec vs backlog)

| Item | Resolution |
|------|------------|
| Backlog T7 optional composite sub-reads | **This spec requires** read-only display of wizard-created child rows from GET endpoints for Sprint 1 exit; otherwise Create cannot be verified |
| Versions tab mock vs API | **Mock retained** for exit unless team explicitly adds optional wire; does not block Gate 2 |
| Search/filter | **PARTIAL** acceptable; full server search not required |
| Dashboard unchanged | Consistent with Master Plan — not a Sprint 1 regression if still mock |

---

*End of Sprint 1 Target State Specification — acceptance authority for Gate 2.*
