# TOCS RBAC Permission Matrix

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.3.4 (Matrix — documentation only) |
| **Status** | ACCEPTED (DL-045) |
| **Implementation** | **Not started** — no middleware, route metadata, or `RbacService` code |

**Related:** [`AUTH_RBAC_SPEC.md`](./AUTH_RBAC_SPEC.md), [`AUTH_DB_SCHEMA.md`](./AUTH_DB_SCHEMA.md), [`../architecture/AUTH_ARCHITECTURE.md`](../architecture/AUTH_ARCHITECTURE.md)

**Decision:** DL-045 — RBAC Permission Matrix (ACCEPTED)

**Supersedes:** v1.3.0 provisional matrix in [`AUTH_RBAC_SPEC.md`](./AUTH_RBAC_SPEC.md) §5 (`SYSTEM_ADMIN`, `OPS_MANAGER`, …) — **membership roles** below are canonical for implementation.

---

## 1. Overview

This document is the **authoritative permission matrix** for TOCS Auth/RBAC before middleware implementation. It defines:

1. **Roles** — stored on `company_memberships.role` (DL-042)  
2. **Resource domains** — aligned with Core MVP API areas  
3. **Actions** — normalized permission verbs  
4. **Company scope** — how row access is constrained  
5. **Sensitive operations** — minimum role floor  

Default policy: **explicit deny**. A request is allowed only when the caller’s **effective role** for the relevant company grants the required `{resource}:{action}` **and** company scope passes.

---

## 2. Roles

| Role | Code | Scope | Summary |
|------|------|-------|---------|
| **Super Admin** | `SUPER_ADMIN` | **Global** — no company filter | Platform operator; all resources and actions |
| **Company Admin** | `COMPANY_ADMIN` | Single company via membership | Full operational control within assigned company(ies) |
| **Manager** | `MANAGER` | Single company via membership | Day-to-day trade operations; no sensitive lifecycle actions |
| **Viewer** | `VIEWER` | Single company via membership | Read-only within assigned company(ies) |

A user may hold **different roles on different companies**. JWT `memberships` claim carries `{ company_id, role }[]`; `RbacService` evaluates the role matching the **target company context** of the request.

---

## 3. Resource domains

| Resource code | Domain | Example API areas |
|---------------|--------|-------------------|
| `formula` | Formula | Create, list, get, PATCH metadata, status read |
| `company` | Company | Register, list, get |
| `participant` | Participant | Formula participants CRUD |
| `payment` | Payment | Schedules, records, record cancel |
| `invoice` | Invoice | Invoice CRUD, status |
| `logistics` | Logistics | Logistics CRUD, logistics-status |
| `share` | Share | Share CRUD (version-triggering) |
| `version` | Version | Version create, list, read, latest |
| `close` | Close | Formula close execute |
| `cancel` | Cancel | Formula cancel execute |
| `settlement` | Settlement | Payment-schedule append, settlement notes |
| `dashboard` | Dashboard / KPI | Receivable-payable, confirmed/expected KPI, participant KPI, unmatched payments |
| `membership` | Membership / users | Company membership assign, role change (future admin APIs) |
| `session` | Session / auth admin | Logout all devices for user (future) |

**Public (no RBAC):** `GET /api/v1/health`

**Not a resource:** `formula_participants.role_group` — business trade role only; never used as API permission source (DL-004).

---

## 4. Permission actions

| Action | Code | Typical HTTP mapping |
|--------|------|----------------------|
| Read | `read` | GET, list |
| Create | `create` | POST (new entity) |
| Update | `update` | PATCH, PUT, status transitions |
| Delete | `delete` | DELETE |
| Approve | `approve` | Approval step ( **deferred** — reserved; no grant in MVP ) |
| Cancel | `cancel` | Domain cancel (formula cancel, payment record cancel) |
| Close | `close` | Formula close |
| Settle | `settle` | Settlement schedule append, settlement note write |
| Admin | `admin` | Membership management, session revoke-all, company update |

