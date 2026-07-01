# TOCS Product UI — v0 / Cursor Implementation Scope

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.0.0 (UI implementation gate — **scope locked** for v0/Cursor) |
| **Status** | **ACCEPTED baseline** — start Product UI only after reading linked wireframe specs |
| **Productization map** | Replaces ad-hoc P5/P6 UI breakdown — see §2 vs [`PRODUCTIZATION_V1_PLAN.md`](./PRODUCTIZATION_V1_PLAN.md) |

**Wireframe sources (normative):**

| Screen | Spec |
|--------|------|
| App Shell + routes | [`NAVIGATION_ARCHITECTURE.md`](./NAVIGATION_ARCHITECTURE.md) |
| Dashboard | [`DASHBOARD_V1_SPEC.md`](./DASHBOARD_V1_SPEC.md) §11, §4.3 |
| Formula List | §UI-P3 below + Dashboard §4.3.2 |
| Formula Detail | [`FORMULA_DETAIL_SPEC.md`](./FORMULA_DETAIL_SPEC.md) |
| Formula Wizard | [`FORMULA_WIZARD_SPEC.md`](./FORMULA_WIZARD_SPEC.md) §15 |

**Context policies:** [`GLOBAL_COMPANY_CONTEXT_POLICY.md`](./GLOBAL_COMPANY_CONTEXT_POLICY.md), [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md)

**Prerequisites (shipped):** Core MVP APIs, Auth/RBAC, company context middleware + service filters (343/343 PASS).

---

## 1. Purpose

Define **exact UI surfaces** implementers (v0, Cursor, React shell) may build **before** writing product code. This document is the **scope gate** — anything not listed here or in linked wireframe specs requires explicit approval.

**Goal:** Ship a coherent **Formula First** product shell with **Global Company Context**, **Profit Engine** separation, and **Timeline-centric** Detail — **without** backend/API/DB changes.

---

## 2. Priority naming

| Label | Meaning |
|-------|---------|
| **UI-P1 … UI-P5** | **Implementation order** for Product UI (this document) |
| **Productization P1–P4** | Policy/backend phases — **complete** (see PRODUCTIZATION_V1_PLAN) |
| **Productization P5–P6** | Umbrella for **all UI-P1–UI-P5** delivery |

```
UI-P1 App Shell → UI-P2 Dashboard → UI-P3 Formula List → UI-P4 Detail → UI-P5 Wizard
```

**Rule:** Do **not** start UI-Pn until UI-P(n−1) shell routing and company context plumbing work.

---

## 3. Global principles (all screens)

| Principle | Implementation rule |
|-----------|----------------------|
| **Formula First** | Business drill-in always resolves to `formula_id`; no parallel ledger roots |
| **Global Company Context** | Every business HTTP call sends `X-Company-Id` or `X-Company-Scope: all`; **no** `?company_id=` list hacks |
| **Profit Engine** | **Estimated Net Profit** and **Realized Net Profit** — separate labels; Dashboard **Realized only** |
| **Timeline-centric UX** | Detail Timeline is first-class; Dashboard cash sections are timeline-style lists |
| **Minimum clicks / cognitive load** | One primary action per zone; no decorative chrome |
| **Existing APIs only** | Compose scoped reads; client roll-up where spec allows — **no new routes** |
| **RBAC** | Hide disallowed actions (do not show disabled Cancel/Close to MANAGER) |
| **No frontend-only scope** | **Forbidden:** fetch unscoped list then filter in browser |

---

## 4. Global forbidden (all UI work)

| Forbidden | Notes |
|-----------|-------|
| Backend / DB / API contract changes | Scope doc only |
| New API routes or aggregate Dashboard API | Use Core MVP + client merge per specs |
| Auth / RBAC bypass | JWT + membership role enforced |
| Company Context bypass | DL-050 |
| Frontend-only data scope | Backend scope filters mandatory (v1.4.2) |
| **AI Assistant** | Deferred V2+ — [`FORMULA_DETAIL_SPEC.md`](./FORMULA_DETAIL_SPEC.md) §5 |
| **Draft** (Wizard save/resume/list) | Deferred — [`FORMULA_WIZARD_SPEC.md`](./FORMULA_WIZARD_SPEC.md) §2.6 |
| **Notification engine** | No push/email; header bell **omitted or inert** in v1 UI |
| Decorative animation / marketing layout | Functional wireframe fidelity only |
| Deal / Order / Project entities | Formula First |

---

## 5. UI-P1 — App Shell

**Route prefix:** `/app/*`  
**Spec:** [`NAVIGATION_ARCHITECTURE.md`](./NAVIGATION_ARCHITECTURE.md) §1, §3, §5–§8

### In scope

