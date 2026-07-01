# TOCS Dashboard v1 Specification

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.5.7 (KPI drill-down policy **Accepted**) |
| **Status** | ACCEPTED (DL-051) — **§4 KPI policy amended** v1.5.4 |
| **Implementation** | **Not started** — UI in P5–P6; backend scope filters shipped (v1.4.2) |

**Related:** [`GLOBAL_COMPANY_CONTEXT_POLICY.md`](./GLOBAL_COMPANY_CONTEXT_POLICY.md), [`NAVIGATION_ARCHITECTURE.md`](./NAVIGATION_ARCHITECTURE.md), [`PRODUCTIZATION_V1_PLAN.md`](./PRODUCTIZATION_V1_PLAN.md), [`ROUTE_PROTECTION_POLICY.md`](./ROUTE_PROTECTION_POLICY.md), [`FEATURE_DECISION_AUDIT.md`](./FEATURE_DECISION_AUDIT.md)

**Decision:** DL-051 — Dashboard v1 Specification (ACCEPTED)

**Prerequisites (shipped):**

- Global Company Context policy (DL-050)
- Company context middleware (v1.4.1)
- Service-layer scope filters (v1.4.2)
- Core MVP Dashboard/KPI HTTP routes (DL-034)

---

## 1. Overview

Dashboard v1 is the **first screen after login** (`/app/dashboard`). It summarizes operational KPIs and recent activity for the **Header Company Switcher scope** — not an independent company filter.

| Principle | Rule |
|-----------|------|
| **Landing menu** | Default post-login route is Dashboard (see NAVIGATION_ARCHITECTURE §5) |
| **Same context as other menus** | All widgets use global `request.companyContext` headers |
| **No Dashboard-only filter** | Forbidden: separate company dropdown on Dashboard |
| **Reuse existing APIs** | No new KPI engine; no `GET /dashboard/summary` in v1.5.0 |
| **Formula First** | All metrics derive from **scoped formula set** only |
| **Client aggregation allowed** | Summary cards may roll up existing per-formula/list endpoints |
| **Profit on Dashboard** | **Realized Net Profit (실현 순이익) only** — **Estimated excluded** (§4.4) |
| **5-second executive scan** | Layout prioritizes P0 numbers above the fold (§11) |

---

## 2. Global company context (required)

Every Dashboard data fetch uses **identical headers** to Formula/Payment menus:

| Header | When |
|--------|------|
| `Authorization: Bearer <token>` | Always |
| `X-Company-Id: <uuid>` | Non–SUPER_ADMIN; SUPER_ADMIN in company mode |
| `X-Company-Scope: all` | SUPER_ADMIN all-companies mode only |

Missing company context on business routes → **400** `COMPANY_CONTEXT_REQUIRED` (v1.4.2).

### 2.1 Scope behavior

| `request.companyContext.mode` | Dashboard aggregation |
|-------------------------------|------------------------|
| `company` | Only formulas with `∃ formula_participants WHERE company_id = active_company_id` |
| `all` (SUPER_ADMIN only) | All formulas across companies; platform-wide totals |

UI must show active scope banner for SUPER_ADMIN `all` mode (NAVIGATION_ARCHITECTURE §7).

---

## 3. Layout (summary)

Normative **screen wireframe** is **§11** (desktop + mobile). Below is the **logical zone map** only — not a build spec.

| Zone | §11 | Policy |
|------|-----|--------|
| Header | Header | Global Company Context (DL-050) |
| KPI cards | Section 1 | §4.1, §4.5 |
| Profit / loss detail | Section 2 | §4.4 Realized only |
| Cash timelines | Section 3 | Timeline-centric UX |
| Formula lists | Section 4 | Formula First |

**P1 KPI cards (§4.6)** remain excluded. §11 Section 2 **monthly Realized graph** is wireframe visualization — not P1 “월 매출/매입” cards.

---

## 4. Summary cards (Dashboard V1)

### 4.0 KPI tiers — **confirmed policy**

