# TOCS Authentication & RBAC Specification

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.3.0 (Foundation — specification only) |
| **Status** | ACCEPTED (DL-041) |
| **Implementation** | **Not started** — no DB, API, middleware, or JWT code in this milestone |

**Related:** [`../architecture/AUTH_ARCHITECTURE.md`](../architecture/AUTH_ARCHITECTURE.md), [`AUTH_TOKEN_SESSION_STRATEGY.md`](./AUTH_TOKEN_SESSION_STRATEGY.md), [`AUTH_CREDENTIAL_POLICY.md`](./AUTH_CREDENTIAL_POLICY.md), [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md), [`ROUTE_PROTECTION_POLICY.md`](./ROUTE_PROTECTION_POLICY.md), [`AUTH_DB_SCHEMA.md`](./AUTH_DB_SCHEMA.md), [`../operations/ENVIRONMENT.md`](../operations/ENVIRONMENT.md), [`../operations/ERROR_HANDLING.md`](../operations/ERROR_HANDLING.md), [`../operations/PRODUCTION_READINESS_REVIEW.md`](../operations/PRODUCTION_READINESS_REVIEW.md)

---

## 1. Authentication goals

1. **Identify callers** — Every protected API request must resolve to an authenticated **principal** (human user or future service account).
2. **Protect Core MVP routes** — 48 business routes require authentication in production; health remains public for liveness.
3. **Fail closed** — Missing, invalid, or expired credentials → **401 Unauthorized**; no silent anonymous access to business APIs.
4. **Environment-ready** — Use reserved `JWT_SECRET`, `SESSION_SECRET` (production required per `ENVIRONMENT.md`).
5. **Non-invasive to Formula First** — Authentication is a **horizontal cross-cutting concern**; it does not introduce Deal/Order entities or alter Formula business rules.
6. **Preserve layer discipline** — Auth at HTTP boundary; Action → Service → Repository unchanged in responsibility split.

---

## 2. RBAC goals

1. **Least privilege** — Grant minimum permissions required per operator function.
2. **Role-based defaults** — Permissions assigned via **membership roles** on `company_memberships` (DL-042, DL-045), not via `formula_participants.role_group` (business role ≠ API role — DL-004).
3. **Resource-oriented** — Permissions named `{resource}:{action}` aligned with API domains.
4. **Explicit deny** — Default deny; allow only via role grants.
5. **Auditable** — Auth failures and privilege denials logged with `request_id` (no secrets).
6. **Evolution path** — v1.3.x foundation supports future row-level / company-scoped policies without breaking SemVer API contracts.

---

## 3. Role definitions

Canonical matrix: [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md) (DL-045).

**Membership roles** (stored on `company_memberships.role`) apply to **API access control** only.

| Role | Code | Description |
|------|------|-------------|
| **Super Admin** | `SUPER_ADMIN` | All resources/actions; no company scope limit |
| **Company Admin** | `COMPANY_ADMIN` | Full control within assigned company(ies); sensitive ops allowed |
| **Manager** | `MANAGER` | Operational create/update within company; no cancel/close/settlement admin |
| **Viewer** | `VIEWER` | Read-only within assigned company(ies) |

### Assignment model

- One user → many **company memberships** (one row per `user_id` + `company_id`).
- Role is **per company**; JWT `memberships` claim lists active assignments.
- `RbacService` resolves effective role for the **context company** of each request.
- Service/machine accounts: deferred (V2).

### Superseded (v1.3.0 provisional)

v1.3.0 listed global roles (`SYSTEM_ADMIN`, `OPS_MANAGER`, `FINANCE`, `CLOSER`, `VIEWER`). **v1.3.4 replaces** that model with company-scoped membership roles above. Do not implement the old global role table.

---

## 4. Resource definitions

Resources map to TOCS API domains (Formula First). Permission checks are **route-level** in v1.3.0; object-level ABAC deferred.

