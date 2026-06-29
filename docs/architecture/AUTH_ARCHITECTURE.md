# TOCS Authentication Architecture

## Purpose

Describe how Authentication and RBAC fit into the TOCS Backend architecture. **v1.3.0** — RBAC spec (DL-041); **v1.3.1** — DB schema (DL-042); **v1.3.2** — JWT/session strategy (DL-043); **v1.3.3** — password/credential policy (DL-044); **v1.3.4** — RBAC permission matrix (DL-045); **v1.3.5** — route protection policy (DL-046); **v1.3.6** — implementation plan (DL-047). Documentation milestones complete; code follows [`AUTH_IMPLEMENTATION_PLAN.md`](../specs/AUTH_IMPLEMENTATION_PLAN.md).

**Status:** Design and plan accepted — implementation Phases 1–7 execute per DL-047.

**Related:** [`../specs/AUTH_RBAC_SPEC.md`](../specs/AUTH_RBAC_SPEC.md), [`../specs/AUTH_DB_SCHEMA.md`](../specs/AUTH_DB_SCHEMA.md), [`../specs/AUTH_TOKEN_SESSION_STRATEGY.md`](../specs/AUTH_TOKEN_SESSION_STRATEGY.md), [`../specs/AUTH_CREDENTIAL_POLICY.md`](../specs/AUTH_CREDENTIAL_POLICY.md), [`../specs/RBAC_PERMISSION_MATRIX.md`](../specs/RBAC_PERMISSION_MATRIX.md), [`../specs/ROUTE_PROTECTION_POLICY.md`](../specs/ROUTE_PROTECTION_POLICY.md), [`../specs/AUTH_IMPLEMENTATION_PLAN.md`](../specs/AUTH_IMPLEMENTATION_PLAN.md), [`../master/TOCS_MASTER_SPEC.md`](../master/TOCS_MASTER_SPEC.md), [`../operations/ENVIRONMENT.md`](../operations/ENVIRONMENT.md)

---

## 1. Architectural placement

Auth is a **new horizontal layer** at the HTTP boundary. Core MVP layer rules are unchanged.

```
Client
  │
  ▼
Fastify HTTP Server
  │
  ├─ request-logger plugin     (existing — request_id)
  ├─ auth plugin               (future — JWT verify)
  ├─ rbac plugin / route hook  (future — permission check)
  │
  ▼
Route handler
  │
  ▼
runAction() → Action → Service → Repository → Prisma → PostgreSQL
```

### Allowed (future)

```
Route → auth context → Action → Service → Repository
```

### Forbidden

```
Action → JWT verify
Repository → role check
Service → parse Authorization header directly (prefer injected actorId)
```

---

## 2. Separation from Formula business model

| Concept | Layer | Purpose |
|---------|-------|---------|
| **Membership role** (`SUPER_ADMIN`, `COMPANY_ADMIN`, `MANAGER`, `VIEWER`) | Auth DB — `company_memberships.role` | Company-scoped access (DL-042) |
| **API permission** (`formula:read`, …) | RBAC spec — `RbacService` | Endpoint authorization (DL-041) |
| **Participant role** (`role_group` in `formula_participants`) | Formula domain | Trade structure inside a Formula |
| **Company** | Horizontal entity | No fixed business role (DL-004) |

```
┌─────────────────────────────────────────────────────────┐
│              Auth DB (v1.3.1 — DL-042)                   │
│  User ──membership──▶ Company + membership_role          │
│  User ──sessions──▶ refresh token hash                   │
└─────────────────────────────────────────────────────────┘
                          │
                          │ RbacService maps role → permission
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Formula First Business Layer                │
│  Formula ──has──▶ formula_participants (sequence, role)  │
└─────────────────────────────────────────────────────────┘
```

Authorization for **business rules** (closed formula, version trigger, cancel twice) stays in **Service** guards. RBAC only answers: “May this user invoke this endpoint?”

---

## 3. Component model (planned)