| Tier | Scope | Dashboard v1 |
|------|-------|--------------|
| **P0** | Required on Dashboard layout | **Included** — 8 KPI cards (§4.1, §11 Section 1) |
| **P1** | Secondary analytics | **Excluded** — V2+ (§4.6) |

**Aggregation rule:** Client-side roll-up from existing scoped APIs. **No new backend aggregate endpoint.**

### 4.1 P0 card definitions (Section 1 wireframe)

Eight KPI cards in **§11 Section 1**. Each shows **one aggregated number** for the **scoped formula set**.

| Priority | Card (KO) | Card (EN) | Metric | Existing API(s) |
|:--------:|-----------|-----------|--------|-----------------|
| P0 | **실현 순이익** | Realized Net Profit | `SUM(confirmed_net_profit)` — **negative allowed** (§4.5) | List + `GET .../kpi/confirmed` |
| P0 | **미수금** | Receivable | `SUM(receivable)` | List + `GET .../receivable-payable` or `GET .../kpi/participants` |
| P0 | **미지급금** | Payable | `SUM(payable)` | Same |
| P0 | **예정 입금** | Scheduled IN | `SUM(scheduled_in)` | `GET .../kpi/confirmed` or participant KPI |
| P0 | **예정 출금** | Scheduled OUT | `SUM(scheduled_out)` | Same |
| P0 | **종결 대기** | Close pending | Count close-eligible, not closed | List + `v_formula_closeable` (bounded) |
| P0 | **계산서 미매칭** | Invoice mismatch | Count not amount-matched | List + `GET .../invoices/status` |
| P0 | **총 손실액** | Total loss amount | `SUM(ABS(confirmed_net_profit))` where per-formula profit &lt; 0 | `GET .../kpi/confirmed` per formula |

**Label rule:** **실현 순이익** = **Realized Net Profit** only (§4.4).

### 4.2 Aggregation performance (UI guidance)

| Pattern | Limit | Notes |
|---------|-------|-------|
| Formula list first | `page_size` ≤ 100 for Dashboard load | Use same pagination policy as Formula menu |
| Per-formula KPI fetch | Max **parallel 10** concurrent requests | Remaining pages loaded on "View all" navigation |
| Card refresh | Full refetch on company context change | Same as DL-050 global context rule |

**Forbidden:** Fetching unscoped formula list and filtering in Frontend. Backend scope (v1.4.2) is mandatory.

### 4.3 KPI card drill-down — **Accepted**

**Status:** **Accepted**

**Core rule:**

```
Card click  =  existing List screen  +  pre-applied filter
```

| Rule | Detail |
|------|--------|
| **No new API** | Drill-down uses **existing** list routes and Core MVP reads (§8) — **forbidden** to add Dashboard-specific list endpoints |
| **Company Context** | **`X-Company-Id` / `X-Company-Scope: all` unchanged** — same global context as Dashboard; list screens **must not** drop or override header scope |
| **Date Range** | Dashboard **Date Range** (§11.2) **carried forward** as list filter state when navigating from a card (where metric is date-sensitive) |
| **Mobile** | **Identical** targets and filters as desktop — only layout differs |
| **Formula First** | Formula List drill-downs land on **`/app/formulas`**; schedule drill-downs on **Payment Schedule List** (§4.3.2) |

#### 4.3.1 Card → screen mapping

| KPI card | Target list screen | Pre-applied filter / sort |
|----------|-------------------|---------------------------|
| **실현 순이익** | **Formula List** | **Profit sort** — Realized Net Profit descending (`kpi/confirmed`) |
| **미수금** | **Formula List** | `receivable > 0` |
| **미지급금** | **Formula List** | `payable > 0` |
| **예정 입금** | **Payment Schedule List** | `direction = incoming` (IN) **+ incomplete** |
| **예정 출금** | **Payment Schedule List** | `direction = outgoing` (OUT) **+ incomplete** |
| **종결 대기** | **Formula List** | `closeable = true` |
| **계산서 미매칭** | **Formula List** | `invoice unmatched` |
| **총 손실액** | **Formula List** | `realized_profit < 0` |

