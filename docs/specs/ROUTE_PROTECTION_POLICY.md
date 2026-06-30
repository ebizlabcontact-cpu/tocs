# TOCS Route Protection Policy

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.4.0 supplement (Policy — documentation only) |
| **Status** | ACCEPTED (DL-046; extended by DL-050) |
| **Implementation** | v1.3 auth/RBAC/route guards **shipped** (DL-049); global company context middleware **not started** |

**Related:** [`AUTH_RBAC_SPEC.md`](./AUTH_RBAC_SPEC.md), [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md), [`GLOBAL_COMPANY_CONTEXT_POLICY.md`](./GLOBAL_COMPANY_CONTEXT_POLICY.md), [`AUTH_TOKEN_SESSION_STRATEGY.md`](./AUTH_TOKEN_SESSION_STRATEGY.md), [`../architecture/AUTH_ARCHITECTURE.md`](../architecture/AUTH_ARCHITECTURE.md), [`../api/API_MVP_SCOPE.md`](../api/API_MVP_SCOPE.md)

**Decisions:** DL-046 — Route Protection Policy (ACCEPTED); DL-050 — Global Company Context Policy (ACCEPTED)

---

## 1. Overview

This document defines **authentication and authorization policy** for all **48** Core MVP HTTP routes registered today. It is the implementation checklist for future auth/RBAC middleware — **no route or middleware code changes** in v1.3.5.

**Evaluation order (middleware — v1.3 shipped; global context v1.4+):**

```
Request
  → PUBLIC? → allow
  → AUTHENTICATED (valid JWT, ACTIVE user) → request.auth
  → RBAC (minimum role + permission key)
  → GLOBAL COMPANY CONTEXT (DL-050) → request.companyContext
  → COMPANY_SCOPED (membership + formula/company linkage)
  → SUPER_ADMIN_ONLY? (if applicable)
  → Route handler
```

Global company context is defined in [`GLOBAL_COMPANY_CONTEXT_POLICY.md`](./GLOBAL_COMPANY_CONTEXT_POLICY.md). It runs **after** RBAC and **narrows** list/read datasets to the active company (or `all` for `SUPER_ADMIN`).

Permission keys and role floors align with [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md) (DL-045).

---

## 2. Protection levels

| Level | Code | Meaning |
|-------|------|---------|
| **Public** | `PUBLIC` | No authentication; no RBAC |
| **Authenticated** | `AUTHENTICATED` | Valid access JWT; user `status = ACTIVE` |
| **RBAC** | `RBAC` | Caller role ≥ minimum role; permission key granted |
| **Company scoped** | `COMPANY_SCOPED` | Non–`SUPER_ADMIN` must pass company/formula scope rules (§6) |
| **Super admin only** | `SUPER_ADMIN_ONLY` | Only `SUPER_ADMIN` membership (none of the 48 MVP routes use this exclusively) |

**Typical business route stack:** `AUTHENTICATED` + `RBAC` + `COMPANY_SCOPED`.

**Role hierarchy (minimum role comparisons):**

```
VIEWER  <  MANAGER  <  COMPANY_ADMIN  <  SUPER_ADMIN
```

---