| Component | Location (planned) | Responsibility |
|-----------|-------------------|----------------|
| `AuthService` | `src/services/auth.service.ts` | Credential validation, token issue/refresh |
| `CredentialService` | `src/services/credential.service.ts` | Argon2id hash/verify, lockout, password validation (future) |
| `TokenService` | `src/services/token.service.ts` | JWT sign/verify using `JWT_SECRET` |
| `SessionService` | `src/services/session.service.ts` | Refresh session using `SESSION_SECRET` |
| `RbacService` | `src/services/rbac.service.ts` | Membership role → permission matrix; company scope resolution |
| `AuthRepository` | `src/repositories/auth.repository.ts` | `users`, `company_memberships`, `sessions` persistence |
| `auth.middleware` | `src/http/plugins/auth.middleware.ts` | Bearer JWT validation (future) |
| `rbac.middleware` | `src/http/plugins/rbac.middleware.ts` | Route permission enforcement (future) |
| `auth.routes` | `src/http/routes/auth.routes.ts` | login, refresh, logout, me (future) |

**v1.3.0 milestone:** Specification only (DL-041).  
**v1.3.1 milestone:** DB schema design documented in [`AUTH_DB_SCHEMA.md`](../specs/AUTH_DB_SCHEMA.md) (DL-042) — no SQL files yet.

---

## 4. Request context

After auth middleware (future), attach to Fastify request:

```typescript
interface AuthContext {
  userId: string;
  memberships: readonly { companyId: string; role: string }[];
  tokenId: string;           // jti / session id
}
```

Routes pass `userId` into Actions **only when audit requires**; most existing Action signatures remain unchanged during initial rollout.

---

## 5. Route protection strategy

### Phase A — Specification (v1.3.0, DL-041)

- RBAC spec + architecture documents.
- All routes remain open (current behavior).
- `GET /api/v1/health` permanently public.

### Phase B — Database design (v1.3.1, DL-042)

- `users`, `company_memberships`, `sessions` schema documented.
- **No** `db/schema/*.sql` or Prisma changes in this phase.
- Future: `tocs_auth_schema.sql` as 4th apply file.

### Phase C — Token strategy (v1.3.2, DL-043)

- Access JWT 15m; refresh opaque 14d; rotation + reuse detection documented.
- See [`AUTH_TOKEN_SESSION_STRATEGY.md`](../specs/AUTH_TOKEN_SESSION_STRATEGY.md).

### Phase D — Credential policy (v1.3.3, DL-044)

- Argon2id password hashing; validation rules; login lockout (5 / 15m).
- Account statuses: `ACTIVE`, `INVITED`, `SUSPENDED`, `LOCKED`.
- One-time admin bootstrap with explicit env vars + audit.
- See [`AUTH_CREDENTIAL_POLICY.md`](../specs/AUTH_CREDENTIAL_POLICY.md).

### Phase E — RBAC permission matrix (v1.3.4, DL-045)

- Canonical matrix: `SUPER_ADMIN`, `COMPANY_ADMIN`, `MANAGER`, `VIEWER`.
- Company scope via `company_memberships`; formula access via `formula_participants.company_id`.
- Sensitive ops floor: `COMPANY_ADMIN`+.
- See [`RBAC_PERMISSION_MATRIX.md`](../specs/RBAC_PERMISSION_MATRIX.md).

### Phase F — Route protection policy (v1.3.5, DL-046)

- All **48** MVP routes classified: protection level, min role, permission key, scope rule.
- Public: health only; 47 business routes require auth + RBAC + company scope.
- See [`ROUTE_PROTECTION_POLICY.md`](../specs/ROUTE_PROTECTION_POLICY.md).

### Phase G — Implementation plan (v1.3.6, DL-047)

- Seven-phase code execution order documented; explicit non-goals.
- See [`AUTH_IMPLEMENTATION_PLAN.md`](../specs/AUTH_IMPLEMENTATION_PLAN.md).

### Code phases (DL-047 — execution, not v1.3.x doc batches)

| Impl phase | Deliverable |
|------------|-------------|
| 1 | Auth SQL apply |
| 2 | Repositories + credentials |
| 3 | Auth routes (login, logout, refresh, me) |
| 4 | JWT + session rotation |
| 5 | Auth middleware + scope |
| 6 | RBAC middleware + 48-route guards |
| 7 | Integration tests |

**212/212** gate until Phase 7 adds auth test slice. Production: `AUTH_ENFORCE=true` after Phase 6.

---

## 6. Token lifecycle architecture

Canonical flows: [`AUTH_TOKEN_SESSION_STRATEGY.md`](../specs/AUTH_TOKEN_SESSION_STRATEGY.md).