#### 4.3.2 List screen definitions

| List screen | Route (design) | Data source (existing APIs) |
|-------------|----------------|----------------------------|
| **Formula List** | `/app/formulas` | `GET /api/v1/formulas` (scoped) + per-row KPI/status for sort/filter |
| **Payment Schedule List** | `/app/payment-schedules` | Scoped formulas → `GET .../payment-schedules`; client merge (§11.5) |

**Filter application:** Pre-filter/sort on **scoped** data or navigation state preset. **Forbidden:** unscoped fetch then filter.

#### 4.3.3 Filter semantics

| Filter token | Meaning |
|--------------|---------|
| **Profit sort** | Sort by Realized Net Profit descending |
| **receivable > 0** | Aggregate receivable &gt; 0 |
| **payable > 0** | Aggregate payable &gt; 0 |
| **incoming + incomplete** | Schedule IN; incomplete = not fully covered by payment records |
| **outgoing + incomplete** | Schedule OUT; same incomplete rule |
| **closeable = true** | Close-eligible (`v_formula_closeable`), not closed |
| **invoice unmatched** | Invoice not fully amount-matched |
| **realized_profit < 0** | Confirmed net profit &lt; 0 |

#### 4.3.4 Forbidden

| Forbidden | Reason |
|-----------|--------|
| New drill-down or Dashboard list API | §8 |
| Dashboard-only list routes | Reuse Formula / Payment Schedule lists |
| Drop Company Context on navigation | DL-050 |
| Drop Date Range when range-bound | §11.2 |
| Estimated metric on drill-down | §4.4 |
| Card → Formula Detail directly (default) | List first; row → Detail |

### 4.4 Profit policy — **confirmed**

Shared terminology with [`FORMULA_WIZARD_SPEC.md`](./FORMULA_WIZARD_SPEC.md) §2.5.

```
Estimated Net Profit (예상 순이익)  ≠  Realized Net Profit (실현 순이익)
```

**Mixing forbidden:** same card, label, or roll-up for both metrics.

#### Estimated Net Profit (예상 순이익)

| Field | Rule |
|-------|------|
| **Definition** | 예상 매출 − 예상 매입 − 예상 비용 − 예상 Share |
| **Basis** | Formula engine / snapshot — not bank cash |
| **Dashboard v1** | **Excluded** — **must not** appear on Dashboard cards or P1 placeholders in v1 layout |
| **Allowed surfaces** | **Formula Wizard** · **Formula Detail** · **Formula Preview** |
| **API (existing)** | `GET /api/v1/formulas/{id}/kpi/expected` → `expected_net_profit` |

#### Realized Net Profit (실현 순이익)

| Field | Rule |
|-------|------|
| **Definition** | 실제 입금 − 실제 출금 − 실제 비용 − 확정 Share |
| **Basis** | **Payment Record** — confirmed bank movements |
| **Dashboard v1** | **Only profit metric on Dashboard** — P0 card **실현 순이익** (§4.1) |
| **Company scope** | Aggregate per active company context (client roll-up) |
| **API (existing)** | `GET /api/v1/formulas/{id}/kpi/confirmed` → confirmed net profit |

**Deprecated in new UI copy:** “계산상 이익”, “확정 이익” as standalone KPI names.

---

### 4.5 Loss policy — **confirmed**

Applies to **Realized Net Profit** only (§4.4). **Estimated** loss preview is **not** on Dashboard.

| Rule | Detail |
|------|--------|
| **음수 실현 순이익 표시** | P0 **실현 순이익** card shows **negative values** when aggregate confirmed net profit &lt; 0 |
| **총 손실액 카드** | P0 **총 손실액** in §11 Section 1 — positive loss amount label (§4.1) |
| **손실 Formula TOP** | §11 Section 2 ranked list — count + detail per loss formula |

