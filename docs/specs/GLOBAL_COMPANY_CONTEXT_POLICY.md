# TOCS Global Company Context Policy

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.4.1 (Middleware — implemented) |
| **Status** | ACCEPTED (DL-050) |
| **Implementation** | **Middleware shipped** (v1.4.1) — `request.companyContext` from headers; Service-layer list filtering **not started** |

**Related:** [`PRODUCTIZATION_V1_PLAN.md`](./PRODUCTIZATION_V1_PLAN.md), [`NAVIGATION_ARCHITECTURE.md`](./NAVIGATION_ARCHITECTURE.md), [`DASHBOARD_V1_SPEC.md`](./DASHBOARD_V1_SPEC.md), [`ROUTE_PROTECTION_POLICY.md`](./ROUTE_PROTECTION_POLICY.md), [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md), [`AUTH_RBAC_SPEC.md`](./AUTH_RBAC_SPEC.md)

**Decision:** DL-050 — Global Company Context Policy (ACCEPTED)

---

## 1. Overview

TOCS **Header Company Switcher** is not a Dashboard-only filter. It establishes **Global Company Context** — the active company scope applied to **every business menu and API read/write path** after authentication.

| Principle | Rule |
|-----------|------|
| **Global, not local** | `active_company_id` applies to Formula, Payment, Invoice, Logistics, Settlement, Share, Version, Participant, Company, and Dashboard/KPI — not Dashboard alone |
| **Backend enforced** | Company scope is resolved and enforced on the server; Frontend-only filtering is forbidden |
| **Single transport** | Company context travels via HTTP headers — not per-menu query params |
| **Fail closed (non-admin)** | Non–`SUPER_ADMIN` users cannot query business data without an active company context |
| **Formula First preserved** | Global context narrows **which formulas/resources** are visible; Formula remains the business root |

This policy **extends** DL-046 route protection. Auth middleware (`request.auth`) answers *who*; company context middleware answers *for which company* (or *all* for platform operators).

---

## 2. Core decisions (DL-050)

1. Header Company Switcher = **Global Company Context**.
2. Selected `active_company_id` applies to **all menus**, not Dashboard only.
3. **Non–`SUPER_ADMIN`** users cannot query business data without active company context.
4. **`SUPER_ADMIN` only** may use **all scope** (`mode: 'all'`).
5. All business APIs must return data **within the selected company scope** (or all scope for `SUPER_ADMIN`).

---

## 3. Request model

After authentication, the HTTP layer attaches:

```typescript
request.companyContext = {
  mode: 'company' | 'all',
  companyId: string | null,  // UUID when mode === 'company'; null when mode === 'all'
};
```

| Field | Meaning |
|-------|---------|
| `mode: 'company'` | Single-company scope; `companyId` required |
| `mode: 'all'` | Platform-wide scope; **`SUPER_ADMIN` only** |
| `companyId` | Active company from Header Company Switcher |

**Layer discipline:** Service layer receives resolved context from HTTP middleware — Services do not parse `X-Company-*` headers directly unless explicitly documented for a boundary adapter.

---

## 4. HTTP headers

| Header | Required | Values | Who |
|--------|----------|--------|-----|
| `Authorization` | Yes (business routes) | `Bearer <access_token>` | All authenticated users |
| `X-Company-Id` | Yes when `mode = company` | UUID of active company | All non–`SUPER_ADMIN` on company-scoped business requests |
| `X-Company-Scope` | Optional | `all` | **`SUPER_ADMIN` only** |

### 4.1 Normal user (`VIEWER`, `MANAGER`, `COMPANY_ADMIN`)

- **`X-Company-Id` required** on all company-scoped business API requests.
- Caller must have **active** `company_memberships` row for `X-Company-Id`.
- **`X-Company-Scope: all` forbidden** → **403** `FORBIDDEN`.
- Missing `X-Company-Id` on business routes → **400** `COMPANY_CONTEXT_REQUIRED` (preferred) or **403** per implementation milestone.

### 4.2 SUPER_ADMIN

- **`X-Company-Scope: all`** — platform-wide read/write subject to RBAC (no membership filter).
- **`X-Company-Id: <uuid>`** — operate as if scoped to that company (audit-friendly explicit scope).
- If neither header provided on list/read business routes → **400** `COMPANY_CONTEXT_REQUIRED` (fail closed; no implicit global leak).

### 4.3 Exempt routes

No company context headers on:

| Route | Reason |
|-------|--------|
| `GET /api/v1/health` | Public |
| `POST /api/v1/auth/login` | Pre-auth |
| `POST /api/v1/auth/refresh` | Token rotation |
| `POST /api/v1/auth/logout` | Session revoke |
| `GET /api/v1/auth/me` | Returns memberships; client selects active company after load |

---

## 5. Evaluation order

```
Request
  → PUBLIC? → allow
  → AUTHENTICATED (JWT, ACTIVE user) → request.auth
  → RBAC (minimum role) → requireRole
  → GLOBAL COMPANY CONTEXT → request.companyContext
  → ROUTE / RESOURCE SCOPE (formula participant, path companyId)
  → Handler → Service → Repository
```