**Permission key format:** `{resource}:{action}` (lowercase), e.g. `formula:read`, `close:close`, `settlement:settle`.

**Composite route rule (implementation):** Map each HTTP route to **one primary** permission key. Business guards (closed formula, version trigger) remain in Service layer after RBAC passes.

---

## 5. Baseline role policy

### 5.1 SUPER_ADMIN

| Policy | Value |
|--------|-------|
| Resources | **All** §3 domains |
| Actions | **All** §4 actions (including `approve` when implemented) |
| Company scope | **None** — may access any company and any formula |
| Membership row | May exist on internal org company; role check short-circuits to allow |

### 5.2 COMPANY_ADMIN

| Policy | Value |
|--------|-------|
| Scope | **Company-scoped** — only companies where active `company_memberships.role = COMPANY_ADMIN` |
| Operations | **Most mutations** within scope, including sensitive §7 operations |
| Close / Cancel / Settlement | **Allowed** within company scope |
| Membership | **Allowed** — `membership:admin` within same company |
| Company update | **Allowed** — `company:update` for member companies |
| Session revoke all | **Allowed** — `session:admin` for users in scope (future API) |

### 5.3 MANAGER

| Policy | Value |
|--------|-------|
| Scope | **Company-scoped** — active `MANAGER` membership |
| Trade operations | **Allowed:** formula, participant, payment, invoice, logistics, share, version — **create / update / read** (and share **delete**) |
| Sensitive lifecycle | **Denied:** formula cancel, formula close, settlement write, membership admin, company update, session revoke-all |
| Payment record cancel | **Denied** — `payment:cancel` requires `COMPANY_ADMIN`+ (confirmed KPI impact) |
| Approval | **`approve` not granted** — approval workflow deferred (§10); sensitive ops blocked outright, not queued |

### 5.4 VIEWER

| Policy | Value |
|--------|-------|
| Scope | **Company-scoped** — active `VIEWER` membership |
| Read | **Allowed** — `*:read` on §3 domains except `membership` and `session` admin surfaces |
| Dashboard / KPI | **Read only** — `dashboard:read` with mandatory company filter |
| Mutations | **All denied** — create, update, delete, cancel, close, settle, admin |

---

## 6. Permission matrix (company-scoped roles)

**Legend:** ✓ = granted within company scope, — = denied, ◐ = read only, **S** = sensitive (§7; `COMPANY_ADMIN` minimum)

Scope column applies to `COMPANY_ADMIN`, `MANAGER`, `VIEWER`. `SUPER_ADMIN` = ✓ for all cells regardless of scope.

### 6.1 Formula & lifecycle

| Permission | SUPER_ADMIN | COMPANY_ADMIN | MANAGER | VIEWER |
|------------|:-----------:|:-------------:|:-------:|:------:|
| `formula:read` | ✓ | ✓ | ✓ | ✓ |
| `formula:create` | ✓ | ✓ | ✓ | — |
| `formula:update` | ✓ | ✓ | ✓ | — |
| `formula:delete` | ✓ | — | — | — |
| `cancel:cancel` | ✓ | ✓ **S** | — | — |
| `close:close` | ✓ | ✓ **S** | — | — |

### 6.2 Company & membership

| Permission | SUPER_ADMIN | COMPANY_ADMIN | MANAGER | VIEWER |
|------------|:-----------:|:-------------:|:-------:|:------:|
| `company:read` | ✓ | ✓ | ✓ | ✓ |
| `company:create` | ✓ | ✓ | — | — |
| `company:update` | ✓ | ✓ **S** | — | — |
| `membership:read` | ✓ | ✓ | ◐ | — |
| `membership:admin` | ✓ | ✓ **S** | — | — |

### 6.3 Operational domains