| Metric | Source |
|--------|--------|
| Per-formula sign | `GET .../kpi/confirmed` per scoped formula |
| Aggregate | Client roll-up (§4.2) — **no new API** |

**Forbidden:** Hiding losses behind zero-only display; using Estimated metric for loss block.

---

### 4.6 P1 KPI — **out of Dashboard v1 scope**

Documented for **V2+** or later Dashboard iteration. **Not** on v1 layout (§3). Requires separate product approval before UI/API work.

| P1 KPI (KO) | Notes |
|-------------|-------|
| **월 매출** | Monthly revenue roll-up — period filter TBD |
| **월 매입** | Monthly purchase roll-up — period filter TBD |
| **회사별 매출** | Per-company revenue within scope |
| **회사별 순이익** | Per-company **Realized** net profit (not Estimated on Dashboard) |
| **품목별 순이익** | Per-item net profit — item dimension on scoped formulas |

**V1 rule:** P6 Dashboard implements **P0 + §4.5 only**. P1 is **not** a v1 deliverable unless explicitly re-scoped.

---

## 5. Recent Activity (legacy drill-down reference)

> **Layout:** Superseded by **§11 Section 4** for Dashboard screen wireframe. Retained for **API / navigation** rules.

Three read-only panels. All data **scoped** by `request.companyContext`.

### 5.1 최근 Formula

| Field | Rule |
|-------|------|
| **Source** | `GET /api/v1/formulas?page=1&page_size=10` (scoped) |
| **Sort** | `created_at` descending (default list order) |
| **Display** | `formula_no`, item/trade summary, `trade_status`, `created_at` |
| **Row action** | Navigate to `/app/formulas/{id}` |

### 5.2 최근 입출금

| Field | Rule |
|-------|------|
| **Source** | No cross-formula payment list API in MVP — **composite client pattern** |
| **Pattern** | Load recent N formulas (§5.1, N ≤ 5) → `GET /api/v1/formulas/{id}/payment-records` per formula (scoped) |
| **Merge** | Client merges records; sort by `actual_date` desc; show top 10 |
| **Display** | Formula no, direction (IN/OUT), amount, date, status |
| **Row action** | Navigate to Formula payment tab |

**Note:** Full Payment Timeline product module is **out of scope** (see FEATURE_DECISION_AUDIT.md). Dashboard shows **recent snapshot only**.

### 5.3 최근 계산서 상태

| Field | Rule |
|-------|------|
| **Source** | Recent N scoped formulas (§5.1, N ≤ 5) → `GET /api/v1/formulas/{id}/invoices/status` |
| **Display** | Formula no, `derived_invoice_status` / `invoice_status`, last sync indicator |
| **Row action** | Navigate to Formula invoice tab |

---

## 6. Quick Actions

Four primary actions. Each respects RBAC minimum role from [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md).

| Action (KO) | Target | Minimum role | Notes |
|-------------|--------|:------------:|-------|
| **Formula 생성** | `/app/formulas/new` | MANAGER | Standard create form — **not** Formula Wizard (V2 / separate approval) |
| **입금 등록** | Payment record create flow | MANAGER | Requires formula selection step if no context formula |
| **출금 등록** | Payment record create flow | MANAGER | Direction = OUT (or domain OUT enum) |
| **계산서 확인** | `/app/invoices` or Formula invoice list | VIEWER | Read-first navigation |

Quick Actions **do not bypass** company context. Create flows inherit global `X-Company-Id` / scope headers.

---

## 7. UX flows

### 7.1 Login → Dashboard

1. Authenticate (`POST /api/v1/auth/login`).
2. Load memberships (`GET /api/v1/auth/me`).
3. Resolve company context (switcher auto-select or blocking prompt if unset).
4. Navigate to `/app/dashboard`.
5. Parallel fetch: formula list (cards + recent) + unmatched payments alert (optional badge).
6. Bounded per-formula KPI/status fetches for card aggregation (§4.2).

