# TOCS Authentication Implementation Plan

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.3.17 (Plan — Phases 1–6 complete) |
| **Status** | ACCEPTED (DL-047); **Implementation Phases 1–6 CLOSED** (DL-049) |
| **Implementation** | **Phases 1–6 complete** (v1.3.7–v1.3.17); Phase 7 optional / V2 |

**Related:** [`AUTH_RBAC_SPEC.md`](./AUTH_RBAC_SPEC.md), [`AUTH_DB_SCHEMA.md`](./AUTH_DB_SCHEMA.md), [`AUTH_TOKEN_SESSION_STRATEGY.md`](./AUTH_TOKEN_SESSION_STRATEGY.md), [`AUTH_CREDENTIAL_POLICY.md`](./AUTH_CREDENTIAL_POLICY.md), [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md), [`ROUTE_PROTECTION_POLICY.md`](./ROUTE_PROTECTION_POLICY.md), [`../architecture/AUTH_ARCHITECTURE.md`](../architecture/AUTH_ARCHITECTURE.md)

**Decision:** DL-047 — Authentication Implementation Plan (ACCEPTED)

**Foundation complete (v1.3.0–v1.3.5):** Specification, DB design, token/session strategy, credential policy, RBAC matrix, and 48-route protection registry are **ACCEPTED**.

**Implementation complete (v1.3.7–v1.3.17, DL-049):** Phases 1–6 delivered; integration gate **308/308** PASS.

---

## 1. Overview

This document is the **authoritative execution order** for TOCS Authentication and RBAC code. It sequences seven implementation phases with explicit deliverables, gates, and dependencies.

**Layer discipline (unchanged):**

```
Action → Service → Repository → Prisma → PostgreSQL
```

Auth/RBAC live at the **HTTP boundary** and in **Auth* / Rbac* / Credential* / Token* / Session* Services**. Actions do not call Prisma for auth; existing business Actions remain unchanged unless audit requires `actorUserId`.

**Integration gate:** **308/308** after Phase 6 closure (DL-049). Phase 7 adds optional extended auth regression.

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

| Phase | Name | Depends on | Status |
|-------|------|------------|--------|
| 1 | Auth database schema apply | DL-042 design approved | ✅ **Completed** (v1.3.7) |
| 2 | Repositories + credentials | Phase 1 | ✅ **Completed** (v1.3.8–v1.3.10) |
| 3 | Auth services + HTTP routes | Phase 2, DL-043/044 | ✅ **Completed** (v1.3.11–v1.3.14) |
| 4 | JWT + session rotation | Phase 2–3, DL-043 | ✅ **Completed** (v1.3.12) |
| 5 | Auth middleware + scope | Phase 3–4, DL-045/046 | ✅ **Completed** (v1.3.15) |
| 6 | RBAC middleware + route guards | Phase 5, DL-045/046 | ✅ **Completed** (v1.3.16–v1.3.17) |
| 7 | Integration tests (extended) | Phase 1–6 | Optional / V2 |

Phases 3 and 4 may ship in one PR if bounded, but **JWT/rotation logic must not land before** repository + credential foundation (Phases 1–2).

---

## 3. Implementation Phase 1 — Auth database schema

**Goal:** Persist users, memberships, and sessions in PostgreSQL.

**Status:** ✅ **Completed** (v1.3.7, DL-048)

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
- `npm run test:integration` **308/308** (includes auth schema test).
- CI green.

---

## 4. Implementation Phase 2 — Repositories and credentials

**Goal:** Data access and password handling without HTTP auth routes.

**Status:** ✅ **Completed** (v1.3.8–v1.3.10)

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

- Credential + bootstrap integration tests; **308/308** integration suite.
- CI green.

---

## 5. Implementation Phase 3 — Auth services and routes

**Goal:** Login lifecycle HTTP API.

**Status:** ✅ **Completed** (v1.3.11–v1.3.14)

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
- **Business routes protected** in Phase 6 (v1.3.17).

