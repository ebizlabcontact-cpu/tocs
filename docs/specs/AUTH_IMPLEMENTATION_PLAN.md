# TOCS Authentication Implementation Plan

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.3.6 (Plan — documentation only) |
| **Status** | ACCEPTED (DL-047) |
| **Implementation** | **Not started** — this milestone defines order and scope only |

**Related:** [`AUTH_RBAC_SPEC.md`](./AUTH_RBAC_SPEC.md), [`AUTH_DB_SCHEMA.md`](./AUTH_DB_SCHEMA.md), [`AUTH_TOKEN_SESSION_STRATEGY.md`](./AUTH_TOKEN_SESSION_STRATEGY.md), [`AUTH_CREDENTIAL_POLICY.md`](./AUTH_CREDENTIAL_POLICY.md), [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md), [`ROUTE_PROTECTION_POLICY.md`](./ROUTE_PROTECTION_POLICY.md), [`../architecture/AUTH_ARCHITECTURE.md`](../architecture/AUTH_ARCHITECTURE.md)

**Decision:** DL-047 — Authentication Implementation Plan (ACCEPTED)

**Foundation complete (v1.3.0–v1.3.5):** Specification, DB design, token/session strategy, credential policy, RBAC matrix, and 48-route protection registry are **ACCEPTED**. Code work begins at **Implementation Phase 1** below — not in v1.3.6.

---

## 1. Overview

This document is the **authoritative execution order** for TOCS Authentication and RBAC code. It sequences seven implementation phases with explicit deliverables, gates, and dependencies.

**Layer discipline (unchanged):**

```
Action → Service → Repository → Prisma → PostgreSQL
```

Auth/RBAC live at the **HTTP boundary** and in **Auth* / Rbac* / Credential* / Token* / Session* Services**. Actions do not call Prisma for auth; existing business Actions remain unchanged unless audit requires `actorUserId`.

**Integration gate until Phase 7:** Existing suite **212/212** must pass after every merged phase. Phase 7 **adds** auth test files; prior phases must not break existing tests.

---

## 2. Phase dependency graph

```
Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──▶ Phase 4
                              │            │
                              └─────┬──────┘
                                    ▼
                              Phase 5 ──▶ Phase 6 ──▶ Phase 7
                           (middleware)  (RBAC)     (tests)
```

| Phase | Name | Depends on |
|-------|------|------------|
| 1 | Auth database schema apply | DL-042 design approved |
| 2 | Repositories + credentials | Phase 1 |
| 3 | Auth services + HTTP routes | Phase 2, DL-043/044 |
| 4 | JWT + session rotation | Phase 2–3, DL-043 |
| 5 | Auth middleware + scope | Phase 3–4, DL-045/046 |
| 6 | RBAC middleware + route guards | Phase 5, DL-045/046 |
| 7 | Integration tests | Phase 1–6 |

Phases 3 and 4 may ship in one PR if bounded, but **JWT/rotation logic must not land before** repository + credential foundation (Phases 1–2).

---

## 3. Implementation Phase 1 — Auth database schema

**Goal:** Persist users, memberships, and sessions in PostgreSQL.

### Scope

| Deliverable | Detail |
|-------------|--------|
| `db/schema/tocs_auth_schema.sql` | `users`, `company_memberships`, `sessions`; enums `membership_role`, `user_status` (`ACTIVE`, `INVITED`, `SUSPENDED`, `LOCKED`) |
| `DB_APPLY_ORDER.md` | 4th file after existing 3 SQL files |
| `schema.prisma` | Models mapped **after** SQL is source-of-truth applied |
| Bootstrap hook | Document only — CLI from [`AUTH_CREDENTIAL_POLICY.md`](./AUTH_CREDENTIAL_POLICY.md) §6 runs after apply |

### Rules

- SQL-first; **no** `prisma migrate dev` / `db push`.
- Backup before apply in non-local environments ([`BACKUP_AND_RESTORE.md`](../operations/BACKUP_AND_RESTORE.md)).
- Reconcile v1.3.1 `PENDING` → `INVITED`; add `LOCKED` per DL-044.
- Do **not** modify Core MVP 3 SQL files.

### Gate

- `npm run typecheck` pass.
- `npm run test:integration` **212/212** (auth tables unused by business tests).
- CI green.

---

## 4. Implementation Phase 2 — Repositories and credentials

**Goal:** Data access and password handling without HTTP auth routes.

### Scope