### 7.2 Company change while on Dashboard

1. User changes Header Company Switcher.
2. Global store updates `active_company_id` or `all` scope.
3. Dashboard **invalidates all widgets** and refetches with new headers.
4. Summary cards, Recent Activity, and Quick Action deep-links all reflect new scope.

### 7.3 SUPER_ADMIN modes

| Mode | Dashboard behavior |
|------|-------------------|
| `X-Company-Scope: all` | Platform-wide card totals; scope banner **required** |
| `X-Company-Id: <uuid>` | Same as company user view for that company |

---

## 8. API inventory (reuse only)

Dashboard v1 **must not** introduce new HTTP routes in v1.5.0.

| Purpose | Route |
|---------|-------|
| Scoped formula set | `GET /api/v1/formulas` |
| Receivable / payable | `GET /api/v1/formulas/{id}/receivable-payable` |
| Confirmed KPI — **Realized Net Profit** (Dashboard P0) | `GET /api/v1/formulas/{id}/kpi/confirmed` |
| Expected KPI — **Estimated Net Profit** | `GET /api/v1/formulas/{id}/kpi/expected` — **not used on Dashboard v1** (§4.4); Formula Wizard / Detail / Preview only |
| Participant KPI | `GET /api/v1/formulas/{id}/kpi/participants` |
| Unmatched payments | `GET /api/v1/payments/unmatched` |
| Invoice status | `GET /api/v1/formulas/{id}/invoices/status` |
| Payment records (recent) | `GET /api/v1/formulas/{id}/payment-records` |
| Formula create | `POST /api/v1/formulas` (via Formula module) |
| Payment record create | `POST /api/v1/formulas/{id}/payment-records` (via Payment module) |

All routes require auth + company context per v1.4.2.

---

## 9. Forbidden patterns

| Pattern | Reason |
|---------|--------|
| Dashboard-local company `<select>` | Violates DL-050 global context |
| `?company_id=` query params | Headers only |
| Client-side filter after unscoped API | Backend must enforce scope |
| New KPI engine / aggregate API | v1.5.0 docs-only; defer to V2 proposal |
| **Estimated Net Profit** on Dashboard v1 | §4.4 — Dashboard **Realized only** |
| Mixing Estimated / Realized labels or roll-ups | §4.4 — **forbidden** |
| P1 KPI cards without re-scope | §4.6 — out of v1 layout |
| Formula Wizard on Quick Action | Separate product decision (FEATURE_DECISION_AUDIT) |
| Dashboard KPI card opens Detail directly (bypass List) | §4.3 — List + filter first |
| Drill-down-specific API routes | §4.3 — use existing list APIs |

---

## 10. Implementation phases (reference)

| Phase | Milestone | Dashboard deliverable |
|-------|-----------|---------------------|
| P4 | v1.4.1–v1.4.2 ✅ | Scoped backend queries |
| P5 | v1.5.x+ (UI) | App shell + Dashboard layout |
| P6 | v1.5.x+ (UI) | Implement **§11 wireframe** against scoped APIs |

Optional **V2:** dedicated `GET /api/v1/dashboard/summary` — must accept same company context headers; requires separate DL approval.

---

## 11. Screen wireframe (Productization V1)

**Scope:** Information architecture and **ASCII wireframe only**. **No** visual design system, **no** React/components, **no** v0 code.

**Goal:** Representative (**대표**) can grasp **company state in ~5 seconds** from Section 1 KPI row + header context.

### 11.0 Wireframe principles

| Principle | Wireframe rule |
|-----------|----------------|
| **5-second scan** | Section 1 KPI cards **first row below header** — largest numeric emphasis |
| **Formula First** | KPI card → **List + filter** (§4.3); row → Formula Detail / Timeline |
| **Global Company Context** | **Company Switcher** in header only — Date Range filters **display**, not company scope |
| **Profit Engine** | Dashboard shows **Realized Net Profit** only — graph and cards use `kpi/confirmed`; **no Estimated** |
| **Timeline-centric** | Section 3 cash timelines; Section 4 row click → Formula Detail **Timeline** default optional |
| **Existing APIs** | All widgets compose scoped list + per-formula reads (§4.2, §8) — **no new routes** |