### Gate

- Auth route smoke via `auth.http.integration.test.ts`.
- **308/308** integration suite.
- CI green.

---

## 6. Implementation Phase 4 — JWT and session rotation

**Goal:** Token issuance, refresh rotation, and revocation per DL-043.

**Status:** ✅ **Completed** (v1.3.12)

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
- **308/308** integration suite.
- CI green.

---

## 7. Implementation Phase 5 — Auth middleware and request context

**Goal:** Attach authenticated principal to requests; resolve company scope foundation.

**Status:** ✅ **Completed** (v1.3.15)

### Scope

| Deliverable | Detail |
|-------------|--------|
| `authentication.ts` | Verify Bearer JWT; reject expired/invalid → 401; locked → 423; suspended → 403 — **implemented (v1.3.15)** |
| `request.auth` | `{ userId, email, roles, memberships[] } \| null` — **implemented (v1.3.15)** |
| Formula scope helpers | `requireFormulaScope` + child-resource resolvers — **implemented (v1.3.17)** |
| Server registration | After `request-logger`, before business routes — **implemented (v1.3.15)** |

### Rules

- Service layer does **not** parse `Authorization` header.
- User must be `ACTIVE` for token issue (Phase 3) and for middleware accept.
- Company scope algorithm: [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md) §8, [`ROUTE_PROTECTION_POLICY.md`](./ROUTE_PROTECTION_POLICY.md) §6.

### Out of scope (closed phase)

- Business-route RBAC enforcement — delivered in Phase 6.

### Gate

- `auth.middleware.integration.test.ts` green.
- **308/308** integration suite.
- CI green.

---

## 8. Implementation Phase 6 — RBAC middleware and route protection

**Goal:** Protect all 47 business routes per [`ROUTE_PROTECTION_POLICY.md`](./ROUTE_PROTECTION_POLICY.md) (DL-046).

**Status:** ✅ **Completed** (v1.3.16–v1.3.17, DL-049)

### Scope

| Deliverable | Detail |
|-------------|--------|
| `rbac.ts` | `requireRole(roles)` + `requireCompanyScope(resolveCompanyId)` — **implemented (v1.3.16)** |
| Route guards | All 47 business routes per DL-046 §7 — **implemented (v1.3.17)** |
| Formula scope | `requireFormulaScope` + child-resource resolvers — **implemented (v1.3.17)** |
| `GET /api/v1/auth/me` | JWT-authenticated; query `user_id` removed — **implemented (v1.3.17)** |
| `RbacService` permission-key engine | Deferred V2 (inline role tiers used) |
| Route registry | Inline per-route preHandlers (central registry optional V2) |

### Gate

- Route guards on 47 business routes; `protected-routes.integration.test.ts` green.
- **308/308** integration suite.
- CI green.

---

## 9. Implementation Phase 7 — Integration tests (optional / V2)

**Goal:** Extended automated coverage beyond MVP auth slice.

**Status:** **Optional** — core auth/regression coverage delivered across v1.3.8–v1.3.17 test files; Phase 7 reserved for `AUTH_ENFORCE` CI and extended matrix.

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

- **308/308** business + auth tests pass (current baseline).
- Optional: `AUTH_ENFORCE=true` in CI when approved.
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

Architecture doc phases A–F = **documentation complete**. **Implementation Phases 1–6 = code complete** (DL-049).

---

## 13. v1.3.17 auth phase closure gate (DL-049)

- **No further code required** for Phases 1–6 closure.
- Auth milestone: **Completed** · **Stable** · **Production Ready** (with secrets + bootstrap checklist).
- **308/308** and CI green.
- Phase 7 items require explicit V2 approval.

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-23 | v1.3.6 — Auth implementation plan (DL-047); documentation only |
| 2026-06-30 | v1.3.17 — Phases 1–6 marked complete; auth phase closed (DL-049) |