| Area | Requirement |
|------|-------------|
| **Header Company Switcher** | Options from `GET /api/v1/auth/me`; persist selection; SUPER_ADMIN `all` + banner |
| **Sidebar navigation** | Six menus: Dashboard, Formulas, Companies, Calendar, Reports, Settings |
| **Date Range** | Header control; filters **display** on Dashboard (and carries to list drill-down per Dashboard §4.3) |
| **Search** | Scoped jump to Formula / Company — no unscoped global search |
| **Profile** | User menu, logout, link Settings |
| **Responsive layout** | Sidebar collapses on mobile; header controls remain reachable |
| **HTTP pipeline** | Attach `Authorization` + company headers on every business request |
| **Login gate** | Unauthenticated → `/login`; business routes require company context (non-admin) |

### Out of scope (UI-P1)

| Item | Defer |
|------|-------|
| Dashboard / Formula module content | UI-P2+ |
| Calendar / Reports feature depth | Shell route + placeholder OK |
| Notification badge logic | Forbidden §4 |
| AI Assistant panel | Forbidden §4 |

### Acceptance

- [ ] Switch company → all mounted business views refetch with new header  
- [ ] SUPER_ADMIN `all` shows distinct scope banner  
- [ ] Non-admin cannot open `/app/*` business routes without selected company  

---

## 6. UI-P2 — Dashboard

**Route:** `/app/dashboard` (default landing)  
**Spec:** [`DASHBOARD_V1_SPEC.md`](./DASHBOARD_V1_SPEC.md) §11, §4.1–§4.5, §4.3

### In scope

| Zone | Requirement |
|------|-------------|
| **KPI 8 cards** | 실현 순이익, 미수금, 미지급금, 예정 입금, 예정 출금, 종결 대기, 계산서 미매칭, 총 손실액 — **Realized profit only** on profit card |
| **KPI drill-down** | Card click → **List + pre-filter** (§4.3); **not** Detail by default |
| **Profit section** | Monthly **Realized** graph + Loss Formula TOP (§11 Section 2) |
| **Cash Flow Timeline** | 입금/출금 예정 timeline lists (§11 Section 3) |
| **Recent / Attention Formula** | §11 Section 4 — recent formulas + attention/loss rows; row → Detail |

### Drill-down targets (in scope)

| From | To |
|------|-----|
| Most KPI cards | **Formula List** `/app/formulas` + filter state (UI-P3) |
| 예정 입금 / 예정 출금 | **Payment Schedule List** `/app/payment-schedules` + filter (client merge per Dashboard §8) |

### Out of scope

| Item | Notes |
|------|-------|
| P1 KPI cards (월 매출/매입 등) | Dashboard §4.6 deferred |
| Estimated Net Profit on Dashboard | §4.4 forbidden |
| New dashboard summary API | Client roll-up only |
| Notification engine | Bell omitted/inert |

### Acceptance

- [ ] Eight KPI cards match §11.3 labels and §4.1 definitions  
- [ ] Card click navigates with filter/sort state preserved (Company Context + Date Range)  
- [ ] Loss and negative Realized values visible (§4.5)  

---

## 7. UI-P3 — Formula List

**Route:** `/app/formulas`  
**Spec:** Dashboard §4.3.2, §4.3.3; Navigation §3 Formulas menu

### In scope

| Area | Requirement |
|------|-------------|
| **Company Context** | Inherited from shell — never overridden on list |
| **Filter state** | Accept navigation preset from Dashboard KPI drill-down (query or app state): profit sort, receivable, payable, closeable, invoice unmatched, realized loss |
| **Row → Detail** | Click row → `/app/formulas/{id}` (Overview default) |
| **Row columns (minimum)** | `formula_no`, item/summary, **status** (trade or composite chip), **미수금**, **미지급금**, **Realized Net Profit** (labeled), `created_at` |
| **Pagination** | `GET /api/v1/formulas` scoped — same policy as Dashboard (page_size ≤ 100 for heavy loads) |
| **Per-row KPI** | `GET .../kpi/confirmed` (and receivable/payable signals per existing reads) — batch pattern acceptable |
| **Create entry** | Link/button → `/app/formulas/new` (Wizard — UI-P5) |

### Out of scope

| Item | Notes |
|------|-------|
| Estimated column on list | Optional read for sort — **not** required v1; Realized column required |
| Inline edit | Detail only |
| Unscoped fetch + client filter | Forbidden §3 |

### Acceptance

- [ ] Dashboard drill-down opens list with correct pre-filter  
- [ ] List empty state when scoped set has zero rows  
- [ ] Row navigates to Detail with same company context  

---

## 8. UI-P4 — Formula Detail

**Route:** `/app/formulas/:id`, `/app/formulas/:id/:tab`  
**Spec:** [`FORMULA_DETAIL_SPEC.md`](./FORMULA_DETAIL_SPEC.md) §3 (full wireframe)

### In scope