| Resource | API scope (examples) | Notes |
|----------|----------------------|-------|
| `health` | `GET /api/v1/health` | **Public** — no auth |
| `formula` | CRUD-ish formula routes, PATCH, cancel | Core entity |
| `company` | Company register/list/get | Horizontal participant registry |
| `participant` | Formula participants | Version-triggering writes |
| `payment` | Schedules, records, cancel | Confirmed KPI sensitive |
| `invoice` | Invoice CRUD, status | Closure-related |
| `logistics` | Logistics CRUD, status | Version-triggering cost |
| `share` | Share CRUD | Version-triggering |
| `version` | Version create/read | Snapshot policy |
| `close` | Formula close | High privilege |
| `cancel` | Formula cancel | Irreversible lifecycle |
| `settlement` | Settlement schedules, notes | Post-close allowed ops |
| `dashboard` | KPI, receivable/payable, unmatched | Read-heavy; company filter required |
| `membership` | Company membership admin | Future admin APIs |
| `session` | Session revoke-all | Auth admin |
| `auth` | Login, logout, refresh, me (future) | Auth endpoints themselves |

**Not a resource:** `formula_participants.role_group` (SUPPLIER, BUYER, etc.) — business semantics inside Formula; never copied into JWT as authorization source of truth.

---

## 5. Permission matrix

Canonical detail: [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md) (DL-045).

**Actions:** `read`, `create`, `update`, `delete`, `approve` (deferred), `cancel`, `close`, `settle`, `admin`.

**Legend:** ✓ = granted within company scope, — = denied, ◐ = read-only subset, **S** = sensitive (`COMPANY_ADMIN`+)

### 5.1 Summary by role

| Role | Scope | Mutations | Sensitive ops (§7 of matrix) |
|------|-------|-----------|------------------------------|
| `SUPER_ADMIN` | Global | All | All |
| `COMPANY_ADMIN` | Company | Most domains | Allowed |
| `MANAGER` | Company | Formula, participant, payment, invoice, logistics, share, version | **Denied** |
| `VIEWER` | Company | None (read only) | **Denied** |

Full cell-level matrix: [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md) §6.

Per-route policy (48 routes): [`ROUTE_PROTECTION_POLICY.md`](./ROUTE_PROTECTION_POLICY.md) (DL-046).

### 5.2 HTTP status mapping (authorization)

| Condition | HTTP | Target `code` (error envelope milestone) |
|-----------|------|------------------------------------------|
| No / invalid token | 401 | `UNAUTHORIZED` |
| Valid token, insufficient permission | 403 | `FORBIDDEN` |
| Valid token, permission OK, outside company scope | 404 | `NOT_FOUND` |
| Valid token, resource not found | 404 | `NOT_FOUND` (existing Action behavior) |

---

## 6. Authentication flow

```
Client                          TOCS API
  |                                |
  |-- POST /api/v1/auth/login --->|  (future route)
  |    { email, password }         |  Validate credentials (AUTH_CREDENTIAL_POLICY)
  |                                |  Issue access JWT + refresh session
  |<-- 200 { access_token, ... } --|
  |    Set-Cookie: refresh (opt)   |
  |                                |
  |-- GET /api/v1/formulas ------->|
  |    Authorization: Bearer <JWT> |  Auth middleware: verify JWT
  |                                |  Attach principal to request context
  |                                |  RBAC: require formula:read
  |                                |  Route → Action → Service → Repository
  |<-- 200 JSON -------------------|
```

### v1.3.0 foundation scope

- Flow **documented**; login/refresh routes **not implemented** in this milestone.
- Existing 48 routes remain **unauthenticated** until middleware milestone (explicit follow-up).
- Integration tests (212/212) continue without auth headers until auth test slice is approved.

---

## 7. Authorization flow

