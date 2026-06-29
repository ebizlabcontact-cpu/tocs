# TOCS Authentication & RBAC Specification

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.3.0 (Foundation — specification only) |
| **Status** | ACCEPTED (DL-041) |
| **Implementation** | **Not started** — no DB, API, middleware, or JWT code in this milestone |

**Related:** [`../architecture/AUTH_ARCHITECTURE.md`](../architecture/AUTH_ARCHITECTURE.md), [`../operations/ENVIRONMENT.md`](../operations/ENVIRONMENT.md), [`../operations/ERROR_HANDLING.md`](../operations/ERROR_HANDLING.md), [`../operations/PRODUCTION_READINESS_REVIEW.md`](../operations/PRODUCTION_READINESS_REVIEW.md)

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
2. **Role-based defaults** — Permissions assigned via **system roles**, not via `formula_participants.role_group` (business role ≠ API role — DL-004).
3. **Resource-oriented** — Permissions named `{resource}:{action}` aligned with API domains.
4. **Explicit deny** — Default deny; allow only via role grants.
5. **Auditable** — Auth failures and privilege denials logged with `request_id` (no secrets).
6. **Evolution path** — v1.3.x foundation supports future row-level / company-scoped policies without breaking SemVer API contracts.

---

## 3. Role definitions

System roles apply to **API access control** only.

| Role | Code | Description |
|------|------|-------------|
| **System Administrator** | `SYSTEM_ADMIN` | Full API access; user/role management (future admin APIs) |
| **Operations Manager** | `OPS_MANAGER` | Formula lifecycle, participants, logistics, version, share, cancel (not close unless granted) |
| **Finance Operator** | `FINANCE` | Payment, invoice, settlement, dashboard KPI/read |
| **Read-only Analyst** | `VIEWER` | Read APIs across permitted resources; no mutations |
| **Closer** | `CLOSER` | Close formula + read dependencies (subset of OPS + close) |

### Assignment model (future implementation)

- One user → one or more roles (many-to-many).
- Roles are **global** in v1.3.0 foundation; **company-scoped roles** deferred to v1.3.x+ (see §11).
- Service/machine accounts: `SERVICE_ACCOUNT` role with explicit narrow grants (V2).

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
| `settlement` | Settlement schedules, notes | Post-close allowed ops |
| `dashboard` | KPI, receivable/payable, unmatched | Read-heavy |
| `auth` | Login, logout, refresh, me (future) | Auth endpoints themselves |

**Not a resource:** `formula_participants.role_group` (SUPPLIER, BUYER, etc.) — business semantics inside Formula; never copied into JWT as authorization source of truth.

---

## 5. Permission matrix

**Legend:** ✓ = granted, — = denied, ◐ = read-only subset

### 5.1 Mutation permissions

| Permission | SYSTEM_ADMIN | OPS_MANAGER | FINANCE | CLOSER | VIEWER |
|------------|:------------:|:-----------:|:-------:|:------:|:------:|
| `formula:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `formula:create` | ✓ | ✓ | — | — | — |
| `formula:patch` | ✓ | ✓ | — | — | — |
| `formula:cancel` | ✓ | ✓ | — | — | — |
| `company:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `company:write` | ✓ | ✓ | — | — | — |
| `participant:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `participant:write` | ✓ | ✓ | — | — | — |
| `payment:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `payment:write` | ✓ | — | ✓ | — | — |
| `payment:cancel` | ✓ | — | ✓ | — | — |
| `invoice:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `invoice:write` | ✓ | — | ✓ | — | — |
| `logistics:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `logistics:write` | ✓ | ✓ | — | — | — |
| `share:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `share:write` | ✓ | ✓ | — | — | — |
| `version:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `version:write` | ✓ | ✓ | — | — | — |
| `close:execute` | ✓ | — | — | ✓ | — |
| `settlement:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `settlement:write` | ✓ | — | ✓ | — | — |
| `dashboard:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `auth:admin` | ✓ | — | — | — | — |

### 5.2 HTTP status mapping (authorization)

| Condition | HTTP | Target `code` (error envelope milestone) |
|-----------|------|------------------------------------------|
| No / invalid token | 401 | `UNAUTHORIZED` |
| Valid token, insufficient permission | 403 | `FORBIDDEN` |
| Valid token, resource not found | 404 | `NOT_FOUND` (existing Action behavior) |

---

## 6. Authentication flow

```
Client                          TOCS API
  |                                |
  |-- POST /api/v1/auth/login --->|  (future route)
  |    { email, password }         |  Validate credentials (future User store)
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

| Aspect | Policy |
|--------|--------|
| **Format** | JWT (RFC 7519) |
| **Signing** | HS256 with `JWT_SECRET` (production); RS256 optional V2 |
| **Access token TTL** | **15 minutes** default (configurable; max 1 hour v1.3) |
| **Claims (required)** | `sub` (user UUID), `iat`, `exp`, `jti` |
| **Claims (optional)** | `roles` (string array of role codes), `ver` (token schema version) |
| **Transport** | `Authorization: Bearer <token>` |
| **Storage (client)** | Memory or secure storage; not localStorage for web (implementation guide — frontend out of scope) |
| **Revocation** | Short TTL + refresh rotation; denylist optional V2 |
| **Validation** | Signature, `exp`, issuer/audience if configured |

**Explicitly not in JWT:** `DATABASE_URL`, passwords, full user PII, `formula_participants` business roles.

---

## 9. Session strategy

| Aspect | Policy |
|--------|--------|
| **Purpose** | Refresh token lifecycle; optional server-side session record |
| **Refresh TTL** | **7 days** default (configurable); sliding expiration optional V2 |
| **Secret** | `SESSION_SECRET` — distinct from `JWT_SECRET` |
| **Delivery** | `HttpOnly`, `Secure`, `SameSite=Strict` cookie (browser clients) or body field (API clients) |
| **Rotation** | New refresh token on each refresh; reuse detection → revoke all sessions (V2) |
| **Server store** | Optional `sessions` table (future SQL milestone); until then opaque signed cookie acceptable for v1.3.1 |
| **Logout** | Invalidate refresh session server-side + client discards access token |

Access tokens remain **stateless JWT**; sessions manage **refresh only** in the recommended v1.3 design.

---

## 10. Future expansion

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

## 11. Deferred scope

Not in Auth Foundation v1.3.0 specification implementation:

| Item | Notes |
|------|-------|
| User / credentials tables | SQL design in follow-up milestone |
| Company membership model | Link user ↔ company; not `formula_participants` |
| Login / refresh HTTP routes | v1.3.1+ |
| Auth middleware on existing 48 routes | Gradual rollout with test slice |
| Password reset / email verification | V2 |
| OAuth, MFA, API keys | V2 |
| Permission admin UI | V2 |
| CI auth integration tests | When middleware lands |
| Prisma/schema changes | Separate approved SQL milestone |

---

## 12. Security principles

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

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-23 | v1.3.0 — Auth/RBAC foundation specification (DL-041); design only |
