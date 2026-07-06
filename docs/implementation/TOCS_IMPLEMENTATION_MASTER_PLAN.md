# TOCS Implementation Master Plan

| Field | Value |
|-------|--------|
| **Version** | v1.1.0 |
| **Status** | **Gate 1 review corrections applied — awaiting Gate 1 approval** |
| **Branch baseline** | `tocs-frontend-design` @ `9046d2a` |
| **Last updated** | 2026-07-06 |
| **Mode** | Planning document only — no code changes implied until sprint gates pass |

---

## Backend Semantics Preservation (Global Engineering Principle)

**Every sprint must preserve TOCS backend semantics.**

The objective is **not** replacing mock data with APIs. The objective is **replacing preview-only frontend derivations with backend-authoritative engine results without introducing semantic divergence.**

No implementation may alter Formula First architecture.

---

**Purpose:** Control the next implementation phase so Cursor, v0, backend, and frontend work follow one sequence and do not diverge.

**Current project phase:**

```
UI/UX Completion
        ↓
API Integration
```

**Source of truth:**

- `docs/master/TOCS_MASTER_SPEC.md`
- `docs/decisions/DECISION_LOG.md`
- `PROJECT_CONTEXT.md`
- `prisma/schema.prisma`, `db/schema/**`
- `src/**` (backend engine)
- `web/**` (product UI prototype)
- Latest Workflow Audit + Engine Impact Audit (conversation baseline 2026-07-06)

**Related specs:**

- `docs/api/API_MVP_SCOPE.md` — 48 Core MVP HTTP routes complete
- `docs/specs/PRODUCT_UI_IMPLEMENTATION_SCOPE.md` — UI-P1…P5 shell (mock phase)
- `docs/specs/GLOBAL_COMPANY_CONTEXT_POLICY.md` — DL-050 scope headers
- `.cursor/rules/tocs-core.mdc` — architecture non-negotiables

**Closed architectural decision (do not reopen):**

> **Owning Company = Operating Scope** (DL-050). The Header Company Switcher sets global operating scope. Formula creation and all business reads/writes occur within that scope. There is no separate formula-owner entity or cross-scope ownership model in MVP.

---

## Mandatory Review Cycle

After **every** Sprint, the following cycle is **mandatory**. No sprint may advance without completing it in order:

```
Implementation
        ↓
Typecheck
        ↓
Build
        ↓
Cursor Audit
        ↓
GPT Review
        ↓
Approval Gate
        ↓
Next Sprint
```

---

## Sprint Exit Gate (all sprints)

Each Sprint must explicitly pass **all** of the following before the next Sprint starts:

| Exit check | Required |
|------------|----------|
| Typecheck | Pass |
| Build | Pass |
| Workflow Audit | Pass |
| Engine Impact Audit | Pass |
| Formula First Audit | Pass |

---

## 1. Current Project State

### 1.1 Backend completion

| Area | Status | Evidence |
|------|--------|----------|
| DB schema | **Verified** | PostgreSQL SQL source of truth; views in `db/schema/tocs_supplement.sql` |
| Prisma mapping | **Validated** | ORM only; no migrate |
| HTTP layer | **Complete (MVP Core)** | 48 routes across Formula, Payment, Invoice, Logistics, Share, Version, Close, Cancel, Settlement, Company, Participant, Dashboard, Auth, Health (`docs/api/API_MVP_SCOPE.md`) |
| Service / Repository / Action layers | **Complete for MVP scope** | `src/services/**`, `src/repositories/**`, `src/actions/**` |
| Auth + RBAC middleware | **Shipped** | JWT, company context (`X-Company-Id`, `X-Company-Scope: all`) |
| Integration tests | **28 test files** | Formula, payment, invoice, close, cancel, share, version, logistics, settlement, auth, dashboard |
| Known backend gaps | **Documented** | See §10 Backend Route Gaps + §10 Open Decisions |

Backend engine is **production-capable for MVP mutations** on all shipped routes. Remaining gaps are **backend capability gaps**, not Sprint blockers (see §10 Backend Route Gaps).

### 1.2 Frontend UI read coverage

