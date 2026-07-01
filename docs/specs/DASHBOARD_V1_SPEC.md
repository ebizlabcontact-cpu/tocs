# TOCS Dashboard v1 Specification

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.5.4 (KPI policy confirmed — documentation only) |
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
| **P1 KPIs** | **Out of Dashboard v1 layout** — documented for V2+ (§4.6) |

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

## 3. Layout (design)

```
┌─────────────────────────────────────────────────────────────────┐
│  [ Scope banner — SUPER_ADMIN all only ]                          │
├─────────────────────────────────────────────────────────────────┤
│  Summary Cards (7 P0 + Loss §4.5)                                 │
│  ┌──────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐ │
│  │실현순이익│ │ 미수금 │ │미지급금│ │예정입금│ │예정출금│ │종결  │ │
│  └──────────┘ └────────┘ └────────┘ └────────┘ └────────┘ │대기  │ │
│  ┌──────┐ ┌──────────────── 손실 §4.5 ────────────────┐ │      │ │
│  │계산서│ │ 손실 Formula 수 │ 총 손실액 │ 음수 실현순이익 │ └──────┘ │
│  └──────┘ └────────────────────────────────────────────┘           │
├──────────────────────────────┬──────────────────────────────────┤
│  Recent Activity (3 panels)  │  Quick Actions (4)                │
│  · 최근 Formula              │  · Formula 생성                   │
│  · 최근 입출금               │  · 입금 등록                      │
│  · 최근 계산서 상태          │  · 출금 등록                      │
│                              │  · 계산서 확인                    │
└──────────────────────────────┴──────────────────────────────────┘
```

**P1 KPIs (§4.6)** are **not** on this layout in Dashboard v1.

Exact visual styling is implementation detail (P5–P6). **Information architecture above is normative.**

---

## 4. Summary cards (Dashboard V1)

### 4.0 KPI tiers — **confirmed policy**

| Tier | Scope | Dashboard v1 |
|------|-------|--------------|
| **P0** | Required on Dashboard layout | **Included** (§4.1, §4.5) |
| **P1** | Secondary analytics | **Excluded** — V2+ (§4.6) |

**Aggregation rule:** Client-side roll-up from existing scoped APIs. **No new backend aggregate endpoint.**

### 4.1 P0 card definitions

Seven P0 summary cards (+ loss block §4.5). Each P0 card shows **one aggregated number** for the **scoped formula set**.

| Priority | Card (KO) | Card (EN) | Metric | Existing API(s) |
|:--------:|-----------|-----------|--------|-----------------|
| P0 | **실현 순이익** | Realized Net Profit | `SUM(confirmed_net_profit)` | List + `GET .../kpi/confirmed` |
| P0 | **미수금** | Receivable | `SUM(receivable)` | List + `GET .../receivable-payable` or `GET .../kpi/participants` |
| P0 | **미지급금** | Payable | `SUM(payable)` | Same |
| P0 | **예정 입금** | Scheduled IN | `SUM(scheduled_in)` | `GET .../kpi/confirmed` or participant KPI |
| P0 | **예정 출금** | Scheduled OUT | `SUM(scheduled_out)` | Same |
| P0 | **종결 대기** | Close pending | Count close-eligible, not closed | List + `v_formula_closeable` (bounded) |
| P0 | **계산서 미매칭** | Invoice mismatch | Count not amount-matched | List + `GET .../invoices/status` |

**Label rule:** **실현 순이익** = **Realized Net Profit** only (§4.4).

### 4.2 Aggregation performance (UI guidance)

| Pattern | Limit | Notes |
|---------|-------|-------|
| Formula list first | `page_size` ≤ 100 for Dashboard load | Use same pagination policy as Formula menu |
| Per-formula KPI fetch | Max **parallel 10** concurrent requests | Remaining pages loaded on "View all" navigation |
| Card refresh | Full refetch on company context change | Same as DL-050 global context rule |

**Forbidden:** Fetching unscoped formula list and filtering in Frontend. Backend scope (v1.4.2) is mandatory.

### 4.3 Card drill-down

| Card | Default drill-down target |
|------|---------------------------|
| **실현 순이익** | Formula list sorted by confirmed net profit / KPI detail |
| **손실** (§4.5) | Formula list filtered to loss formulas (`kpi/confirmed` &lt; 0) |
| 미수금 / 미지급금 | Formula list sorted by receivable/payable (Formula menu) |
| 예정 입금 / 예정 출금 | Payment menu — schedules view |
| 종결 대기 | Formula list filtered to close-eligible (client filter on scoped list) |
| 계산서 미매칭 | Invoice menu or Formula list with invoice status column |

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
| **별도 손실 카드** | Dedicated **손실** block/cards on Dashboard (§3 layout) — distinct from other P0 cash cards |
| **손실 Formula 수** | Count of scoped formulas where **per-formula** Realized Net Profit &lt; 0 |
| **총 손실액** | `SUM(ABS(confirmed_net_profit))` for formulas with confirmed net profit &lt; 0 only (display as positive loss amount with clear label) |

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

## 5. Recent Activity

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
| Dashboard-only API variants | Reuse standard business routes |

---

## 10. Implementation phases (reference)

| Phase | Milestone | Dashboard deliverable |
|-------|-----------|---------------------|
| P4 | v1.4.1–v1.4.2 ✅ | Scoped backend queries |
| P5 | v1.5.x+ (UI) | App shell + Dashboard layout |
| P6 | v1.5.x+ (UI) | Wire cards / activity / quick actions to scoped APIs |

Optional **V2:** dedicated `GET /api/v1/dashboard/summary` — must accept same company context headers; requires separate DL approval.

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-30 | v1.4.0 — Initial Dashboard v1 outline; global company context (DL-050) |
| 2026-07-01 | v1.5.0 — Full Dashboard V1 spec: 6 summary cards, Recent Activity, Quick Actions (DL-051) |
| 2026-07-01 | v1.5.0 — Pending Decision note: Profit/Loss KPI (§4.4) |
| 2026-07-01 | v1.5.2 — §4.4: Estimated vs Realized Net Profit terminology confirmed; layout L1–L4 Pending |
| 2026-07-01 | v1.5.4 — **KPI policy confirmed:** P0 (7 cards + loss §4.5), P1 deferred §4.6; Dashboard Realized only |