| Permission | SUPER_ADMIN | COMPANY_ADMIN | MANAGER | VIEWER |
|------------|:-----------:|:-------------:|:-------:|:------:|
| `participant:read` | ✓ | ✓ | ✓ | ✓ |
| `participant:create` | ✓ | ✓ | ✓ | — |
| `participant:update` | ✓ | ✓ | ✓ | — |
| `participant:delete` | ✓ | ✓ | — | — |
| `payment:read` | ✓ | ✓ | ✓ | ✓ |
| `payment:create` | ✓ | ✓ | ✓ | — |
| `payment:update` | ✓ | ✓ | ✓ | — |
| `payment:cancel` | ✓ | ✓ | — | — |
| `invoice:read` | ✓ | ✓ | ✓ | ✓ |
| `invoice:create` | ✓ | ✓ | ✓ | — |
| `invoice:update` | ✓ | ✓ | ✓ | — |
| `invoice:delete` | ✓ | ✓ | — | — |
| `logistics:read` | ✓ | ✓ | ✓ | ✓ |
| `logistics:create` | ✓ | ✓ | ✓ | — |
| `logistics:update` | ✓ | ✓ | ✓ | — |
| `logistics:delete` | ✓ | ✓ | — | — |
| `share:read` | ✓ | ✓ | ✓ | ✓ |
| `share:create` | ✓ | ✓ | ✓ | — |
| `share:update` | ✓ | ✓ | ✓ | — |
| `share:delete` | ✓ | ✓ | ✓ | — |
| `version:read` | ✓ | ✓ | ✓ | ✓ |
| `version:create` | ✓ | ✓ | ✓ | — |

### 6.4 Settlement & dashboard

| Permission | SUPER_ADMIN | COMPANY_ADMIN | MANAGER | VIEWER |
|------------|:-----------:|:-------------:|:-------:|:------:|
| `settlement:read` | ✓ | ✓ | ✓ | ✓ |
| `settlement:settle` | ✓ | ✓ **S** | — | — |
| `dashboard:read` | ✓ | ✓ | ✓ | ✓ |

### 6.5 Session / auth admin

| Permission | SUPER_ADMIN | COMPANY_ADMIN | MANAGER | VIEWER |
|------------|:-----------:|:-------------:|:-------:|:------:|
| `session:admin` (revoke all) | ✓ | ✓ **S** | — | — |
| `auth:read` (me, sessions self) | ✓ | ✓ | ✓ | ✓ |

---

## 7. Sensitive operations

Minimum role: **`COMPANY_ADMIN`** (or `SUPER_ADMIN`). `MANAGER` and `VIEWER` receive **403 FORBIDDEN** even within company scope.

| Operation | Permission key | Notes |
|-----------|----------------|-------|
| Formula cancel | `cancel:cancel` | Irreversible lifecycle; audit required |
| Formula close | `close:close` | Closure gate; high privilege |
| Settlement note write | `settlement:settle` | Includes settlement notes POST |
| Settlement schedule append | `settlement:settle` | Post-close payment schedule append |
| Membership assign / role change | `membership:admin` | Future admin APIs |
| Company update | `company:update` | PATCH company metadata |
| Session revoke all (user) | `session:admin` | Logout all devices for target user |

**MVP note:** No approval workflow — sensitive ops are **hard deny** for `MANAGER`, not “pending approval”. `approve` action reserved for V2.

---

## 8. Company scope rules

### 8.1 General rule

| Role | Scope behavior |
|------|----------------|
| `SUPER_ADMIN` | Skip company membership check |
| `COMPANY_ADMIN`, `MANAGER`, `VIEWER` | Must have **active** `company_memberships` row (`is_active = TRUE`) for the **context company** with sufficient role |

### 8.2 Resolving context company

| Request pattern | Context company derivation |
|-----------------|----------------------------|
| `/api/v1/companies/:companyId` | Path `companyId` |
| `/api/v1/formulas/:formulaId/...` | Load formula → ∃ `formula_participants` where `company_id ∈ user’s membership companies` |
| `/api/v1/participants/:participantId` | Participant → formula → same rule |
| `/api/v1/payments/unmatched` | Query/filter **must** include allowed `company_id` set; default deny if unfiltered global leak |
| List endpoints (`/formulas`, `/companies`) | Result set filtered to intersection of data and membership companies |