| Surface | Status | Notes |
|---------|--------|-------|
| App shell + navigation | **Implemented** | `web/app/layout.tsx`, `web/components/**` |
| Global company switcher | **Mock only** | `web/components/company-context.tsx` — hardcoded companies, no JWT/me |
| Dashboard | **Read mock** | `web/app/page.tsx` — KPI, attention, loss ranking from `mock-data.ts` |
| Formula List | **Read mock** | `web/app/formulas/page.tsx` — local disk state may differ from HEAD; see Working Tree Verification |
| Formula Detail (9 tabs) | **Read mock** | Overview, Timeline, Participants, Payments, Invoices, Logistics, Shares, Versions, Settlement |
| Formula Wizard | **UI complete, no persist** | 5-step wizard; submit = `setTimeout` redirect |
| Cross-formula pages | **Read mock** | Payments, Invoices, Logistics, Settlement, Reports, Calendar, Companies, Items |
| Close / Cancel controls | **Display only** | Close button uses mock `formula.closeable`; no handler; Cancel action missing |
| Auth login gate | **Missing** | No login page; no token storage |

**Weighted read/navigation coverage:** ~90%  
**Weighted operational workflow coverage:** ~35% (display exists; writes absent)

### 1.3 Workflow interaction gaps

All P0 mutation workflows lack working UI write handlers:

| P0 workflow | UI gap |
|-------------|--------|
| Formula Create | Wizard does not call repository; no multi-step orchestration |
| Payment schedule / record / cancel | Tables display-only in `detail-panels.tsx` |
| Invoice create / status | Display-only |
| Logistics status update | Display-only; delivery uses separate mock field |
| Six-status manual completion | Only logistics badge exists; no actions for trade/cash/delivery (routes not shipped — UI may stub/disable per §10 Backend Route Gaps) |
| Close Formula | Button disabled or non-functional; mock closeable |
| Cancel Formula | No UI action |
| Share CRUD | Display-only |

Repository intentionally rejects writes (`web/lib/data/repository.ts`).

### 1.4 API integration status

| Layer | Status |
|-------|--------|
| Backend HTTP API | **Live-capable** (Fastify server in `src/http/server.ts`) |
| Frontend HTTP client | **Not implemented** — no fetch wrapper, no auth headers |
| Repository seam | **Defined** — DTO types + mock reads + rejected writes |
| Auth wiring | **Rejected** — `login()` / `me()` throw |
| Scope headers | **Not sent** — company context is local React state only |
| Real KPI / close status | **Preview derivations** — `formula-math.ts`, not SQL views |

**Rule until Gate 2+:** No real API wiring until Sprint 1 foundation + required UI workflow shells exist per sprint DoD.

### 1.5 Mock dependency status

| Mock source | Used by | Transition |
|-------------|---------|------------|
| `web/lib/mock-data.ts` | List, Detail, Dashboard, Calendar | Compare then replace per §6 Mock Removal Policy |
| `web/lib/formula-math.ts` | KPI pills, closeable preview, settlement | Compare then replace per §6 |
| `web/lib/items.ts` | Items explorer, wizard item picker | Until Item API or seed UUID strategy (§10) |
| `web/lib/derive.ts` | Attention widget, filters | Compare then replace per §6 |
| `CompanyProvider` mock companies | All scoped pages | Sprint 1 — `me()` + membership list |
| Wizard `setTimeout` redirect | Create flow | Sprint 1 — orchestrated persist |

**Working tree note:** Local disk may differ from HEAD (e.g. deleted formula list files). Sprint 1 uses **Working Tree Verification Procedure** — never restore blindly.

---

## 2. Implementation Principles

1. **Backend Semantics Preservation** — Every sprint preserves TOCS backend semantics. Replace preview derivations with backend-authoritative results; do not introduce semantic divergence. See global principle at document top.

2. **Backend engine is source of truth** — PostgreSQL tables, triggers, and views (`v_formula_confirmed_kpi`, `v_formula_profit_engine`, `v_formula_invoice_status`, `v_formula_closeable`, `v_participant_confirmed_kpi`, `v_payment_unmatched`) define derived financial and close state. UI must not invent parallel ledger logic.

3. **Formula First** — Every mutation starts from `formula_id`. No Deal/Order/Project roots. All KPI, close, cancel, invoice, payment, share, version flows derive from Formula.