---

### 11.1 Desktop wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ HEADER                                                                        │
│ [TOCS]  [Company Switcher ▼]  [Date Range ▼]  [Search…]  [🔔]  [Profile ▼]  │
│ [ Scope banner — SUPER_ADMIN all only ]                                       │
├──────────────────────────────────────────────────────────────────────────────┤
│ SECTION 1 — KPI CARDS (horizontal scroll or 2-row grid if narrow)             │
│ ┌──────────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────────┐   │
│ │실현 순이익││ 미수금││미지급││예정  ││예정  ││종결  ││계산서││ 총 손실액 │   │
│ │  ±₩…    ││  ₩… ││  ₩… ││입금  ││출금  ││ 대기 ││미매칭││   ₩…    │   │
│ └──────────┘└──────┘└──────┘└──────┘└──────┘└──────┘└──────┘└──────────┘   │
├──────────────────────────────────────────────────────────────────────────────┤
│ SECTION 2 — PROFIT                                                            │
│ ┌───────────────────────────────┐  ┌─────────────────────────────────────┐ │
│ │ 월별 실현 순이익 (bar/line)    │  │ 손실 Formula TOP (N≤5)              │ │
│ │ [Date Range applies]           │  │ formula_no │ loss amt │ link →      │ │
│ │ Realized only — no Estimated   │  │ …                                  │ │
│ └───────────────────────────────┘  └─────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│ SECTION 3 — CASH FLOW (Timeline)                                              │
│ ┌─────────────────────────────┐  ┌─────────────────────────────┐           │
│ │ 입금 예정 Timeline           │  │ 출금 예정 Timeline           │           │
│ │ date │ formula │ amount     │  │ date │ formula │ amount     │           │
│ │ … (scoped schedules)        │  │ …                           │           │
│ └─────────────────────────────┘  └─────────────────────────────┘           │
├──────────────────────────────────────────────────────────────────────────────┤
│ SECTION 4 — FORMULA                                                           │
│ ┌─────────────────────────────┐  ┌─────────────────────────────┐           │
│ │ 최근 Formula (N≤10)         │  │ 주의 Formula (N≤10)          │           │
│ │ formula_no │ status │ date  │  │ formula_no │ reason │ date  │           │
│ └─────────────────────────────┘  └─────────────────────────────┘           │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### 11.2 Header (wireframe)

| Control | Purpose | Scope / notes |
|---------|---------|---------------|
| **Company Switcher** | Global context (DL-050) | Sets `X-Company-Id` / `all` — **required** before data load |
| **Date Range** | Filter **display** window for §11 Sections 2–3 | Client-side filter on fetched schedule/record dates; **does not** replace company header |
| **Search** | Jump to Formula / Company | Query scoped formula list or navigate to search results — **no** global unscoped search |
| **Notification** | Alert badge (unmatched payments, close pending count) | Read from existing KPI/list signals; **no** notification engine in v1 |
| **Profile** | User menu, logout, settings link | Auth/me; **not** company switcher |

---

### 11.3 Section 1 — KPI Cards

| Card | Wireframe metric | §4 ref |
|------|------------------|--------|
| 실현 순이익 | Aggregate Realized Net Profit | §4.1, §4.4 |
| 미수금 | Sum receivable | §4.1 |
| 미지급금 | Sum payable | §4.1 |
| 예정 입금 | Sum scheduled IN | §4.1 |
| 예정 출금 | Sum scheduled OUT | §4.1 |
| 종결 대기 | Count close-eligible | §4.1 |
| 계산서 미매칭 | Count invoice mismatch | §4.1 |
| 총 손실액 | Sum of loss amounts (formulas with profit &lt; 0) | §4.1, §4.5 |