```
HTTP Request
    │
    ▼
[Request logger] ── request_id
    │
    ▼
[Auth middleware] ── verify JWT → Principal { userId, roles[] }
    │                    │
    │ invalid              │ valid
    ▼                    ▼
 401 UNAUTHORIZED    [RBAC middleware]
                         │
                         │ route requires permission P
                         ▼
                    roles grant P?
                    │         │
                   yes        no
                    │         ▼
                    │      403 FORBIDDEN
                    ▼
              [Route handler → runAction → ...]
```

**Rules**

1. Permission required per route registered in route metadata (central registry — future).
2. **Service layer does not read JWT**; receives `actorUserId` only when audit requires it (future).
3. Closed-formula / version policies remain in **Service** — RBAC does not replace business guards.

---

## 8. JWT strategy

Canonical detail: [`AUTH_TOKEN_SESSION_STRATEGY.md`](./AUTH_TOKEN_SESSION_STRATEGY.md) (DL-043).

| Aspect | Policy |
|--------|--------|
| **Format** | JWT (RFC 7519), HS256, `JWT_SECRET` |
| **Access token TTL** | **15 minutes** |
| **Claims** | `sub`, `email`, `roles`, `memberships` (summary), `iat`, `exp` |
| **Transport** | `Authorization: Bearer <token>` |
| **Revocation** | Short TTL; refresh rotation; no access denylist in v1.3.2 |

**Explicitly not in JWT:** passwords, secrets, refresh tokens, `formula_participants.role_group` as auth source.

---

## 9. Session strategy

Canonical detail: [`AUTH_TOKEN_SESSION_STRATEGY.md`](./AUTH_TOKEN_SESSION_STRATEGY.md) (DL-043).

| Aspect | Policy |
|--------|--------|
| **Refresh token** | Opaque random; **14 days** TTL |
| **Cookie** | HttpOnly, Secure, SameSite=Strict |
| **DB** | `sessions.refresh_token_hash` only — raw token never stored |
| **Rotation** | Every refresh issues new access + refresh; old session revoked |
| **Reuse detection** | Revoked refresh replay → revoke all user sessions |
| **Logout** | `revoked_at = now()` + clear cookie |
| **Logout all** | Revoke all active sessions for `user_id` |

Access tokens remain **stateless JWT**; sessions manage **refresh only**.

---

## 10. Credential policy

Canonical detail: [`AUTH_CREDENTIAL_POLICY.md`](./AUTH_CREDENTIAL_POLICY.md) (DL-044).

| Aspect | Policy |
|--------|--------|
| **Hashing** | Argon2id (primary); bcrypt cost ≥ 12 fallback only if Argon2 unavailable |
| **Minimum length** | **12** characters; passphrases allowed |
| **Composition** | ≥ 2 categories among letters, digits, symbols |
| **Rejections** | Email-as-password; obvious service/company tokens |
| **Login lockout** | **5** failures in **15** minutes → **LOCKED** for **15** minutes |
| **Account status** | `ACTIVE`, `INVITED`, `SUSPENDED`, `LOCKED` |
| **Bootstrap** | One-time; explicit env vars; no production default password; audit required |
| **Password reset** | **Deferred** — no email reset in Auth MVP |
| **Sensitive data** | Never log or return password / `password_hash`; generic login errors |

---

## 11. RBAC permission matrix

Canonical detail: [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md) (DL-045).

| Aspect | Policy |
|--------|--------|
| **Roles** | `SUPER_ADMIN`, `COMPANY_ADMIN`, `MANAGER`, `VIEWER` |
| **Scope** | Company membership; formula via `formula_participants.company_id` |
| **Sensitive ops** | Cancel, close, settlement, membership admin, company update, session revoke-all → `COMPANY_ADMIN`+ |
| **MANAGER limit** | No cancel/close/settle; approval workflow deferred |
| **VIEWER** | Read + dashboard only |

---

## 12. Route protection policy

Canonical detail: [`ROUTE_PROTECTION_POLICY.md`](./ROUTE_PROTECTION_POLICY.md) (DL-046).

