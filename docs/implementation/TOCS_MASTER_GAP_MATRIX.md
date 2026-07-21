# TOCS Master Gap Matrix

| Field | Value |
|-------|--------|
| **Version** | v2.0.0 |
| **Status** | **Implementation control document** — supersedes v1 classification |
| **Branch baseline** | `tocs-frontend-design` (post Gate 1 docs, T2 repository, build hotfix) |
| **Last updated** | 2026-07-07 |
| **Mode** | Read-only audit — facts from codebase and approved plans |

**Authority:** This matrix controls **implementation priority**. It **supersedes v1** classification rules. Sprints remain execution batches; **priority follows §8**.

**Sources:** `TOCS_MASTER_SPEC.md`, `DECISION_LOG.md`, `PROJECT_CONTEXT.md`, `docs/implementation/*`, `API_MVP_SCOPE.md`, `src/**`, `web/**`, prior audits.

---

# 1. Corrected Classification Rules

## Core principle

**Read-capability API readiness is distinct from write-workflow completeness.**

v1 incorrectly required write/CRUD interactions for “UI Complete,” forcing Group A = 0. v2 classifies **each capability** (often split into READ vs WRITE) on its own merits.

## UI Complete (v2 definition)

**UI Complete** for a capability means the **UI/UX required for that specific capability** is present:

| Capability type | UI complete when |
|-----------------|------------------|
| **READ** | Screen/tab/table/chart **displays** the data domain; navigation reaches it; empty/loading states may still be refined |
| **WRITE** | User can **submit** the mutation (form, button, confirm dialog) with validation feedback |
| **WORKFLOW** | End-to-end user path exists (e.g. login → app, wizard → detail) |
| **DERIVED** | Display surface exists for engine-derived values (KPI pills, close eligibility, settlement balances) |
| **ADMIN** | Shell/control exists (scope switcher, filter bar) |

**Not UI incomplete:**

- Missing **write** actions on a **read** row (do not downgrade read to B)
- **API not wired** (`mock-data` import, `ApiNotWiredError`) — that is integration work, not missing UI
- **Preview/mock derivation** where display UI exists — classify DERIVED read as **A**; equivalence validation is integration policy (Master Plan §6), not UI gap

## Group definitions

| Group | Rule |
|-------|------|
| **A** | Backend complete · UI for **this capability** complete · only repository/API wire + DTO mapping remains |
| **B** | Backend complete · **write/workflow** UI missing or insufficient |
| **C** | UI for capability exists (or planned in active sprint) · **backend route/engine** missing |
| **D** | Both backend and UI insufficient for the capability |
| **E** | Product decision or explicit MVP deferral |

## Validation rules (mandatory)

1. Do **not** classify a read surface as UI-incomplete because write actions are missing.
2. Do **not** classify a top-level page as missing if the capability exists in **Formula Detail** (e.g. payments read lives in Detail tab + `/payments` page).
3. Do **not** classify **API-not-wired** as UI-incomplete.
4. **Split READ and WRITE** into separate rows when merging would misclassify.

---

# 2. Revised Master Matrix