4. **UI/UX represents backend workflows** — Screens expose the same steps the API supports. Display-only tables are not “done”; each mutation needs user action → repository method → refresh contract.

5. **Mock is temporary only** — Mock reads enabled rapid UI-P1…P5 delivery. Preview calculations remain until semantic equivalence is verified against backend engine (§6). Never remove mock or preview logic immediately upon API connection.

6. **No new engine invention** — Do not add routes, tables, triggers, or business rules not in `TOCS_MASTER_SPEC.md` / `API_MVP_SCOPE.md` without explicit approval. Document gaps; do not silently implement substitutes.

7. **No API wiring before required UI workflow exists** — Each sprint completes UI interaction shells + repository method signatures + refresh targets **before** connecting fetch/auth. Exception: Sprint 1 read adapter may wire reads early to validate scope model.

8. **Version-trigger policy is mandatory** — Quantity, prices, exchange rates, logistics cost, share amount/rate changes require `formula_versions` + `formula_calculation_snapshots` + `audit_logs` via `VersionService`. Never through `PATCH /formulas/:id`.

9. **Closed formula guard** — Normal mutations return **409** on closed formulas. Settlement allowlist only: payment record create/cancel, settlement schedules, settlement notes, invoice sync when AMOUNT_MATCHED.

10. **Layer discipline** — Frontend: Page/Component → `repository` → HTTP. Backend: Route → Action → Service → Repository → Prisma. Never Action → Prisma from frontend.

11. **Fail closed on scope** — All business calls send `Authorization` + `X-Company-Id` (or `X-Company-Scope: all` for SUPER_ADMIN). No browser-side scope filtering as security.

12. **Owning Company = Operating Scope** — Closed decision (DL-050). Wizard and Detail assume active operating scope; do not introduce independent owner selection.

---

## 3. Sprint Plan

### Sprint 1 — Foundation

**Goal:** Verified working tree, auth/scope shell, repository foundation, read adapter, formula create persist (UI orchestration, optionally API-ready).

| Work item | Deliverable |
|-----------|-------------|
| Working Tree Verification Procedure | Step 1: `git status` → Step 2: compare with HEAD → Step 3: verify intentional deletion → Step 4: restore only if required |
| Auth shell | Login page stub, token storage, `repository.login` / `repository.me`, route guard |
| Scope model | Wire `CompanyProvider` to `me().companyIds`; send scope on all repository calls; owning company = operating scope |
| API client foundation | `web/lib/api/client.ts` — base URL, auth header, company headers, error mapping (400/401/403/409/423) |
| Formula List/Detail read adapter | Replace direct `mock-data` imports with `repository.listFormulas`, `repository.getFormula` (mock first, swappable) |
| Formula Create Persist | Wizard submit → orchestration service: `POST formulas` + participants (version payloads) + schedules + logistics (version) + shares (version); loading/error states; redirect to Detail |
| Adapter fixes | Map wizard `item` → backend `item_id`; map UI enums via `prisma-mapping.ts` |

**Out of scope:** Payment/invoice/logistics mutation wiring (Sprint 2–3).

**Mandatory Review Cycle → Sprint Exit Gate → Gate 2**

---

### Sprint 2 — Payment Engine UI

**Goal:** Full payment mutation UI with refresh contract; KPI from confirmed view (or preview until wired and verified).

| Work item | Deliverable |
|-----------|-------------|
| Payment schedule create | Modal/form in Payments tab; `repository.createPaymentSchedule` |
| Payment record create | Register record form; direction validation; optional schedule link |
| Payment record cancel | Cancel action with reason; 409 on re-cancel |
| Payment summary refresh | Refetch records, schedules, fulfillment, receivable/payable |
| Settlement refresh | Remaining balances, checklist rows |
| KPI invalidation | Detail header pills + Overview realized section from `getFormulaConfirmedKpi` / `getFormulaReceivablePayable` |

**Engine facts (no invention):** Payment records update `v_formula_confirmed_kpi` only. They do **not** auto-update `cash_in_status` / `cash_out_status`.

**Mandatory Review Cycle → Sprint Exit Gate → Gate 3**

---

### Sprint 3 — Invoice / Logistics / Close

**Goal:** Invoice and logistics status workflows + authoritative close.