| Area | Requirement |
|------|-------------|
| **Header Quick Actions** | `+ 입금`, `+ 출금`, `+ Invoice`, `+ 물류`; lifecycle `종결` / `취소` per RBAC |
| **Sticky Summary Cards** | Estimated + Realized profit (separate), 미수/미지급, invoice/logistics status, closeable |
| **Attention Banner** | Rule-based signals §3.2.1 — no AI |
| **Next Actions** | Rule-based only §3.2.2 — 등록/수정/종결 검토 가능 |
| **Timeline + filters** | Chips: 전체, 입출금, 인보이스, 물류, 정산 §3.4.2 |
| **9 tabs** | Overview, Timeline, Participants, Payments, Invoices, Logistics, Shares, Versions, Settlement |
| **Closed Formula** | DL-033 read-only on domain tabs; Settlement allowlist |
| **Mobile** | §3.6 — summary → attention → next actions → tabs |

### Out of scope

| Item | Notes |
|------|-------|
| AI Assistant | §5 Deferred |
| Auto-priority Next Actions | Rule order only |
| Reopen / undo close | MVP excluded |

### Acceptance

- [ ] Profit labels never blended on Summary or Overview  
- [ ] Timeline filter chips match §3.4.2 inclusion rules  
- [ ] MANAGER does not see Cancel/Close/Settlement write  

---

## 9. UI-P5 — Formula Wizard

**Route:** `/app/formulas/new`  
**Spec:** [`FORMULA_WIZARD_SPEC.md`](./FORMULA_WIZARD_SPEC.md) §3–§7, §15

### In scope

| Area | Requirement |
|------|-------------|
| **6-step Wizard** | 기본정보 → 참여회사 → 금액 → 예정입출금 → 물류 → 검토 |
| **Step Navigation** | ✓ / ● / Skip / empty — display only §15.2 |
| **Review edit links** | Step 6 `[수정]` → step → `[ 검토로 돌아가기 ]` §15.3.6 |
| **Estimated profit preview** | Step 3+ — **Estimated Net Profit only** §2.5 |
| **Share optional** | Step 6 slot — UI per §15; **hide or skip** until product approves §12 A |
| **Invoice included** | Step 6 Invoice section + commit in §7 sequence when rows entered |
| **Draft 없음** | In-memory until confirm; leave warning only §2.6 |
| **Steps 4–5 skippable** | Optional schedules / logistics |
| **Post-create** | Success → **Formula Detail Overview** §15.3 |
| **Commit** | Existing POST sequence §7 on `[ Formula 생성 ]` only |

### Out of scope

| Item | Notes |
|------|-------|
| Draft save / resume / list API | Deferred §2.6 |
| Payment **records** in Wizard | Detail Payments tab |
| Close / Cancel / Settlement in Wizard | §6 forbidden |
| Realized profit in Wizard steps | §12 C pending — default **omit** |
| Backend write before Step 6 confirm | Forbidden |

### Acceptance

- [ ] No API calls until Step 6 confirm  
- [ ] Stepper not clickable for jump — Review `[수정]` only  
- [ ] Company Context participant required Step 2  
- [ ] After create, land on Detail Overview with `formula_no` shown  

---

## 10. v0 / Cursor usage notes

| Rule | Detail |
|------|--------|
| **Source of truth** | ASCII wireframes in linked specs — do not invent layout zones |
| **Prompt order** | UI-P1 → UI-P2 → … — do not generate all screens in one pass without shell |
| **API binding** | Wire UI to existing route map in [`TOCS_API_SPEC_v1.1.md`](../api/TOCS_API_SPEC_v1.1.md) — mock only for layout-only passes |
| **Headers** | Every data fetch documents `X-Company-Id` / scope in client layer |
| **Styling** | Minimal: spacing, typography, borders sufficient for usability — **no** design-system expansion in v1 |
| **Share / Invoice Wizard** | Generate Step 6 **sections**; gate commit behind same flags product will use for §12 A/B |
| **Regression** | UI work **must not** change integration gate 343/343 |

---

## 11. Screen checklist summary

| UI-P | Screen | Route(s) | Blocked by |
|------|--------|----------|------------|
| **P1** | App Shell | `/app/*` shell | Auth me + company store |
| **P2** | Dashboard | `/app/dashboard` | UI-P1 |
| **P2b** | Payment Schedule List (drill-down) | `/app/payment-schedules` | UI-P1 (can parallel P2) |
| **P3** | Formula List | `/app/formulas` | UI-P1 |
| **P4** | Formula Detail | `/app/formulas/:id` | UI-P1, P3 |
| **P5** | Formula Wizard | `/app/formulas/new` | UI-P1, P4 (for post-create) |

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-23 | v1.0.0 — UI-P1–P5 scope locked for v0/Cursor; global forbidden + spec index |