| Capability | Type | Backend | UI | Repository | API (HTTP) | Class | Reason | Next Action | Priority |
|------------|------|---------|-----|------------|------------|:-----:|--------|-------------|:--------:|
| Formula List read | READ | Complete | Complete (`formulas/page.tsx`) | Signature `listFormulas` | `GET /formulas` | **A** | List UI + route exist; pages use mock-data only | T3 client → T6 wire + adapter | P0 |
| Formula Detail identity read | READ | Complete | Complete (`[id]/page.tsx`, header) | Signature `getFormula` | `GET /formulas/:id` | **A** | Detail shell + tabs exist | T7 wire + composite adapter | P0 |
| Formula Overview read | READ | Complete | Complete (`OverviewPanel`) | Via `getFormula` | `GET /formulas/:id` | **A** | Six-status display + memo fields | Same as detail wire | P0 |
| Formula metadata PATCH | WRITE | Complete | Incomplete (no edit UI) | `updateFormula` NotWired | `PATCH /formulas/:id` | **B** | Backend ready; no note/unit editor | P1 metadata form | P1 |
| Formula Create persist | WORKFLOW | Complete | Incomplete (wizard `setTimeout`) | Orchestration NotWired | `POST /formulas` + chain | **B** | Wizard UX exists; submit not repository | T8–T9 orchestration | P0 |
| Formula Cancel execute | WRITE | Complete | Incomplete (no action) | Missing | `POST .../cancel` | **B** | No header cancel control | Sprint 5 cancel UI | P1 |
| Formula Close execute | WRITE | Complete | Incomplete (button no handler) | `closeFormula` NotWired | `POST .../close` | **B** | Close UX shell only | Sprint 3 confirm + execute | P0 |
| Participants read | READ | Complete | Complete (`ParticipantsPanel`) | Missing list method | `GET .../participants` | **A** | Tab + chain display exist | Add `listParticipants` + adapter | P0 |
| Participant create (wizard) | WRITE | Complete | Complete (wizard Step 2) | Via orchestration only | `POST .../participants` | **B** | UI exists; persist blocked on orchestration | T8–T9 | P0 |
| Participant add/edit (Detail) | WRITE | Incomplete (no update/delete API) | Incomplete | Missing | POST only | **C** | No backend update route (V2) | Defer or V2 API | P2 |
| Trade Chain (wizard) | WORKFLOW | Complete (participant POST) | Complete (Step 2) | Orchestration only | `POST .../participants` | **B** | Preview UX complete; no persist | Same as create persist | P0 |
| Payment Schedules read | READ | Complete | Complete (`PaymentsPanel`, `/payments`) | Missing | `GET .../payment-schedules` | **A** | Tables in Detail + cross-page | Sprint 2 read wire | P0 |
| Payment Schedule create | WRITE | Complete (no PATCH G6) | Incomplete (no form) | Missing | `POST .../payment-schedules` | **B** | GET+POST backend; UI form missing | Sprint 2 create UI | P0 |
| Payment Schedule edit | WRITE | Incomplete (G6) | Incomplete | Missing | **Missing** PATCH | **D** | Neither side for edit | Accept create-only MVP | P2 |
| Payment Records read | READ | Complete | Complete (`PaymentsPanel`) | Missing | `GET .../payment-records` | **A** | Record table exists | Sprint 2 read wire | P0 |
| Payment Record register | WRITE | Complete | Incomplete (no register form) | Missing | `POST .../payment-records` | **B** | Backend ready | Sprint 2 register UI | P0 |
| Payment Record cancel | WRITE | Complete | Incomplete (no cancel action) | Missing | `PATCH .../cancel` | **B** | Backend ready | Sprint 2 cancel UI | P0 |
| Invoices read | READ | Complete | Complete (`InvoicesPanel`, `/invoices`) | Missing | `GET .../invoices` | **A** | Tab + verification display | Sprint 3 read wire | P0 |
| Invoice amount_verified display | DERIVED | Complete (trigger) | Complete (panel badges) | Missing | Row field + GET | **A** | UI shows verification; wire field from API | Adapter mapping | P0 |
| Invoice create | WRITE | Complete | Incomplete (no form) | Missing | `POST .../invoices` | **B** | | Sprint 3 create UI | P0 |
| Invoice status update | WRITE | Complete | Incomplete (no status action) | Missing | `PATCH .../status` | **B** | | Sprint 3 status UI | P0 |
| Invoice amount edit | WRITE | Incomplete (G7) | Incomplete | Missing | **Missing** PATCH | **D** | Create-only MVP | Defer | P2 |
| Logistics legs read | READ | Complete | Complete (`LogisticsPanel`, `/logistics`) | Missing | `GET .../logistics` | **A** | Leg list UI exists | Sprint 3 read wire | P0 |
| Logistics status update | WRITE | Complete | Incomplete (no action) | Missing | `PATCH .../logistics-status` | **B** | Backend shipped | Sprint 3 status UI | P0 |
| Delivery status update | WRITE | Incomplete (G1) | Incomplete (no shipped action) | Missing | **Missing** route | **E** | Product/backend gap G1 | Stub/disable per D3 | P1 |
| Trade status completion | WRITE | Incomplete (G2) | Incomplete | Missing | **Missing** route | **E** | G2 | Product decision D3 | P1 |
| Cash In status completion | WRITE | Incomplete (G3) | Incomplete | Missing | **Missing** route | **E** | G3 | Product decision D3 | P1 |
| Cash Out status completion | WRITE | Incomplete (G4) | Incomplete | Missing | **Missing** route | **E** | G4 | Product decision D3 | P1 |
| Vehicles read (row detail) | READ | Incomplete (G5: count only) | Complete (mock cards) | Missing | **Missing** row API | **C** | UI shows vehicles; DB rows not exposed | G5 backend or defer mock | P2 |
| Shares read | READ | Complete | Complete (`SharesPanel`) | Missing | `GET .../shares` | **A** | Tab exists | Sprint 4 read wire | P1 |
| Share create/update/delete | WRITE | Complete | Incomplete (no CRUD UI) | Missing | Share CRUD routes | **B** | | Sprint 4 share UI | P1 |
| Version history read | READ | Complete | Complete (`VersionsPanel`, mock history) | Missing | `GET .../versions` | **A** | Panel exists | Sprint 4 list wire | P1 |
| Snapshot latest read | READ | Complete | Complete (panel + simulation) | Missing | `GET .../versions/latest` | **A** | Display surface exists | Sprint 4 latest wire | P1 |
| Version commit | WRITE | Complete | Incomplete (simulation only) | Missing | `POST .../versions` | **B** | No commit workflow | Sprint 4 + payload builder | P1 |
| Settlement balances read | DERIVED | Complete (views) | Complete (`SettlementPanel`, `/settlement`) | Preview mock | `GET .../receivable-payable` | **A** | UI exists; preview → view wire | Sprint 2 equivalence | P0 |
| Settlement note create (closed) | WRITE | Complete | Incomplete | Missing | `POST .../settlement/notes` | **B** | Closed-only backend | Post-close UI | P1 |
| Settlement schedule create (closed) | WRITE | Complete | Incomplete | Missing | `POST .../settlement/payment-schedules` | **B** | | Post-close UI | P1 |
| Status Logs read (Timeline feed) | READ | Incomplete (no list API) | Complete (`TimelinePanel`) | Missing | Partial inline only | **C** | UI synthesizes mock; no query API | Inline from mutations; V2 list | P1 |
| Timeline display | READ | Complete (client build) | Complete (`TimelinePanel`) | Missing | Partial | **C** | Authoritative feed needs logs API or mutation append | Sprint 5 feed strategy | P1 |
| Dashboard KPI read | DERIVED | Complete | Complete (`page.tsx`, `/dashboard`) | Preview mock | Dashboard KPI routes | **A** | Shell + cards exist | Sprint 5 wire + equivalence | P1 |
| Reports workspace read | DERIVED | Complete (compose) | Complete (`reports-workspace.tsx`) | Missing | Client roll-up per spec | **A** | Accepted client merge per `PRODUCT_UI_IMPLEMENTATION_SCOPE` | Sprint 5 compose from formula/KPI APIs | P1 |
| Calendar events read | READ | Incomplete | Complete (`calendar/page.tsx`) | Mock | **Missing** calendar API | **C** | Page exists; no backend | Defer or composite schedules | P3 |
| Company list read | READ | Complete | Complete (`companies-explorer.tsx`) | Mock `listCompanies` | `GET /companies` | **A** | Explorer read UI | T5 wire labels | P1 |
| Company create | WRITE | Complete | Complete (explorer form) | Mock | `POST /companies` | **B** | UI exists; not wired | Wire on integrate | P1 |
| Company update | WRITE | Incomplete (G9) | Complete (edit UI mock) | Missing | **Missing** PATCH | **C** | UI edit mock; no PATCH | G9 backend or defer | P2 |
| Authentication login | WORKFLOW | Complete | Incomplete (no `/login`) | NotWired | `POST /auth/login` | **B** | No login page/guard | T4 auth shell | P0 |
| Auth session / me | READ | Complete | Incomplete (no bootstrap) | NotWired | `GET /auth/me` | **B** | Required for scope wire | T4 + T5 | P0 |
| Permission (RBAC hide) | ADMIN | Complete (middleware) | Incomplete (no role hide) | N/A | Enforced server-side | **B** | Actions not role-gated in UI | Post-auth RBAC polish | P2 |
| Scope switcher | ADMIN | Complete (middleware) | Complete (`company-switcher.tsx`) | Scope on repo | Headers on HTTP | **A** | Switcher UX exists; mock company list | T5 `me` + header inject | P0 |
| Formula list filters | ADMIN | Complete (query params) | Complete (`formula-filters.tsx`) | Query type only | `GET /formulas` query | **A** | Filter bar exists | Map query on T6 | P1 |
| Formula list search (client) | READ | Partial (`by-formula-no` exact) | Complete (search box) | Missing | Partial | **E** | Client filter OK for MVP; server search undecided | Product D3 search | P2 |
| Confirmed KPI read (formula) | DERIVED | Complete | Complete (header pills) | Preview mock | `GET .../kpi/confirmed` | **A** | Display exists | Sprint 2 wire | P0 |
| Expected KPI read (formula) | DERIVED | Complete | Complete (`FormulaEquation`) | Preview mock | `GET .../kpi/expected` | **A** | Display exists | Sprint 4 wire | P1 |
| Receivable/Payable read | DERIVED | Complete | Complete (pills + settlement) | Preview mock | `GET .../receivable-payable` | **A** | | Sprint 2 wire | P0 |
| Participant KPI read | DERIVED | Complete | Complete (perspective in reports/detail) | Preview mock | `GET .../kpi/participants` | **A** | | Sprint 5 wire | P1 |
| Close eligibility read | DERIVED | Complete (`v_formula_closeable`) | Complete (button state; mock today) | Preview mock | `GET .../status` | **A** | UI shows closeable; wire authoritative view | Sprint 3 status API | P0 |
| Unmatched payments read | READ | Complete | Complete (dashboard section) | Preview mock | `GET /payments/unmatched` | **A** | | Sprint 5 wire | P1 |
| Item master read | READ | Incomplete (G8) | Complete (`items.ts` mock) | N/A | **Missing** Item API | **E** | Mock catalog; `item_id` FK on create | D1 seed UUID vs Item API | P0 |
| Notifications | READ | Incomplete (V2) | Omitted per spec | Missing | **Missing** | **E** | MVP excluded | V2 approval | V2 |
| Audit log list read | READ | Incomplete (no list API) | Incomplete (inline only) | Missing | **Missing** | **D** | Cancel/version return inline only | Inline mutation responses | P2 |
| Wizard Draft save/resume | WORKFLOW | Incomplete (V2) | Incomplete | Missing | **Missing** | **E** | Explicit deferral | V2 | V2 |