| Work item | Deliverable |
|-----------|-------------|
| Invoice create | Form aligned to `POST .../invoices` DTO |
| Invoice status update | Status change action; show rollup sync result |
| `amount_verified` display | Row badge from invoice field (DB trigger) |
| Logistics status update | `PATCH .../logistics-status`; append returned `status_log` to Timeline |
| Close status API | Replace mock `formula.closeable` with `GET .../status` → `v_formula_closeable` |
| Close confirm/execute | Pre-check modal listing pending domains; `POST .../close`; lock Detail writes |
| Six-status UI (partial) | Implement actions for **shipped** routes (logistics-status, invoice path); stub or disable trade/delivery/cash controls per §10 Backend Route Gaps — **not a Sprint blocker** |

**Mandatory Review Cycle → Sprint Exit Gate → Gate 4**

---

### Sprint 4 — Share / Version / Snapshot

**Goal:** Version-trigger mutations with payload builder and expected profit refresh.

| Work item | Deliverable |
|-----------|-------------|
| Share CRUD | Create, edit, delete with required `version` body on update/delete |
| Version-trigger confirmation | UI warns user that share/participant/logistics/cost changes create new version |
| Version payload builder | Shared module: snapshot + calculation from current formula state |
| Version create | Manual commit path (qty/price/FX changes via `POST .../versions`) |
| Snapshot read | Versions tab reads `GET .../versions/latest` and list |
| Expected profit refresh | Overview equation + expected KPI from `GET .../kpi/expected` (`v_formula_profit_engine`) |

**Mandatory Review Cycle → Sprint Exit Gate → Gate 5**

---

### Sprint 5 — Cancel / Logs / Dashboard Reports

**Goal:** Lifecycle termination, observability, aggregate surfaces on API.

| Work item | Deliverable |
|-----------|-------------|
| Formula cancel | Header action for ADMIN; confirm dialog; six-status CANCELED display |
| Status logs | Timeline merges `formula_status_logs` from mutation responses + list endpoint when available |
| Audit log display | Settlement notes + cancel/version audit entries (read from inline responses; list API deferred) |
| Dashboard API transition | `repository.getKpis`, `getProfitSeries` → backend dashboard routes |
| Reports API transition | Replace `web/lib/reports.ts` mock aggregates |
| Formula list filters/pagination/loading/errors | Server-driven filters; no client scope filter |

**E2E lifecycle test target:** Create → Payment → Invoice → Logistics status → Share → Version → Close → Cancel guard (cancel blocked after close). Steps requiring §10 Backend Route Gaps are documented skips — **not Sprint blockers**.

**Mandatory Review Cycle → Sprint Exit Gate → Gate 6**

---

## 4. Definition of Done per Sprint

**Universal DoD (every sprint):**

| Criterion | Required |
|-----------|----------|
| Workflow Re-Audit | Re-run workflow coverage check for sprint scope; document gaps |
| Engine Impact Recheck | Re-run engine impact map for sprint mutations; refresh targets verified |
| No Backend Divergence | No frontend logic contradicts backend views, guards, or status semantics |
| No Formula First violation | All flows remain formula-scoped; no new top-level business roots |
| Backend semantics preserved | Preview derivations compared before removal; API responses match engine |
| Typecheck pass | Root + `web/` clean |
| Build pass | Next.js production build green |
| Cursor audit pass | `.cursor/rules/tocs-core.mdc` compliance |
| Sprint Exit Gate | Typecheck, Build, Workflow Audit, Engine Impact Audit, Formula First Audit |

---

### Sprint 1 — Foundation

| Criterion | Required |
|-----------|----------|
| UI complete | Login shell, scope switcher wired to `me`, wizard persist flow (or explicit orchestration stub calling repository) |
| Repository methods ready | `login`, `me`, `listFormulas`, `getFormula`, `createFormula` (+ orchestration helpers) |
| API routes mapped | DTOs aligned to `CreateFormulaRequest.item_id`, formula list/get |
| Refresh targets verified | List updates after create; Detail loads new formula id |
| Working tree | Verification procedure completed; restore only if required |

### Sprint 2 — Payment Engine UI