| Component | Location (planned) | Responsibility |
|-----------|-------------------|----------------|
| `AuthRepository` | `src/repositories/auth.repository.ts` | `users`, `company_memberships`, `sessions` CRUD — **implemented (v1.3.8)** |
| `CredentialService` | `src/services/credential.service.ts` | Argon2id hash/verify; password validation; lockout counters — **implemented (v1.3.9)** |
| Bootstrap command | `src/scripts/bootstrap-admin.ts` | One-time SUPER_ADMIN per DL-044 §6 — **implemented (v1.3.10)** |

### Policy sources

- Hashing / validation / lockout: [`AUTH_CREDENTIAL_POLICY.md`](./AUTH_CREDENTIAL_POLICY.md) (DL-044).
- No raw password or `password_hash` in logs.

### Out of scope

- Login HTTP routes, JWT, middleware.

### Gate

- Credential + bootstrap integration tests; **228/228** integration suite.
- CI green.

---

## 5. Implementation Phase 3 — Auth services and routes

**Goal:** Login lifecycle HTTP API (no business-route protection yet).

### Scope

| Route (planned) | Method | Purpose |
|-----------------|--------|---------|
| `/api/v1/auth/login` | POST | Email + password → access token + refresh cookie |
| `/api/v1/auth/logout` | POST | Revoke session + clear cookie |
| `/api/v1/auth/logout-all` | POST | Revoke all user sessions (`COMPANY_ADMIN`+ policy future) |
| `/api/v1/auth/refresh` | POST | Rotate refresh + new access JWT |
| `/api/v1/auth/me` | GET | Current user + memberships (no `password_hash`) |

| Layer | Files (planned) |
|-------|-----------------|
| Routes | `src/http/routes/auth.routes.ts` — **implemented (v1.3.14)** |
| Actions | `src/actions/auth.actions.ts` — **implemented (v1.3.13)** |

### Rules

- Action → Service → Repository only.
- Generic login errors (DL-044).
- **48 business routes remain unauthenticated** until Phase 6 (or `AUTH_ENFORCE` off).

### Gate

- Auth route smoke via `auth.http.integration.test.ts`.
- **275/275** integration suite (includes auth HTTP routes).
- CI green.

---

## 6. Implementation Phase 4 — JWT and session rotation

**Goal:** Token issuance, refresh rotation, and revocation per DL-043.

### Scope

| Component | Responsibility |
|-----------|----------------|
| `TokenService` | HS256 access JWT; 15m TTL; claims `sub`, `email`, `roles`, `memberships`, `iat`, `exp` — **implemented (v1.3.12)** |
| `SessionService` | Opaque refresh token; HMAC-SHA256 hash with `SESSION_SECRET`; 14d TTL — **implemented (v1.3.12)** |
| Rotation | Each refresh → new session row; old session `revoked_at = NOW()` — **implemented (v1.3.12)** |
| Reuse detection | Revoked refresh presented → revoke **all** user sessions + 401 — **implemented (v1.3.12)** |
| Logout | Current session revoked + cookie cleared — HTTP deferred to Phase 3 routes |

### Policy sources

- [`AUTH_TOKEN_SESSION_STRATEGY.md`](./AUTH_TOKEN_SESSION_STRATEGY.md) (DL-043).

### Integration with Phase 3

- May land in same release as Phase 3 if `AuthService` + `TokenService` + `SessionService` are merged atomically; **Phase 4 checklist must be complete** before Phase 5.

### Gate

- Session rotation and reuse paths verified in `token.service.integration.test.ts`.
- **250/250** integration suite baseline; auth actions add **262/262** total.
- CI green.

---

## 7. Implementation Phase 5 — Auth middleware and request context

**Goal:** Attach authenticated principal to requests; resolve company scope foundation.

**Status:** Partial — v1.3.15 implements JWT Bearer parsing and `request.auth` decoration only (no RBAC, no route protection).

### Scope

| Deliverable | Detail |
|-------------|--------|
| `authentication.ts` | Verify Bearer JWT; reject expired/invalid → 401; locked → 423; suspended → 403 — **implemented (v1.3.15)** |
| `request.auth` | `{ userId, email, roles, memberships[] } \| null` — **implemented (v1.3.15)** |
| Scope resolver | `RbacService` or `ScopeService`: membership companies; formula ↔ participant linkage |
| `AUTH_ENFORCE` env | `false` in dev optional; dual-mode logging |
| Server registration | After `request-logger`, before business routes — **implemented (v1.3.15)** |

### Rules