---

# 3. Read Capabilities Ready for API (Group A)

**Count: 28**

| # | Capability | API route(s) | UI surface |
|---|------------|--------------|------------|
| 1 | Formula List read | `GET /formulas` | `formulas/page.tsx` |
| 2 | Formula Detail identity read | `GET /formulas/:id` | `formulas/[id]/page.tsx` |
| 3 | Formula Overview read | `GET /formulas/:id` | `OverviewPanel` |
| 4 | Participants read | `GET .../participants` | `ParticipantsPanel` |
| 5 | Payment Schedules read | `GET .../payment-schedules` | `PaymentsPanel`, `/payments` |
| 6 | Payment Records read | `GET .../payment-records` | `PaymentsPanel` |
| 7 | Invoices read | `GET .../invoices` | `InvoicesPanel`, `/invoices` |
| 8 | Invoice amount_verified display | invoice row + trigger | `InvoicesPanel` |
| 9 | Logistics legs read | `GET .../logistics` | `LogisticsPanel`, `/logistics` |
| 10 | Shares read | `GET .../shares` | `SharesPanel` |
| 11 | Version history read | `GET .../versions` | `VersionsPanel` |
| 12 | Snapshot latest read | `GET .../versions/latest` | `VersionsPanel` |
| 13 | Settlement balances read | `GET .../receivable-payable` | `SettlementPanel`, `/settlement` |
| 14 | Dashboard KPI read | Dashboard KPI routes | `page.tsx`, `/dashboard` |
| 15 | Reports workspace read | Client roll-up from formula/KPI | `reports-workspace.tsx` |
| 16 | Company list read | `GET /companies` | `companies-explorer.tsx` |
| 17 | Scope switcher | `GET /auth/me` + headers | `company-switcher.tsx` |
| 18 | Formula list filters | `GET /formulas?…` | `formula-filters.tsx` |
| 19 | Confirmed KPI read (formula) | `GET .../kpi/confirmed` | Detail header pills |
| 20 | Expected KPI read (formula) | `GET .../kpi/expected` | `FormulaEquation` |
| 21 | Receivable/Payable read | `GET .../receivable-payable` | pills + settlement |
| 22 | Participant KPI read | `GET .../kpi/participants` | reports / detail context |
| 23 | Close eligibility read | `GET .../status` | Close button state |
| 24 | Unmatched payments read | `GET /payments/unmatched` | dashboard |
| 25 | Formula by-formula-no lookup | `GET .../by-formula-no/:no` | (integrate into search) |
| 26 | Health smoke | `GET /health` | dev/CI only |
| 27 | Cross-formula payments list read | `GET` schedules/records scoped | `/payments` |
| 28 | Cross-formula invoices list read | `GET .../invoices` scoped | `/invoices` |