| Criterion | Required |
|-----------|----------|
| UI complete | Schedule create, record create, record cancel interactions with loading/error |
| Repository methods ready | `createPaymentSchedule`, `createPaymentRecord`, `cancelPaymentRecord`, KPI read methods |
| API routes mapped | Payment routes per `API_MVP_SCOPE.md` §3 |
| Refresh targets verified | Payments tab, header KPI pills, Overview realized, Settlement balances, Timeline payment events |
| Semantic equivalence | If API wired: confirmed KPI vs preview compared before removing `deriveRealized` |

### Sprint 3 — Invoice / Logistics / Close

| Criterion | Required |
|-----------|----------|
| UI complete | Invoice create/status, logistics status action, close modal + execute |
| Repository methods ready | Invoice + logistics status + close status + close execute |
| API routes mapped | Invoice §4, Logistics §5.3, Close §8.2, Formula status GET |
| Refresh targets verified | Invoices tab, six-status grid (logistics + invoice), Close button from API, locked state after close |
| Semantic equivalence | Close readiness from `v_formula_closeable` verified vs any preview logic |

### Sprint 4 — Share / Version / Snapshot

| Criterion | Required |
|-----------|----------|
| UI complete | Share CRUD, version commit, versions tab snapshot display |
| Repository methods ready | Share CRUD, createVersion, getLatestVersion, getExpectedKpi |
| API routes mapped | Share §6, Version §7, Dashboard expected KPI §9.2 |
| Refresh targets verified | Shares, Versions, Overview expected profit, Equation, header version badge |
| Semantic equivalence | Expected profit from `v_formula_profit_engine` verified vs `deriveExpected` |

### Sprint 5 — Cancel / Logs / Dashboard Reports

| Criterion | Required |
|-----------|----------|
| UI complete | Cancel action, timeline log append, dashboard/reports on API reads |
| Repository methods ready | `cancelFormula`, dashboard KPI series, list filters with pagination params |
| API routes mapped | Cancel §8.1, Dashboard §9, Formula list query params |
| Refresh targets verified | Full Detail refresh on cancel; Dashboard invalidates on formula-scoped mutations when navigating back |
| E2E checklist | Lifecycle test executed; route-gap steps documented as skips |

---

## 5. API Integration Order

Integrate in this order after corresponding sprint UI + repository methods exist:

| Order | Domain | Routes | Sprint |
|------:|--------|--------|--------|
| 1 | Auth | `POST /auth/login`, `GET /auth/me` | 1 |
| 2 | Scope | `X-Company-Id` / `X-Company-Scope` on all business calls | 1 |
| 3 | Formula read | `GET /formulas`, `GET /formulas/:id`, `GET /by-formula-no/:no` | 1 |
| 4 | Formula create | `POST /formulas` + orchestration (participants, schedules, logistics, shares) | 1 |
| 5 | Payment | schedules create, records create, record cancel, receivable-payable, confirmed KPI | 2 |
| 6 | Invoice | create, status patch, invoices/status read | 3 |
| 7 | Logistics status | `PATCH .../logistics-status` | 3 |
| 8 | Close | `GET .../status`, `POST .../close` | 3 |
| 9 | Share / Version | share CRUD, version create/list/latest, expected KPI | 4 |
| 10 | Cancel | `POST .../cancel` | 5 |
| 11 | Dashboard / Reports | dashboard KPI routes, profit series, unmatched payments | 5 |

**Wire rule:** Flip repository method from mock to `fetch` one domain at a time. After connection, run semantic equivalence verification (§6) before removing preview calculations. Env-flag fallback permitted during Sprint 1–2 only; remove after verification passes.

---

## 6. Mock Removal Policy

**Mock data must never be removed immediately after an API is connected.**

Every backend response must first be compared against the following chain for **semantic equivalence**:

```
TOCS backend engine
        ↓
Formula-derived values
        ↓
Dashboard
        ↓
Reports
        ↓
Formula Detail
        ↓
Settlement
        ↓
Timeline
        ↓
Versions
```

**Only after semantic equivalence is verified** may preview calculations (`deriveExpected`, `deriveRealized`, `isCloseable`, mock KPI aggregates, etc.) be removed.

### Verification checklist (per domain)

| Step | Action |
|------|--------|
| 1 | Connect API read/mutation in repository |
| 2 | Run side-by-side: API response vs preview derivation for same formula |
| 3 | Verify all affected surfaces in chain above show consistent values |
| 4 | Document comparison result in sprint Workflow Re-Audit |
| 5 | Remove preview code only after pass; keep mock behind flag until Gate approves removal |