Global company context runs **after** auth + RBAC, **before** route handler. It **narrows** the dataset; it does not replace formula-level RBAC checks on `:formulaId` paths.

---

## 6. Domain filtering rules

All rules assume `mode: 'company'` and `companyId = active_company_id`. When `mode: 'all'` (`SUPER_ADMIN` only), domain filters below are **not applied** unless a specific `X-Company-Id` is also sent.

| Domain | Filter rule |
|--------|-------------|
| **Formula** | `∃ formula_participants P WHERE P.formula_id = formulas.id AND P.company_id = active_company_id` |
| **Participant** | Formula participant rows where `company_id = active_company_id` (or formula in scoped formula set) |
| **Payment** | Resolve `formula_id` → Formula filter |
| **Invoice** | Resolve `formula_id` → Formula filter |
| **Logistics** | Resolve `formula_id` → Formula filter |
| **Settlement** | Resolve `formula_id` → Formula filter |
| **Share** | Resolve `formula_id` → Formula filter |
| **Version** | Resolve `formula_id` → Formula filter |
| **Close / Cancel** | Target formula must pass Formula filter |
| **Dashboard / KPI** | Aggregate only formulas matching Formula filter for `active_company_id` |
| **Company** | `companies.id = active_company_id` OR list limited to caller's active memberships ∩ `{ active_company_id }` |

### 6.1 List endpoints

| Route | Scoped behavior |
|-------|-----------------|
| `GET /api/v1/formulas` | Formulas with ≥1 participant for `active_company_id` |
| `GET /api/v1/companies` | Single company when scoped; membership list when resolving switcher options |
| `GET /api/v1/payments/unmatched` | Unmatched records whose formula passes Formula filter |

### 6.2 Mutations

Create/update/delete on `:formulaId` and child resources require target formula to satisfy Formula filter for `active_company_id`. Out-of-scope target → **404** `NOT_FOUND` (enumeration-safe).

---

## 7. Frontend contract (design only)

| UI element | Behavior |
|------------|----------|
| **Header Company Switcher** | Sets global `active_company_id`; persists to session storage / app store |
| **All menus** | Attach `X-Company-Id` (or `X-Company-Scope: all` for `SUPER_ADMIN`) on every business API call |
| **Dashboard** | Uses same global context — **no separate Dashboard-only company filter** |
| **Forbidden** | Per-page `?company_id=` query params for routine list/read |

See [`NAVIGATION_ARCHITECTURE.md`](./NAVIGATION_ARCHITECTURE.md) and [`DASHBOARD_V1_SPEC.md`](./DASHBOARD_V1_SPEC.md).

---

## 8. HTTP status mapping

| Condition | HTTP | Code |
|-----------|------|------|
| Missing company context on business route | 400 | `COMPANY_CONTEXT_REQUIRED` |
| Non–`SUPER_ADMIN` sends `X-Company-Scope: all` | 403 | `FORBIDDEN` |
| `X-Company-Id` not in caller memberships | 403 | `FORBIDDEN` |
| Resource outside active company scope | 404 | `NOT_FOUND` |
| Valid scoped request | 200 / 201 / … | — |

---

## 9. Relationship to v1.3 auth (DL-046 / DL-049)

| v1.3 (shipped) | v1.4+ (this policy) |
|----------------|---------------------|
| `request.auth` + JWT | Unchanged |
| `requireRole`, `requireCompanyScope`, `requireFormulaScope` on routes | Extended by global list filtering |
| Membership-based formula access | Further narrowed by **active** company header |
| `SUPER_ADMIN` bypass on route scope | Explicit `all` vs `company` header modes |

v1.3 route guards remain. Global company context adds **mandatory active company** for non-admin users and **consistent list aggregation** across menus.

---

## 10. Explicit non-goals (this milestone)

| Non-goal | Notes |
|----------|-------|
| Backend middleware implementation | ✅ v1.4.1 — `registerCompanyContext`, header parsing |
| Service-layer list filtering | Next milestone |
| Product UI / Header Switcher component | Next milestone |
| DB schema changes | Forbidden |
| Per-menu `company_id` query params | Forbidden |
| Frontend-only filtering | Forbidden |
| Dashboard-only company filter | Forbidden |

---

## 11. Implementation gate

- ✅ v1.4.1 — `companyContext` middleware registered after authentication (`src/http/plugins/company-context.ts`).
- Service-layer list filters accept `CompanyContext` parameter — **next milestone**.
- Integration tests: company context middleware suite; existing **308+** baseline preserved.
- Future: missing header on business route → 400 `COMPANY_CONTEXT_REQUIRED` when Service filters land.

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-30 | v1.4.0 — Global Company Context Policy (DL-050); documentation only |
| 2026-06-30 | v1.4.1 — Company context middleware implemented; Service filtering deferred |