## 3. Public routes

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/v1/health` | Liveness/readiness; permanently public |

**All other 47 routes** require authentication in production when `AUTH_ENFORCE=true`.

---

## 4. Domain protection summary

### 4.1 Formula

| Operation | Minimum role | Sensitive | Notes |
|-----------|:------------:|:---------:|-------|
| Create | `MANAGER` | — | Requires active membership; formula scope established at participant link |
| Read / list / status | `VIEWER` | — | List filtered to accessible formulas |
| Update (PATCH metadata) | `MANAGER` | — | Version-triggering fields rejected by Service (unchanged) |
| Cancel | `COMPANY_ADMIN` | **Yes** | `MANAGER` **denied**; irreversible lifecycle |
| Close | `COMPANY_ADMIN` | **Yes** | Separate route; see Close domain |

**Policy note:** Create/update require **`MANAGER`+**; cancel/close require **`COMPANY_ADMIN`+** (recommended floor per DL-045).

### 4.2 Payment

| Operation | Minimum role | Sensitive | Notes |
|-----------|:------------:|:---------:|-------|
| Schedule create / list / get | `MANAGER` / `VIEWER` | — | Create: `MANAGER`+ |
| Record create / list / get | `MANAGER` / `VIEWER` | — | Create: `MANAGER`+ |
| Record cancel (PATCH) | `COMPANY_ADMIN` | **Yes** | Confirmed KPI impact; `MANAGER` **denied** |

### 4.3 Invoice

| Operation | Minimum role | Notes |
|-----------|:------------|-------|
| Create | `MANAGER` | |
| List / get / status read | `VIEWER` | Includes derived invoice status read |
| Status update (PATCH) | `MANAGER` | |

### 4.4 Logistics

| Operation | Minimum role | Notes |
|-----------|:------------|-------|
| Create | `MANAGER` | |
| List / get | `VIEWER` | |
| Status update (PATCH) | `MANAGER` | |

### 4.5 Share

| Operation | Minimum role | Notes |
|-----------|:------------|-------|
| Create / update / delete | `MANAGER` | Version-triggering; Service rules unchanged |
| List / get | `VIEWER` | |

### 4.6 Version

| Operation | Minimum role | Notes |
|-----------|:------------|-------|
| Create (incl. internal retry) | `MANAGER` | Single HTTP POST; retry is Service-internal |
| List / get / latest / by version_no / by UUID | `VIEWER` | |

### 4.7 Close

| Operation | Minimum role | Sensitive |
|-----------|:------------|:---------|
| Execute close | `COMPANY_ADMIN` | **Yes** |

### 4.8 Settlement

| Operation | Minimum role | Sensitive | Notes |
|-----------|:------------:|:---------:|-------|
| Read (derived via formula/payment views) | `VIEWER` | — | No dedicated settlement GET in 48 routes |
| Payment-schedule append (POST) | `COMPANY_ADMIN` | **Yes** | Post-close path |
| Settlement note (POST) | `COMPANY_ADMIN` | **Yes** | |

### 4.9 Dashboard / KPI

| Operation | Minimum role | Scope |
|-----------|:------------|-------|
| All GET KPI / receivable-payable / unmatched | `VIEWER` | **Company filter mandatory** for list-style endpoints |

### 4.10 Company

| Operation | Minimum role | Notes |
|-----------|:------------|-------|
| Create (POST) | `COMPANY_ADMIN` | Or `SUPER_ADMIN`; no MVP PATCH route |
| List / get | `VIEWER` | Within membership company set |

### 4.11 Participant

| Operation | Minimum role | Notes |
|-----------|:------------|-------|
| Create | `MANAGER` | |
| List / get | `VIEWER` | |

---

## 5. Sensitive operations (COMPANY_ADMIN+)

These routes **must reject `MANAGER` and `VIEWER`** even when company scope passes:

| Route | Permission |
|-------|------------|
| `POST /api/v1/formulas/:formulaId/cancel` | `cancel:cancel` |
| `POST /api/v1/formulas/:formulaId/close` | `close:close` |
| `POST /api/v1/formulas/:formulaId/settlement/payment-schedules` | `settlement:settle` |
| `POST /api/v1/formulas/:formulaId/settlement/notes` | `settlement:settle` |
| `PATCH /api/v1/payment-records/:recordId/cancel` | `payment:cancel` |
| `POST /api/v1/companies` | `company:create` |

Future (not in 48 routes): membership admin, company update, session revoke-all — same floor.

---

## 6. Company scope rules

### 6.0 Global company context (DL-050)

Header Company Switcher establishes **Global Company Context** for all business menus — not Dashboard-only.

```typescript
request.companyContext = {
  mode: 'company' | 'all',
  companyId: string | null,
};
```

| Header | Who | Effect |
|--------|-----|--------|
| `X-Company-Id: <uuid>` | All users in company mode | Active company; required for non–`SUPER_ADMIN` business requests |
| `X-Company-Scope: all` | **`SUPER_ADMIN` only** | Platform-wide scope; forbidden for other roles → **403** |

**Rules:**

1. Non–`SUPER_ADMIN` cannot query business data without `X-Company-Id` and active membership for that company.
2. List/read filters use `active_company_id` (see §6.5–§6.7) — **not** per-menu `?company_id=` query params.
3. Backend must enforce scope; Frontend-only filtering is forbidden.
4. Exempt from company headers: health, login, refresh, logout, `GET /auth/me`.

Full policy: [`GLOBAL_COMPANY_CONTEXT_POLICY.md`](./GLOBAL_COMPANY_CONTEXT_POLICY.md).

### 6.1 SUPER_ADMIN bypass

`SUPER_ADMIN` skips membership and formula-participant checks when `mode = 'all'`. With `X-Company-Id`, behaves as company-scoped operator. All 48 routes allowed if RBAC permission granted.

### 6.2 Active membership required

`COMPANY_ADMIN`, `MANAGER`, `VIEWER` must have `company_memberships.is_active = TRUE` for the **context company** (`X-Company-Id`).

### 6.3 Formula-scoped routes

For paths under `/api/v1/formulas/:formulaId/...` and indirect IDs (participant, invoice, payment, share, logistics, version):

```
Accessible iff ∃ formula_participants P
  WHERE P.formula_id = :formulaId
    AND P.company_id = active_company_id   // when mode = 'company'
    AND P.company_id ∈ caller membership companies