### Long-lived mock (not removed by API connection alone)

| Mock | Reason |
|------|--------|
| `items.ts` catalog | No Item API — use seed UUIDs or defer |
| Calendar events | No calendar API in MVP |
| Audit log full history | No list route in MVP — inline mutation results only |

### Preview → authoritative mapping (target)

| UI calculation today | Authoritative source |
|---------------------|---------------------|
| `deriveRealized()` | `v_formula_confirmed_kpi` via `GET .../kpi/confirmed` |
| `deriveExpected()` | `v_formula_profit_engine` via `GET .../kpi/expected` |
| `deriveSettlement()` receivable/payable | `GET .../receivable-payable` |
| `isCloseable()` | `v_formula_closeable` via `GET .../status` |
| `derivePerspectiveMetrics()` | `v_participant_confirmed_kpi` via `GET .../kpi/participants` |
| Invoice rollup | `formulas.invoice_status` + `GET .../invoices/status` |
| `amount_verified` | `formula_invoices.amount_verified` (trigger-maintained) |

---

## 7. Refresh / Invalidation Policy

Legend: **R** = refetch immediately after mutation success; **N** = refetch on next navigation/mount; **—** = unchanged.

| Mutation | Formula Detail | Dashboard | Reports | Formula List | Timeline | Settlement | Close readiness |
|----------|:--------------:|:---------:|:-------:|:------------:|:--------:|:----------:|:---------------:|
| Formula create | R (redirect) | N | — | R | — | — | — |
| Payment schedule create | R | N | N | R (receivable/payable cols) | R | R | — |
| Payment record create | R | R | R | R | R | R | — |
| Payment record cancel | R | R | R | R | R | R | — |
| Invoice create / status | R | — | N | N | R | R | R |
| Logistics status update | R | N | — | N | R | R | R |
| Share CRUD | R | N | R | N | R | N | — |
| Version create | R | N | R | N | R | — | — |
| Participant / logistics create | R | N | R | N | R | N | — |
| Close execute | R (lock UI) | R | R | R | R | R | R |
| Cancel formula | R | R | R | R | R | — | R (disabled) |
| Metadata patch | R (overview) | — | — | N | — | — | — |
| Settlement note / schedule (closed) | R | N | N | N | R | R | — |

**Close readiness rule:** Only mutations that change six status columns, invoice rollup, or `is_closed` affect Close button. Payment amounts alone refresh KPI but not `can_close`. Cash status completion requires manual status routes when shipped (§10 Backend Route Gaps).

**Dashboard policy:** Refetch confirmed KPI aggregates when user navigates to Dashboard after payment or cancel mutations. Do not poll globally on every Detail mutation.

---

## 8. Testing Plan

### Per sprint (required — part of Mandatory Review Cycle)

| Test | Command / method |
|------|------------------|
| Typecheck | Root + `web/` TypeScript (`tsc --noEmit` or project script) |
| Build | Next.js production build |
| Cursor audit pass | Manual checklist per sprint DoD + `.cursor/rules/tocs-core.mdc` compliance |
| GPT Review | Stakeholder/architect review before Approval Gate |
| Workflow Audit | Sprint-scoped workflow re-audit |
| Engine Impact Audit | Sprint-scoped mutation refresh verification |
| Formula First Audit | No new roots; formula-scoped mutations only |

### Backend (existing — maintain green)

| Suite | Location |
|-------|----------|
| Integration tests | `src/tests/*.integration.test.ts` (28 files) |
| DB tests | TEST-001…011 per `docs/tests/TOCS_TEST_SUMMARY_v1.1.md` |

Run against PostgreSQL with valid `DATABASE_URL` before Gate 4+.

### Frontend (add incrementally)

| Test | Sprint |
|------|--------|
| Repository unit tests (mock adapter) | 1 |
| Wizard validation smoke | 1 |
| Payment form validation smoke | 2 |
| Close modal guard smoke | 3 |
| Version payload builder unit tests | 4 |
| Semantic equivalence comparison scripts/checklists | 2–5 per §6 |

### Workflow tests (manual or Playwright — Sprint 5)

