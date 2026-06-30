# TOCS Dashboard v1 Specification

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.4.0 (Specification — documentation only) |
| **Status** | ACCEPTED (DL-050) |
| **Implementation** | **Not started** — UI and scoped aggregation in future milestones |

**Related:** [`GLOBAL_COMPANY_CONTEXT_POLICY.md`](./GLOBAL_COMPANY_CONTEXT_POLICY.md), [`NAVIGATION_ARCHITECTURE.md`](./NAVIGATION_ARCHITECTURE.md), [`PRODUCTIZATION_V1_PLAN.md`](./PRODUCTIZATION_V1_PLAN.md), [`ROUTE_PROTECTION_POLICY.md`](./ROUTE_PROTECTION_POLICY.md)

---

## 1. Overview

Dashboard v1 is the **landing menu** after login. It summarizes operational KPIs for the **currently selected global company** — not an independent company filter.

| Principle | Rule |
|-----------|------|
| **Same context as other menus** | Dashboard uses Header Company Switcher scope only |
| **No Dashboard-only filter** | Forbidden: separate company dropdown on Dashboard page |
| **Backend aggregation** | KPI endpoints apply Formula scope for `active_company_id` |
| **Formula First** | All widgets derive from formulas visible in active company context |

---

## 2. Global company context (required)

Dashboard API calls use **identical headers** to Formula/Payment menus:

| Header | When |
|--------|------|
| `Authorization: Bearer <token>` | Always |
| `X-Company-Id: <uuid>` | Non–SUPER_ADMIN; SUPER_ADMIN in company mode |
| `X-Company-Scope: all` | SUPER_ADMIN all-companies mode only |

Missing company context → **400** `COMPANY_CONTEXT_REQUIRED` (future backend).

---

## 3. Dashboard widgets (v1 scope)

| Widget | API source | Scope rule |
|--------|------------|------------|
| **Unmatched payments** | `GET /api/v1/payments/unmatched` | Formulas with participant `company_id = active_company_id` |
| **Formula KPI — confirmed** | `GET /api/v1/formulas/:formulaId/kpi/confirmed` | Per-formula; list driven by scoped formula set |
| **Formula KPI — expected** | `GET /api/v1/formulas/:formulaId/kpi/expected` | Same |
| **Receivable / payable** | `GET /api/v1/formulas/:formulaId/receivable-payable` | Same |
| **Participant KPI** | `GET /api/v1/formulas/:formulaId/kpi/participants` | Same |

### 3.1 Aggregate views (design)

v1 Dashboard may show:

- **Summary cards** — counts/totals over scoped formula set (client-side roll-up from list endpoints in MVP UI, or dedicated aggregate API in future batch).
- **Recent formulas** — `GET /api/v1/formulas` with global company filter applied server-side.
- **Unmatched payment alert** — scoped unmatched list.

**Rule:** Any aggregate must use the **same** `active_company_id` as Formula menu — no secondary filter.

---

## 4. SUPER_ADMIN Dashboard

| Mode | Dashboard behavior |
|------|-------------------|
| `X-Company-Scope: all` | Platform-wide KPIs; all formulas across companies |
| `X-Company-Id: <uuid>` | Same as normal user view for that company |

UI must show active scope banner (see NAVIGATION_ARCHITECTURE §7).

---

## 5. UX flows

### 5.1 Login → Dashboard

1. Authenticate.
2. Load memberships via `/auth/me`.
3. If company not selected → prompt company switcher (blocking overlay).
4. Navigate to Dashboard with global context set.
5. Fetch KPI/unmatched with company headers.

### 5.2 Company change while on Dashboard

1. User changes Header Company Switcher.
2. Global store updates `active_company_id`.
3. Dashboard **refetches all widgets** (same as switching company on Formula list would).

---

## 6. Forbidden patterns

| Pattern | Reason |
|---------|--------|
| Dashboard-local company `<select>` | Violates global context (DL-050) |
| `GET /payments/unmatched?company_id=` | Use headers only |
| Client-side filter after unscoped API | Backend must enforce scope |
| Dashboard-only API variants | Reuse standard business routes |

---

## 7. Future implementation notes

- Backend P4 milestone adds Service-layer list filtering by `request.companyContext`.
- UI P5–P6 milestones build Dashboard layout consuming scoped APIs.
- Optional v1.1: dedicated `GET /api/v1/dashboard/summary` — must accept same headers; not in v1.4.0 scope.

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-30 | v1.4.0 — Dashboard v1 spec; global company context (DL-050) |