- Service layer does **not** parse `Authorization` header.
- User must be `ACTIVE` for token issue (Phase 3) and for middleware accept.
- Company scope algorithm: [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md) §8, [`ROUTE_PROTECTION_POLICY.md`](./ROUTE_PROTECTION_POLICY.md) §6.

### Out of scope

- Permission matrix enforcement on business routes (Phase 6).

### Gate

- Middleware can be registered but **RBAC not required** on business routes yet, OR enforce only when `AUTH_ENFORCE=true` with Phase 6 complete.
- **212/212** with `AUTH_ENFORCE=false` default in CI until Phase 7.

---

## 8. Implementation Phase 6 — RBAC middleware and route protection

**Goal:** Protect all 47 business routes per [`ROUTE_PROTECTION_POLICY.md`](./ROUTE_PROTECTION_POLICY.md) (DL-046).

### Scope

| Deliverable | Detail |
|-------------|--------|
| `rbac.middleware` | Route metadata `{ permission, minRole? }` |
| `RbacService` | Role → permission from [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md) |
| Route registry | All **48** routes from DL-046 §7 (health exempt) |
| Production | `AUTH_ENFORCE=true` mandatory |

### Enforcement flow

```
auth.middleware → rbac.middleware → scope check → handler
```

| Failure | HTTP |
|---------|------|
| No/invalid token | 401 |
| Insufficient role | 403 |
| Out of company/formula scope | 404 |

### Gate

- Route metadata complete for 47 protected routes.
- Production checklist updated.
- **212/212** still pass with CI `AUTH_ENFORCE=false` until Phase 7 updates CI strategy.

---

## 9. Implementation Phase 7 — Integration tests

**Goal:** Automated coverage for auth, authorization, and sessions.

### Scope

| Test slice | Examples |
|------------|----------|
| Authentication | Login success/failure; lockout; inactive user |
| Session | Refresh rotation; reuse → logout all; logout |
| Authorization | Role matrix spot checks per domain; 403 vs 404 scope |
| Regression | Full **212** business tests with valid JWT fixtures |

### CI changes (Phase 7 only)

- Test JWT issuance via test `JWT_SECRET` / bootstrap user.
- `AUTH_ENFORCE=true` in integration job when slice is stable.
- Document in `ENVIRONMENT.md` / CI workflow when approved.

### Gate

- **212/212** business tests pass with auth fixtures.
- New auth test files green.
- CI green.

---

## 10. Explicit non-goals

The following are **out of scope** for Phases 1–7 and must not be added without a new decision:

| Non-goal | Notes |
|----------|-------|
| OAuth | V2+ |
| SSO | V2+ |
| 2FA / MFA | V2+ |
| API keys | V2+ |
| Password reset email | V2+ (DL-044 deferred) |
| External identity providers | V2+ |
| Custom policy engine | V2+ |
| ABAC | V2+ (DL-045 deferred) |
| PostgreSQL RLS | V2+ |
| Permission admin UI | V2+ |
| Service accounts | V2+ |
| Public share links | V2+ |

---

## 11. Rollout and environment

| Variable | Phase | Purpose |
|----------|-------|---------|
| `JWT_SECRET` | 4+ | Access token signing (production required) |
| `SESSION_SECRET` | 4+ | Refresh token hashing (production required) |
| `AUTH_ENFORCE` | 5–6 | Toggle middleware on business routes |
| `BOOTSTRAP_*` | 2 | One-time admin (DL-044) |

Production deploy: [`RELEASE_AND_DEPLOYMENT.md`](../operations/RELEASE_AND_DEPLOYMENT.md) + auth schema apply + bootstrap + secrets rotation policy.

---

## 12. Mapping: documentation vs implementation phases

| Doc milestone (v1.3.x) | Implementation phase |
|------------------------|----------------------|
| v1.3.1 DB design (DL-042) | Phase 1 |
| v1.3.3 Credential (DL-044) | Phase 2 |
| v1.3.2 Token (DL-043) | Phase 4 |
| v1.3.3 Auth routes | Phase 3 |
| v1.3.4 Matrix (DL-045) | Phase 6 |
| v1.3.5 Routes (DL-046) | Phase 6 |
| v1.3.6 Plan (DL-047) | This document |

Architecture doc phases A–F = **documentation complete**. Code starts at **Implementation Phase 1**.

---

## 13. v1.3.6 milestone gate

- **No** SQL, Prisma, Service, middleware, route, or integration test changes in v1.3.6.
- Plan only; execution requires explicit approval per phase PR.
- **212/212** and CI green unchanged.

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-23 | v1.3.6 — Auth implementation plan (DL-047); documentation only |