1. Login + scope header present on API calls  
2. Create formula orchestration success + error paths  
3. Payment record → KPI pills update  
4. Invoice → invoice_status + close checklist  
5. Logistics status → logistics_done  
6. Close blocked when pending; succeeds when six complete (or documented skip for route gaps)  
7. Cancel → six CANCELED; close disabled  
8. Closed formula → normal PATCH returns 409  

### E2E lifecycle test (Sprint 5 gate)

```
Create → Payment schedule + record → Invoice (AMOUNT_MATCHED)
→ Logistics status COMPLETED → Share create → Version create
→ Complete remaining statuses (route-gap steps documented as skip) → Close
→ Attempt normal update (409) → Cancel blocked on closed formula
```

---

## 9. Approval Gates

| Gate | Name | Entry criteria | Exit criteria |
|------|------|----------------|---------------|
| **Gate 1** | Plan approved | This document v1.1 reviewed | Stakeholder sign-off on sprint order, review cycle, and gap classification |
| **Gate 2** | Sprint 1 approved | Gate 1 pass + Mandatory Review Cycle complete | Sprint 1 DoD + Sprint Exit Gate; auth/scope/read/create shell ready |
| **Gate 3** | Payment workflow approved | Gate 2 pass + Mandatory Review Cycle complete | Sprint 2 DoD + Sprint Exit Gate; payment refresh verified |
| **Gate 4** | Close workflow approved | Gate 3 pass + Mandatory Review Cycle complete | Sprint 3 DoD + Sprint Exit Gate; close uses `v_formula_closeable` |
| **Gate 5** | Version/snapshot approved | Gate 4 pass + Mandatory Review Cycle complete | Sprint 4 DoD + Sprint Exit Gate; version payload builder verified |
| **Gate 6** | Dashboard/report API approved | Gate 5 pass + Mandatory Review Cycle complete | Sprint 5 DoD + Sprint Exit Gate; semantic equivalence verified; E2E checklist executed |

**Implementation freeze rule:** Cursor/v0 must not skip gates or the Mandatory Review Cycle. API wiring for domain N waits until Gate for sprint containing domain N−1 baseline passes.

**Cursor rule update required after Gate 1:** `.cursor/rules/tocs-core.mdc` §15 currently limits scope to FormulaRepository/Service create/find/list only and forbids API wiring — update milestone section after Gate 1 approval to authorize sprint-scoped integration.

---

## 10. Backend Route Gaps

**These are backend capability gaps, not Sprint blockers.**

Current phase is UI/UX Completion → API Integration. Sprints proceed on shipped routes. Gaps are documented for future backend work or UI stub/disable behavior — they do **not** halt the sprint sequence.

| ID | Gap | Current state | UI handling during sprints |
|----|-----|---------------|----------------------------|
| **G1** | Delivery Status Route | `formulas.delivery_status` column exists; no `PATCH .../delivery-status` | Stub/disable delivery completion control; document in Workflow Re-Audit |
| **G2** | Trade Status Route | No trade status mutation route | Stub/disable trade completion control |
| **G3** | Cash In Status Route | No cash_in status mutation route | Stub/disable; do not infer from payment records |
| **G4** | Cash Out Status Route | No cash_out status mutation route | Stub/disable; do not infer from payment records |
| **G5** | Logistics vehicle CRUD | Table exists; create only stores `vehicle_count` | Mock vehicle cards remain; no vehicle editor |
| **G6** | Payment schedule edit | Create only | Create-only UI; no edit action |
| **G7** | Invoice external amount edit | Create + status PATCH only | Create-only amount entry |
| **G8** | Item API | `items` table + `formulas.item_id` FK; no HTTP CRUD | Seed fixed item UUIDs or mock picker until API ships |
| **G9** | Company update | `POST/GET` companies only | Companies explorer edit remains mock |
| **G10** | Logistics status audit_logs | `formula_status_logs` only per API_MVP_SCOPE | Timeline shows status_log from response; no invented audit |

**Implemented status routes (for reference):** `PATCH .../logistics-status`; invoice status path via invoice create/status + `formulas.invoice_status` sync.

---

## 10b. Open Decisions (remaining)