**Integration note:** Group A = **ready to wire**. Repository HTTP (T3+) and DTO adapters still required. Mock-data direct imports are **integration debt**, not UI gaps.

---

# 4. Write / Workflow Capabilities Requiring UI First (Group B)

**Count: 22**

| Capability | Backend | Missing UI |
|------------|---------|------------|
| Formula Create persist | ✓ | Wizard repository submit |
| Formula metadata PATCH | ✓ | Detail editor |
| Formula Cancel | ✓ | Header action |
| Formula Close execute | ✓ | Confirm + POST handler |
| Participant create (wizard persist) | ✓ | Blocked on orchestration |
| Trade Chain persist | ✓ | Same |
| Payment Schedule create | ✓ | Form/modal |
| Payment Record register | ✓ | Register form |
| Payment Record cancel | ✓ | Cancel action + reason |
| Invoice create | ✓ | Form |
| Invoice status update | ✓ | Status action |
| Logistics status update | ✓ | Complete logistics action |
| Share create/update/delete | ✓ | CRUD modals |
| Version commit | ✓ | Commit workflow + payload |
| Settlement note create (closed) | ✓ | Append UI |
| Settlement schedule create (closed) | ✓ | Append UI |
| Company create (wire) | ✓ | Wire explorer POST |
| Authentication login | ✓ | `/login` + guard |
| Auth session bootstrap | ✓ | `me` on app load |
| Permission RBAC hide | ✓ | Role-based action visibility |

