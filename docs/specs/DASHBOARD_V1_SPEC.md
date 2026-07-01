# TOCS Dashboard v1 Specification

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.5.0 (Specification — documentation only) |
| **Status** | ACCEPTED (DL-051) |
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
│  Summary Cards (6)                                                │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐ │
│  │ 미수금 │ │미지급금│ │예정입금│ │예정출금│ │종결대기│ │계산서│ │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └──────┘ │
├──────────────────────────────┬──────────────────────────────────┤
│  Recent Activity (3 panels)  │  Quick Actions (4)                │
│  · 최근 Formula              │  · Formula 생성                   │
│  · 최근 입출금               │  · 입금 등록                      │
│  · 최근 계산서 상태          │  · 출금 등록                      │
│                              │  · 계산서 확인                    │
└──────────────────────────────┴──────────────────────────────────┘
```

Exact visual styling is implementation detail (P5–P6). **Information architecture above is normative.**

---

## 4. Summary cards (Dashboard V1)

Six summary cards. Each card shows **one aggregated number** (currency or count) for the **scoped formula set**, plus optional drill-down link.

**Aggregation rule (v1.5.0):** Client-side roll-up from existing scoped APIs. **No new backend aggregate endpoint.**

### 4.1 Card definitions

| Card (KO) | Card (EN) | Metric | Aggregation source | Existing API(s) |
|-----------|-----------|--------|--------------------|-----------------|
| **미수금** | Receivable | `SUM(receivable)` over scoped formulas | Per-formula confirmed KPI | `GET /api/v1/formulas` (list) + `GET /api/v1/formulas/{id}/receivable-payable` per row **or** `GET /api/v1/formulas/{id}/kpi/participants` summed by company |
| **미지급금** | Payable | `SUM(payable)` | Same | Same |
| **예정 입금** | Scheduled IN | `SUM(scheduled_revenue)` or participant `scheduled_in` | Confirmed KPI scheduled columns | `GET /api/v1/formulas/{id}/kpi/confirmed` or participant KPI list |
| **예정 출금** | Scheduled OUT | `SUM(scheduled_payment)` or participant `scheduled_out` | Same | Same |
| **종결 대기** | Close pending | Count of scoped formulas **eligible to close** but `is_closed = false` | Close pre-check view | `GET /api/v1/formulas` + client filter using close eligibility (`v_formula_closeable` semantics via formula detail/close flow — per-formula check on listed IDs, bounded batch) |
| **계산서 미매칭** | Invoice mismatch | Count of scoped formulas where invoice is **not** fully matched | Invoice derived status | `GET /api/v1/formulas` + `GET /api/v1/formulas/{id}/invoices/status` per row (bounded) **or** count where `invoice_status ≠ AMOUNT_MATCHED` on list response |

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
| 미수금 / 미지급금 | Formula list sorted by receivable/payable (Formula menu) |
| 예정 입금 / 예정 출금 | Payment menu — schedules view |
| 종결 대기 | Formula list filtered to close-eligible (client filter on scoped list) |
| 계산서 미매칭 | Invoice menu or Formula list with invoice status column |

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
| Confirmed KPI | `GET /api/v1/formulas/{id}/kpi/confirmed` |
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