### 8.3 Formula access path

```
User memberships (company_id set)
        │
        ▼
Formula F accessible iff ∃ formula_participants P
        WHERE P.formula_id = F.id
          AND P.company_id ∈ user membership companies
```

**RBAC + scope:** Permission grant **and** formula-company linkage required. Missing linkage → **404 NOT_FOUND** (prefer over 403 to avoid enumeration).

### 8.4 Dashboard / KPI

| Rule | Policy |
|------|--------|
| `dashboard:read` | Requires company scope on underlying formula or explicit `company_id` filter |
| Cross-company aggregate | **Denied** for non–`SUPER_ADMIN` |
| KPI views | Same formula access path as §8.3 |

### 8.5 Multi-company users

When a user holds memberships on companies A and B:

- Role may differ per company (e.g. `MANAGER` on A, `VIEWER` on B).
- Evaluate **role for the resolved context company only**.
- JWT carries all memberships; middleware/`RbacService` selects matching entry.

---

## 9. HTTP status mapping

| Condition | HTTP | Code (target envelope) |
|-----------|------|------------------------|
| No / invalid token | 401 | `UNAUTHORIZED` |
| Valid token, insufficient permission | 403 | `FORBIDDEN` |
| Valid token, permission OK, object outside company scope | 404 | `NOT_FOUND` |
| Valid token, permission OK, object not found | 404 | `NOT_FOUND` |

---

## 10. Route → permission mapping (reference)

Implementation milestone registers these on route metadata. Illustrative — not exhaustive.

| Method | Route pattern | Permission |
|--------|---------------|------------|
| GET | `/api/v1/formulas` | `formula:read` |
| POST | `/api/v1/formulas` | `formula:create` |
| GET | `/api/v1/formulas/:formulaId` | `formula:read` |
| PATCH | `/api/v1/formulas/:formulaId` | `formula:update` |
| POST | `/api/v1/formulas/:formulaId/cancel` | `cancel:cancel` |
| POST | `/api/v1/formulas/:formulaId/close` | `close:close` |
| POST | `/api/v1/companies` | `company:create` |
| GET | `/api/v1/companies` | `company:read` |
| GET | `/api/v1/companies/:companyId` | `company:read` |
| POST | `/api/v1/formulas/:formulaId/participants` | `participant:create` |
| GET | `/api/v1/formulas/:formulaId/participants` | `participant:read` |
| POST | `/api/v1/formulas/:formulaId/payment-records` | `payment:create` |
| POST | `/api/v1/payment-records/:recordId/cancel` | `payment:cancel` |
| POST | `/api/v1/formulas/:formulaId/versions` | `version:create` |
| POST | `/api/v1/formulas/:formulaId/settlement/notes` | `settlement:settle` |
| POST | `/api/v1/formulas/:formulaId/settlement/payment-schedules` | `settlement:settle` |
| GET | `/api/v1/formulas/:formulaId/kpi/*` | `dashboard:read` |
| GET | `/api/v1/payments/unmatched` | `dashboard:read` |

---

## 11. Deferred scope

Not in v1.3.4 matrix implementation:

| Item | Notes |
|------|-------|
| ABAC | Attribute-based conditions beyond company scope |
| Custom permission builder | UI-driven grant editor |
| PostgreSQL RLS | Prefer Service + RBAC near-term |
| Approval workflow | `approve` action; MANAGER escalation path |
| Delegated admin | Acting-on-behalf of another user |
| External auditor role | Read-only cross-company audit persona |
| Fine-grained formula ACL | Per-`formula_id` grants |
| Service accounts | Machine credentials (V2) |

---

## 12. Implementation gate

- No middleware, route metadata, or `RbacService` code in v1.3.4.
- No `db/schema/*.sql` or `schema.prisma` changes.
- Integration suite **212/212** unchanged until auth enforcement milestone.

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-23 | v1.3.4 — RBAC permission matrix (DL-045); documentation only |