---

# 5. Backend Gaps (Group C + D)

## Group C — UI exists, backend incomplete (9)

| Capability | Gap ID | Notes |
|------------|--------|-------|
| Vehicles row read | G5 | `vehicle_count` only |
| Timeline / Status Logs authoritative read | — | No list API |
| Calendar events read | — | No calendar API |
| Company update | G9 | No PATCH |
| Participant edit/delete (Detail) | V2 | No update API |
| Delivery / trade / cash status WRITE | G1–G4 | Listed under E if undecided; C when UI stub planned without route |

## Group D — Both incomplete (4)

| Capability | Notes |
|------------|-------|
| Payment Schedule edit | G6 + no UI |
| Invoice amount edit | G7 + no UI |
| Audit log list read | No API + no list UI |
| Notifications | V2 omitted |

---

# 6. Product Decisions / Deferred (Group E)

**Count: 8**

| ID | Capability | Decision |
|----|------------|----------|
| D1 / G8 | Item master | Seed UUID vs Item HTTP API |
| D3 | Delivery status route (G1) | Add route vs defer UI |
| D3 | Trade status route (G2) | Same |
| D3 | Cash In route (G3) | Same |
| D3 | Cash Out route (G4) | Same |
| — | Formula list server search | Client-only vs full-text API |
| — | Wizard Draft | V2 deferred |
| — | Notifications | V2+ deferred |