| ID | Topic | Options | Impact |
|----|-------|---------|--------|
| **D1** | Item API vs seed UUIDs (G8) | Implement Item API vs hardcoded seed IDs for wizard | Wizard item picker data source |
| **D2** | Auth/RBAC UI vs cursor rule | Update cursor milestone after Gate 1 | Sprint 1 auth shell authorization |
| **D3** | Backend route gaps G1–G4 timing | Add routes in backend phase vs defer indefinitely | Full six-status E2E completeness |

**Not open (closed — do not reopen):** Owning Company = Operating Scope (DL-050).

---

## 11. Conflicts Found (facts)

| Conflict | Documents involved | Resolution in v1.1 |
|----------|-------------------|---------------------|
| API wiring forbidden in cursor rule | `.cursor/rules/tocs-core.mdc` §15 vs. this plan | Gate 1 approval + cursor milestone update before Sprint 1 API client |
| UI scope doc forbids API changes | `PRODUCT_UI_IMPLEMENTATION_SCOPE.md` §1 vs. integration sprints | UI-P1…P5 mock phase complete; integration phase follows gates |
| Frontend `CreateFormulaRequest.item` vs backend `item_id` | `web/lib/data/repository.ts` vs `src/actions/formula.actions.ts` | Sprint 1 adapter mapping; G8 seed UUID strategy |
| UI `delivered` vs backend `COMPLETED` | `web/lib/prisma-mapping.ts` / mock vs DB enums | Use mapping layer on every write |
| UI mock closeable vs `v_formula_closeable` | `formula-math.isCloseable` vs `close.actions.ts` | Sprint 3; semantic equivalence before removal (§6) |
| Payment completion vs cash status | Engine Impact Audit vs user mental model | UI must not imply payment record completes cash_in/out_status |
| Working tree vs HEAD | git status vs build | Working Tree Verification Procedure — restore only if required |
| v1.0 treated route gaps as P0 blockers | Prior plan §10 B1/B2 | Reclassified as §10 Backend Route Gaps — not Sprint blockers |

---

## Appendix A — Implementation Order (summary)

1. Gate 1 approval + cursor milestone update  
2. Sprint 1: Foundation (working tree verification, auth, scope, read adapter, create orchestration)  
3. Sprint 2: Payment mutations + KPI refresh + semantic equivalence  
4. Sprint 3: Invoice + logistics status + close  
5. Sprint 4: Share + version + expected profit  
6. Sprint 5: Cancel + logs + dashboard/reports + E2E (with documented route-gap skips)  

**Do not connect Dashboard API until Detail-scoped refetch pattern is proven (Gate 3 minimum).**

---

## Appendix B — Repository Method Checklist (target)

| Method | Sprint | Backend route |
|--------|--------|---------------|
| `login`, `me` | 1 | Auth |
| `listFormulas`, `getFormula` | 1 | Formula GET |
| `createFormulaOrchestration` | 1 | Multi-call |
| `createPaymentSchedule` | 2 | Payment |
| `createPaymentRecord`, `cancelPaymentRecord` | 2 | Payment |
| `getFormulaConfirmedKpi`, `getFormulaReceivablePayable` | 2 | Dashboard |
| `createInvoice`, `updateInvoiceStatus` | 3 | Invoice |
| `updateLogisticsStatus` | 3 | Logistics |
| `getFormulaCloseStatus`, `closeFormula` | 3 | Close |
| `createShare`, `updateShare`, `deleteShare` | 4 | Share |
| `createVersion`, `getLatestVersion`, `listVersions` | 4 | Version |
| `getFormulaExpectedKpi` | 4 | Dashboard |
| `cancelFormula` | 5 | Formula cancel |
| `getKpis`, `getProfitSeries` | 5 | Dashboard |

---

## Appendix C — Working Tree Verification Procedure

**Never restore blindly.**

| Step | Action |
|------|--------|
| **1** | Run `git status` — list modified, deleted, untracked files |
| **2** | Compare each changed path with HEAD (`git diff`, `git show HEAD:<path>`) |
| **3** | Verify whether deletion or modification is intentional (local experiment, merge artifact, accident) |
| **4** | Restore from HEAD (`git restore <path>`) **only if** step 3 confirms accidental loss blocks typecheck/build |

---

*End of document v1.1 — submit for Gate 1 approval.*