```
┌──────────┐     login      ┌─────────────┐     insert      ┌──────────┐
│  Client  │ ──────────────▶│ AuthService │ ───────────────▶│ sessions │
└──────────┘                └──────┬──────┘                 └──────────┘
     ▲                             │
     │  access JWT (15m, Bearer)   │ refresh opaque (14d, cookie)
     │                             │ hash with SESSION_SECRET
     │                      ┌──────▼──────┐
     └──── refresh ────────│SessionService│── rotation: revoke old row
                            └─────────────┘
```

| Token | TTL | Storage | Validates with |
|-------|-----|---------|----------------|
| Access JWT | **15 min** | Client memory / `Authorization` header | `JWT_SECRET` |
| Refresh | **14 days** | HttpOnly cookie; DB hash only | `SESSION_SECRET` + `sessions.refresh_token_hash` |

---

## 7. Data model (v1.3.1 — design only)

Canonical definition: [`../specs/AUTH_DB_SCHEMA.md`](../specs/AUTH_DB_SCHEMA.md) (DL-042).

| Table | Purpose |
|-------|---------|
| `users` | Identity, `password_hash`, `status`, `last_login_at` |
| `company_memberships` | `user_id` + `company_id` + `membership_role` enum |
| `sessions` | `refresh_token_hash`, `expires_at`, `revoked_at` |

**User status enum (v1.3.3):** `ACTIVE` | `INVITED` | `SUSPENDED` | `LOCKED` — reconciles v1.3.1 `PENDING` → `INVITED` at SQL apply.

**Membership role enum:** `SUPER_ADMIN` | `COMPANY_ADMIN` | `MANAGER` | `VIEWER`

**Relationships:** user → memberships → companies → formula_participants → formulas (indirect).

**Not in v1.3.1:** global `roles` / `user_roles` tables (superseded by company-scoped memberships).

**No migration in v1.3.1.** Prisma migrate / db push remain forbidden until SQL file is approved and applied.

---

## 8. Integration with existing systems

| System | Integration |
|--------|-------------|
| **env.ts** | Already requires `JWT_SECRET`, `SESSION_SECRET` in production |
| **logger.ts** | Log auth failures at `warn`; never log tokens |
| **ERROR_HANDLING.md** | 401/403 taxonomy; `UNAUTHORIZED` / `FORBIDDEN` codes |
| **request-logger** | Continue `request_id` correlation for denied requests |
| **212 integration tests** | Unchanged until Implementation Phase 7; `AUTH_ENFORCE=false` in CI until then |

---

## 9. Deployment considerations

- Production deploy checklist (`RELEASE_AND_DEPLOYMENT.md`) already requires JWT/SESSION secrets.
- Token TTL changes are config-only — no schema impact.
- Rolling deploy: accept old and new `JWT_SECRET` briefly during rotation (dual-key period — V2).

---

## 10. Threat model (summary)

| Threat | Mitigation |
|--------|------------|
| Stolen access JWT | Short TTL; HTTPS; refresh rotation |
| Stolen refresh cookie | HttpOnly, Secure, SameSite; rotation; reuse → logout all |
| Privilege escalation | Server-side RBAC check; roles not client-editable |
| Secret leakage | redactSensitive; env validation; no secrets in repo |
| Confused deputy (business vs API role) | Separate RBAC from `formula_participants` |
| Credential stuffing | Lockout 5/15m; generic errors; Argon2id; rate limit (optional) |
| Weak bootstrap password | Explicit env only; validation §3; no prod defaults; audit log |
| Cross-company data leak | Company scope in `RbacService`; 404 outside membership set |
| MANAGER escalation abuse | Hard deny on sensitive ops; no approval queue in MVP |

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-23 | v1.3.0 — Auth architecture foundation (DL-041); design only |
| 2026-06-23 | v1.3.1 — Auth DB schema (`users`, `company_memberships`, `sessions`); phased rollout updated (DL-042) |
| 2026-06-23 | v1.3.2 — JWT/session strategy, rotation, logout; phases C–E (DL-043) |
| 2026-06-23 | v1.3.3 — Credential policy, bootstrap, lockout; Phase D; middleware → Phase F (DL-044) |
| 2026-06-23 | v1.3.4 — RBAC permission matrix; Phase E; middleware → Phase G (DL-045) |
| 2026-06-23 | v1.3.5 — Route protection policy (48 routes); Phase F (DL-046) |
| 2026-06-23 | v1.3.6 — Implementation plan; code Phases 1–7 (DL-047) |