---

# 7. Corrected Summary

| Metric | v1 | v2 |
|--------|---:|---:|
| **Total capabilities (rows)** | 29 features | **62** (READ/WRITE split) |
| **Group A** | 0 | **28** |
| **Group B** | 24 | **22** |
| **Group C** | 1 | **9** |
| **Group D** | 2 | **4** |
| **Group E** | 2 (+supplement) | **8** |
| **Ready for API integration (Group A)** | 0 | **28** |
| **Need UI first (Group B writes/workflows)** | 24 (misclassified reads) | **22** |
| **Need backend first (Group C)** | 3 | **9** |
| **Product decision (Group E)** | 2+ | **8** |

### Layer snapshot (unchanged facts)

| Layer | State |
|-------|--------|
| Backend engine | MVP Core complete (48 routes); G1–G10 documented |
| Frontend read UX | **Strong** — Detail tabs, list, dashboard, reports shells |
| Frontend write UX | **Weak** — mutations mostly absent |
| Repository | T2 signatures; mock default; **no HTTP client** |
| Live API integration | **Not started** on pages |

---

# 8. Updated Execution Priority

**v2 order (supersedes v1 “UI before any API” blanket rule):**

| Phase | Action | Groups |
|------:|--------|--------|
| **1** | **Group A read/API foundation** | T3 API client → T4/T5 auth/scope → T6/T7 formula read wires → parallel A reads (participants, payments, invoices, logistics, shares, versions, KPI DERIVED) |
| **2** | **Group B P0 UI** | Create persist, payment register/cancel, invoice create/status, logistics status, close execute |
| **3** | **Group C backend gaps** | G1–G5, G9, timeline list API — as product approves |
| **4** | **Group B P1** | Share/version commit, cancel, settlement append, company create wire, RBAC hide |
| **5** | **Group E decisions** | D1 Item, D3 six-status routes, search — when blocking |

**Semantic equivalence (Master Plan §6)** applies when **replacing preview DERIVED** reads — not a blocker to **initial** Group A wire.

---

# 9. Conflicts with v1

| v1 rule / outcome | v2 correction | Why |
|-------------------|---------------|-----|
| “UI Complete = writes required” | UI Complete = **capability-scoped** | Read surfaces were wrongly marked incomplete |
| Group A = 0 | Group A = **28 read/DERIVED/admin reads** | Matches execution: wire reads first |
| “Formula = B” monolithic | Split **List/Detail/Overview READ = A**, **Create/Close/Cancel = B** | READ/WRITE separation |
| “Payment = B” monolithic | **Records read = A**, register/cancel = B | User-specified pattern |
| “Dashboard/Reports = B/C” | **Dashboard/Reports read = A** (DERIVED) | UI shells complete; KPI routes exist / roll-up accepted |
| “Scope = B” | **Scope switcher = A**, **me bootstrap = B** | Switcher UX exists; missing login/me workflow |
| “API-not-wired = blocked by UI” | **Integration debt** on Group A | T3–T7 are wiring, not UI sprints |
| Priority: all UI then API | **A reads first**, then B writes | Faster vertical slice; backend already ready |
| Timeline = B | **Timeline authoritative = C**, display UI complete | No list API |
| Vehicles = D | **Vehicles read = C** (UI mock, backend rows missing) | UI exists |

---

*End of TOCS Master Gap Matrix v2.0.0*