| Aspect | Policy |
|--------|--------|
| **Public routes** | `GET /api/v1/health` only |
| **Business routes (47)** | `AUTHENTICATED` + `RBAC` + `COMPANY_SCOPED` |
| **Protection levels** | `PUBLIC`, `AUTHENTICATED`, `RBAC`, `COMPANY_SCOPED`, `SUPER_ADMIN_ONLY` |
| **Sensitive routes** | Cancel, close, settlement POST, payment record cancel, company create → `COMPANY_ADMIN`+ |
| **Scope** | Formula via `formula_participants`; dashboard company filter mandatory |

---

## 13. Future expansion

| Area | Direction |
|------|-----------|
| **Company-scoped RBAC** | User role limited to `company_id` set; read formulas where participant company matches |
| **Formula-level grants** | Explicit ACL per `formula_id` for external collaborators |
| **OAuth2 / SSO** | Enterprise IdP (Azure AD, Google) as alternative login |
| **MFA** | TOTP/WebAuthn after password login |
| **Service accounts** | Client credentials for integrations |
| **Audit** | `audit_logs` entries with `actor_user_id` on sensitive mutations |
| **Error envelope** | `401/403` with `request_id`, `code`, `message` per ERROR_HANDLING.md target |
| **Row-level security** | PostgreSQL RLS optional long-term; prefer Service guards near-term |

---

## 14. Deferred scope

Not in Auth Foundation v1.3.0–v1.3.5 specification implementation:

| Item | Notes |
|------|-------|
| User / credentials tables | SQL design in DL-042; apply in SQL milestone |
| Company membership model | Link user ↔ company; not `formula_participants` |
| Login / refresh HTTP routes | After middleware milestone |
| Auth middleware on existing 48 routes | Policy in DL-046; implementation in middleware milestone |
| Password reset email / self-service forgot | V2 (admin reset future scope — DL-044) |
| OAuth, MFA, API keys, breach DB | V2 |
| Permission admin UI | V2 |
| ABAC / custom permission builder / RLS | V2 (DL-045 deferred) |
| CI auth integration tests | When middleware lands |
| Prisma/schema changes | Separate approved SQL milestone |

---

## 15. Security principles

1. **Fail closed** — Unauthenticated requests to protected routes are rejected.
2. **Separate secrets** — `JWT_SECRET` ≠ `SESSION_SECRET` ≠ `ENCRYPTION_KEY`.
3. **No secrets in logs** — Existing `redactSensitive()` policy applies.
4. **Short-lived access tokens** — Limit blast radius of leaked JWT.
5. **RBAC ≠ business role** — Never authorize from `formula_participants.role_group` alone.
6. **Formula First preserved** — Auth wraps HTTP; does not create Deal/Order top-level entities.
7. **Manual status unchanged** — Auth must not auto-complete formula statuses.
8. **Production gate** — `JWT_SECRET` + `SESSION_SECRET` required when `NODE_ENV=production` (existing env validation).
9. **HTTPS only** in production for cookies and tokens.
10. **Least privilege** — Default role for new users: `VIEWER` or none until assigned.
11. **Credential hygiene** — Argon2id hashing; lockout policy; no password material in logs or API (DL-044).
12. **Company scope** — Non–`SUPER_ADMIN` roles constrained by `company_memberships`; dashboard KPI requires company filter (DL-045).
13. **Route protection** — 48-route registry with min role and scope rules (DL-046).

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-23 | v1.3.0 — Auth/RBAC foundation specification (DL-041); design only |
| 2026-06-23 | v1.3.2 — JWT/session summary aligned to AUTH_TOKEN_SESSION_STRATEGY (DL-043) |
| 2026-06-23 | v1.3.3 — Credential policy summary aligned to AUTH_CREDENTIAL_POLICY (DL-044) |
| 2026-06-23 | v1.3.4 — Membership roles + matrix summary; RBAC_PERMISSION_MATRIX canonical (DL-045) |
| 2026-06-23 | v1.3.5 — Route protection summary; ROUTE_PROTECTION_POLICY canonical (DL-046) |