**Interaction:** Card click → **§4.3** (List screen + pre-filter). **Same on mobile.**

---

### 11.4 Section 2 — Profit

| Widget | Content | Data intent (existing APIs) |
|--------|---------|----------------------------|
| **월별 실현 순이익 그래프** | Monthly buckets of **Realized Net Profit** | Client buckets `payment-records` + confirmed KPI by month within Date Range; **Realized only** |
| **손실 Formula TOP** | Ranked list of worst loss formulas | Per-formula `kpi/confirmed` &lt; 0; sort ascending; top N |

**Forbidden:** Estimated Net Profit series on this chart.

---

### 11.5 Section 3 — Cash Flow

| Widget | Content | Data intent |
|--------|---------|-------------|
| **입금 예정 Timeline** | Chronological **scheduled IN** rows | Scoped formulas → `payment-schedules` where `direction=IN`; sort by `scheduled_date` |
| **출금 예정 Timeline** | Chronological **scheduled OUT** rows | Same for OUT |

**UX:** Timeline layout (not calendar grid). Row click → Formula Detail **Payments** or **Timeline** tab.

---

### 11.6 Section 4 — Formula

| Widget | Content | Data intent |
|--------|---------|-------------|
| **최근 Formula** | Last created scoped formulas | `GET /formulas` `created_at DESC`, N≤10 |
| **주의 Formula** | Formulas needing attention | Client rule: union of **loss**, **종결 대기**, **계산서 미매칭**, optional **unmatched payment** — dedupe by `formula_id` |

| 주의 reason (examples) | Source |
|------------------------|--------|
| Loss | `kpi/confirmed` &lt; 0 |
| Close pending | Close-eligible + not closed |
| Invoice mismatch | Invoice status not matched |
| Unmatched payment | `GET /payments/unmatched` (if in scope) |

Row click → `/app/formulas/{id}` (Overview or Timeline).

---

### 11.7 Mobile wireframe

**Rule:** **All sections vertical stack** — same order as desktop: Header → Section 1 → 2 → 3 → 4.

```
┌─────────────────────┐
│ HEADER (collapsed)  │
│ [Co ▼] [Date] [🔔] │
├─────────────────────┤
│ S1 KPI (1 col scroll│
│  or 2-col mini grid)│
├─────────────────────┤
│ S2 Profit graph     │
│ S2 Loss TOP         │
├─────────────────────┤
│ S3 입금 Timeline    │
│ S3 출금 Timeline    │
├─────────────────────┤
│ S4 최근 Formula     │
│ S4 주의 Formula     │
└─────────────────────┘
```

Search / Profile may move to header overflow menu on narrow viewports — **implementation detail**; controls remain available.

---

### 11.8 Wireframe forbidden

| Forbidden | Reason |
|-----------|--------|
| React / component library spec | Out of scope |
| Color, typography, spacing tokens | Visual design phase |
| Estimated profit on Dashboard widgets | §4.4 |
| Dashboard-local company filter | DL-050 |
| New aggregate HTTP routes | §8 |

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-30 | v1.4.0 — Initial Dashboard v1 outline; global company context (DL-050) |
| 2026-07-01 | v1.5.0 — Full Dashboard V1 spec: 6 summary cards, Recent Activity, Quick Actions (DL-051) |
| 2026-07-01 | v1.5.0 — Pending Decision note: Profit/Loss KPI (§4.4) |
| 2026-07-01 | v1.5.2 — §4.4: Estimated vs Realized Net Profit terminology confirmed; layout L1–L4 Pending |
| 2026-07-01 | v1.5.4 — **KPI policy confirmed:** P0 + loss; Dashboard Realized only |
| 2026-07-01 | v1.5.6 — **§11 Screen wireframe** (Header + 4 sections; mobile stack) |
| 2026-07-01 | v1.5.7 — **§4.3 KPI card drill-down Accepted** (List + pre-filter; no new API) |