```

When `mode = 'all'` (`SUPER_ADMIN`), formula participant membership filter is not applied unless `X-Company-Id` is also set.

Resolve child resources (e.g. `/payment-records/:recordId`) → formula → same rule.

**Out of scope:** **404 NOT_FOUND** (not 403) to avoid enumeration.

### 6.4 Company-scoped routes

| Pattern | Rule |
|---------|------|
| `GET /api/v1/companies/:companyId` | `companyId = active_company_id` (company mode) or membership check |
| `GET /api/v1/companies` | Active membership company only when scoped; switcher options from `/auth/me` |
| `POST /api/v1/companies` | Caller `COMPANY_ADMIN`+; new company linked via future membership grant or bootstrap policy |

### 6.5 Formula create / list

| Route | Scope rule |
|-------|------------|
| `POST /api/v1/formulas` | Caller must have ≥1 active membership; `X-Company-Id` required (non-admin) |
| `GET /api/v1/formulas` | Formulas with ≥1 participant where `company_id = active_company_id` |
| `GET /api/v1/formulas/by-formula-no/:formulaNo` | Same as formula get after lookup |

### 6.6 Child domains (formula_id scope)

Payment, Invoice, Logistics, Settlement, Share, Version, Participant — resolve `formula_id` and apply §6.3 Formula filter for `active_company_id`.

### 6.7 Dashboard / KPI (global context — not Dashboard-only)

Dashboard uses the **same** global company context as all other menus ([`DASHBOARD_V1_SPEC.md`](./DASHBOARD_V1_SPEC.md)).

| Route | Scope rule |
|-------|------------|
| `GET .../formulas/:formulaId/kpi/*` | Formula scope §6.3 + `active_company_id` |
| `GET .../formulas/:formulaId/receivable-payable` | Formula scope §6.3 + `active_company_id` |
| `GET /api/v1/payments/unmatched` | Unmatched records whose formula passes §6.3 for `active_company_id`; no Dashboard-only filter |

---

## 7. Route registry (48 routes)

**Columns:** `#` · Method · Path · Domain · Protection levels · Min role · Permission key · Scope rule

| # | Method | Path | Domain | Protection | Min role | Permission | Scope |
|---|--------|------|--------|------------|----------|------------|-------|
| 1 | GET | `/api/v1/health` | Health | `PUBLIC` | — | — | — |
| 2 | POST | `/api/v1/formulas` | Formula | AUTH · RBAC · COMPANY | `MANAGER` | `formula:create` | Active membership |
| 3 | GET | `/api/v1/formulas` | Formula | AUTH · RBAC · COMPANY | `VIEWER` | `formula:read` | Filter by participant companies |
| 4 | GET | `/api/v1/formulas/by-formula-no/:formulaNo` | Formula | AUTH · RBAC · COMPANY | `VIEWER` | `formula:read` | Formula participant companies |
| 5 | GET | `/api/v1/formulas/:formulaId` | Formula | AUTH · RBAC · COMPANY | `VIEWER` | `formula:read` | §6.3 |
| 6 | PATCH | `/api/v1/formulas/:formulaId` | Formula | AUTH · RBAC · COMPANY | `MANAGER` | `formula:update` | §6.3 |
| 7 | GET | `/api/v1/formulas/:formulaId/status` | Formula | AUTH · RBAC · COMPANY | `VIEWER` | `formula:read` | §6.3 |
| 8 | POST | `/api/v1/formulas/:formulaId/cancel` | Cancel | AUTH · RBAC · COMPANY | `COMPANY_ADMIN` | `cancel:cancel` | §6.3 · **S** |
| 9 | POST | `/api/v1/formulas/:formulaId/payment-schedules` | Payment | AUTH · RBAC · COMPANY | `MANAGER` | `payment:create` | §6.3 |
| 10 | GET | `/api/v1/formulas/:formulaId/payment-schedules` | Payment | AUTH · RBAC · COMPANY | `VIEWER` | `payment:read` | §6.3 |
| 11 | GET | `/api/v1/payment-schedules/:scheduleId` | Payment | AUTH · RBAC · COMPANY | `VIEWER` | `payment:read` | Schedule → formula §6.3 |
| 12 | POST | `/api/v1/formulas/:formulaId/payment-records` | Payment | AUTH · RBAC · COMPANY | `MANAGER` | `payment:create` | §6.3 |
| 13 | GET | `/api/v1/formulas/:formulaId/payment-records` | Payment | AUTH · RBAC · COMPANY | `VIEWER` | `payment:read` | §6.3 |
| 14 | GET | `/api/v1/payment-records/:recordId` | Payment | AUTH · RBAC · COMPANY | `VIEWER` | `payment:read` | Record → formula §6.3 |
| 15 | PATCH | `/api/v1/payment-records/:recordId/cancel` | Payment | AUTH · RBAC · COMPANY | `COMPANY_ADMIN` | `payment:cancel` | Record → formula §6.3 · **S** |
| 16 | POST | `/api/v1/formulas/:formulaId/close` | Close | AUTH · RBAC · COMPANY | `COMPANY_ADMIN` | `close:close` | §6.3 · **S** |
| 17 | GET | `/api/v1/formulas/:formulaId/receivable-payable` | Dashboard | AUTH · RBAC · COMPANY | `VIEWER` | `dashboard:read` | §6.3 |
| 18 | GET | `/api/v1/formulas/:formulaId/kpi/confirmed` | Dashboard | AUTH · RBAC · COMPANY | `VIEWER` | `dashboard:read` | §6.3 |
| 19 | GET | `/api/v1/formulas/:formulaId/kpi/expected` | Dashboard | AUTH · RBAC · COMPANY | `VIEWER` | `dashboard:read` | §6.3 |
| 20 | GET | `/api/v1/formulas/:formulaId/kpi/participants` | Dashboard | AUTH · RBAC · COMPANY | `VIEWER` | `dashboard:read` | §6.3 |
| 21 | GET | `/api/v1/payments/unmatched` | Dashboard | AUTH · RBAC · COMPANY · **CTX** | `VIEWER` | `dashboard:read` | §6.7 global context |
| 22 | POST | `/api/v1/formulas/:formulaId/invoices` | Invoice | AUTH · RBAC · COMPANY | `MANAGER` | `invoice:create` | §6.3 |
| 23 | GET | `/api/v1/formulas/:formulaId/invoices/status` | Invoice | AUTH · RBAC · COMPANY | `VIEWER` | `invoice:read` | §6.3 |
| 24 | GET | `/api/v1/formulas/:formulaId/invoices` | Invoice | AUTH · RBAC · COMPANY | `VIEWER` | `invoice:read` | §6.3 |
| 25 | GET | `/api/v1/invoices/:invoiceId` | Invoice | AUTH · RBAC · COMPANY | `VIEWER` | `invoice:read` | Invoice → formula §6.3 |
| 26 | PATCH | `/api/v1/invoices/:invoiceId/status` | Invoice | AUTH · RBAC · COMPANY | `MANAGER` | `invoice:update` | Invoice → formula §6.3 |
| 27 | POST | `/api/v1/formulas/:formulaId/versions` | Version | AUTH · RBAC · COMPANY | `MANAGER` | `version:create` | §6.3 |
| 28 | GET | `/api/v1/formulas/:formulaId/versions/latest` | Version | AUTH · RBAC · COMPANY | `VIEWER` | `version:read` | §6.3 |
| 29 | GET | `/api/v1/formulas/:formulaId/versions/:versionNo` | Version | AUTH · RBAC · COMPANY | `VIEWER` | `version:read` | §6.3 |
| 30 | GET | `/api/v1/formulas/:formulaId/versions` | Version | AUTH · RBAC · COMPANY | `VIEWER` | `version:read` | §6.3 |
| 31 | GET | `/api/v1/versions/:versionId` | Version | AUTH · RBAC · COMPANY | `VIEWER` | `version:read` | Version → formula §6.3 |
| 32 | POST | `/api/v1/formulas/:formulaId/shares` | Share | AUTH · RBAC · COMPANY | `MANAGER` | `share:create` | §6.3 |
| 33 | GET | `/api/v1/formulas/:formulaId/shares` | Share | AUTH · RBAC · COMPANY | `VIEWER` | `share:read` | §6.3 |
| 34 | GET | `/api/v1/shares/:shareId` | Share | AUTH · RBAC · COMPANY | `VIEWER` | `share:read` | Share → formula §6.3 |
| 35 | PATCH | `/api/v1/shares/:shareId` | Share | AUTH · RBAC · COMPANY | `MANAGER` | `share:update` | Share → formula §6.3 |
| 36 | DELETE | `/api/v1/shares/:shareId` | Share | AUTH · RBAC · COMPANY | `MANAGER` | `share:delete` | Share → formula §6.3 |
| 37 | POST | `/api/v1/formulas/:formulaId/settlement/payment-schedules` | Settlement | AUTH · RBAC · COMPANY | `COMPANY_ADMIN` | `settlement:settle` | §6.3 · **S** |
| 38 | POST | `/api/v1/formulas/:formulaId/settlement/notes` | Settlement | AUTH · RBAC · COMPANY | `COMPANY_ADMIN` | `settlement:settle` | §6.3 · **S** |
| 39 | POST | `/api/v1/companies` | Company | AUTH · RBAC · COMPANY | `COMPANY_ADMIN` | `company:create` | **S** |
| 40 | GET | `/api/v1/companies` | Company | AUTH · RBAC · COMPANY | `VIEWER` | `company:read` | §6.4 membership filter |
| 41 | GET | `/api/v1/companies/:companyId` | Company | AUTH · RBAC · COMPANY | `VIEWER` | `company:read` | §6.4 |
| 42 | POST | `/api/v1/formulas/:formulaId/participants` | Participant | AUTH · RBAC · COMPANY | `MANAGER` | `participant:create` | §6.3 |
| 43 | GET | `/api/v1/formulas/:formulaId/participants` | Participant | AUTH · RBAC · COMPANY | `VIEWER` | `participant:read` | §6.3 |
| 44 | GET | `/api/v1/participants/:participantId` | Participant | AUTH · RBAC · COMPANY | `VIEWER` | `participant:read` | Participant → formula §6.3 |
| 45 | POST | `/api/v1/formulas/:formulaId/logistics` | Logistics | AUTH · RBAC · COMPANY | `MANAGER` | `logistics:create` | §6.3 |
| 46 | GET | `/api/v1/formulas/:formulaId/logistics` | Logistics | AUTH · RBAC · COMPANY | `VIEWER` | `logistics:read` | §6.3 |
| 47 | GET | `/api/v1/logistics/:logisticsId` | Logistics | AUTH · RBAC · COMPANY | `VIEWER` | `logistics:read` | Logistics → formula §6.3 |
| 48 | PATCH | `/api/v1/formulas/:formulaId/logistics-status` | Logistics | AUTH · RBAC · COMPANY | `MANAGER` | `logistics:update` | §6.3 |

**S** = sensitive operation (§5). **Count: 48.**

### 7.1 Domain totals

| Domain | Routes |
|--------|-------:|
| Health | 1 |
| Formula | 6 |
| Cancel | 1 |
| Payment | 7 |
| Close | 1 |
| Dashboard | 5 |
| Invoice | 5 |
| Version | 5 |
| Share | 5 |
| Settlement | 2 |
| Company | 3 |
| Participant | 3 |
| Logistics | 4 |
| **Total** | **48** |

---

## 8. HTTP status mapping

| Condition | HTTP | Code |
|-----------|------|------|
| No / invalid token on protected route | 401 | `UNAUTHORIZED` |
| Valid token, insufficient role/permission | 403 | `FORBIDDEN` |
| Valid token, scope failure (formula/company) | 404 | `NOT_FOUND` |
| Public health | 200 | — |

---

## 9. Implementation notes (future middleware)

1. Register route metadata from §7 table (central registry or per-route config).
2. `AUTH_ENFORCE=false` (dev only): log would-be denials; optional bypass — **production must be `true`**.
3. RBAC runs **before** handler; Service business guards unchanged.
4. Integration test slice: sample routes from each domain × role matrix.
5. **212/212** existing tests remain unchanged until enforcement milestone (no auth headers required until then).

---

## 10. Deferred scope

| Item | Notes |
|------|-------|
| Row-level security (PostgreSQL RLS) | Service + RBAC near-term |
| Policy engine / custom permissions | V2 |
| API keys / service accounts | V2 |
| External auditor role | V2 |
| Public share links | V2 |
| Auth routes (`login`, `refresh`, …) | Separate registry when implemented |

---

## 11. Implementation gate

- v1.3.5 — documentation only (DL-046).
- v1.3.15–v1.3.17 — auth/RBAC/route guards shipped (DL-049).
- v1.4.0 — global company context policy documented (DL-050); **no** company-context middleware, Service filters, schema, or UI in this batch.
- Future milestone: `request.companyContext` middleware; `X-Company-Id` / `X-Company-Scope` parsing; Service-layer list filters.
- Canonical route count verified against [`API_MVP_SCOPE.md`](../api/API_MVP_SCOPE.md) and `src/http/routes/*.ts`.

**CTX** = global company context header required (DL-050); extends AUTH · RBAC · COMPANY on list/aggregate routes when implemented.

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-23 | v1.3.5 — Route protection policy for 48 MVP routes (DL-046); documentation only |
| 2026-06-30 | v1.4.0 — Global company context extension (DL-050); §6.0, §6.6–§6.7; documentation only |
