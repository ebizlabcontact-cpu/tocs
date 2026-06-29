# TOCS Authentication Architecture

## Purpose

Describe how Authentication and RBAC fit into the TOCS Backend architecture **without implementing code** in Auth Foundation v1.3.0.

**Status:** Design accepted (DL-041) — implementation milestones follow separately.

**Related:** [`../specs/AUTH_RBAC_SPEC.md`](../specs/AUTH_RBAC_SPEC.md), [`../master/TOCS_MASTER_SPEC.md`](../master/TOCS_MASTER_SPEC.md), [`../operations/ENVIRONMENT.md`](../operations/ENVIRONMENT.md)

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
| **System role** (`OPS_MANAGER`, `FINANCE`, …) | API RBAC | Who may call which endpoint |
| **Participant role** (`role_group` in `formula_participants`) | Formula domain | Trade structure inside a Formula |
| **Company** | Horizontal entity | No fixed API role (DL-004) |

```
┌─────────────────────────────────────────────────────────┐
│                    API RBAC (v1.3)                       │
│  User ──has──▶ System Role ──grants──▶ Permission       │
└─────────────────────────────────────────────────────────┘
                          │
                          │ protects
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
| `TokenService` | `src/services/token.service.ts` | JWT sign/verify using `JWT_SECRET` |
| `SessionService` | `src/services/session.service.ts` | Refresh session using `SESSION_SECRET` |
| `RbacService` | `src/services/rbac.service.ts` | Role → permission resolution |
| `AuthRepository` | `src/repositories/auth.repository.ts` | User/session persistence (future tables) |
| `auth.middleware` | `src/http/plugins/auth.middleware.ts` | Bearer JWT validation |
| `rbac.middleware` | `src/http/plugins/rbac.middleware.ts` | Route permission enforcement |
| `auth.routes` | `src/http/routes/auth.routes.ts` | login, refresh, logout, me |

**v1.3.0 milestone:** None of the above files are created yet — architecture only.

---

## 4. Request context

After auth middleware (future), attach to Fastify request:

```typescript
interface AuthContext {
  userId: string;
  roles: readonly string[];  // e.g. ['FINANCE']
  tokenId: string;           // jti
}
```

Routes pass `userId` into Actions **only when audit requires**; most existing Action signatures remain unchanged during initial rollout.

---

## 5. Route protection strategy

### Phase A — Foundation (v1.3.0)

- Specification + architecture documents only.
- All routes remain open (current behavior).
- `GET /api/v1/health` permanently public.

### Phase B — Middleware (v1.3.1, planned)

- Register auth + RBAC plugins in `createServer()` **after** request logger, **before** business routes.
- Route metadata: `{ permission: 'formula:read' }`.
- Opt-in per route group; dual-mode period with env flag `AUTH_ENFORCE=false` in dev optional.

### Phase C — Enforcement (v1.3.x, planned)

- Production: `AUTH_ENFORCE=true` mandatory.
- Integration test slice: authenticated + forbidden cases.
- CI: issue test JWT via test secret (ephemeral).

---

## 6. Token lifecycle architecture

```
┌──────────┐     login      ┌─────────────┐
│  Client  │ ──────────────▶│ AuthService │
└──────────┘                └──────┬──────┘
     ▲                             │
     │         access JWT          │ refresh session
     │         (short TTL)         │ (SESSION_SECRET)
     │                             ▼
     │                      ┌─────────────┐
     └──── refresh ────────│SessionService│
                            └─────────────┘
```

| Token | Storage | Validates with |
|-------|---------|----------------|
| Access JWT | Client memory / Authorization header | `JWT_SECRET` |
| Refresh | HttpOnly cookie or secure store | `SESSION_SECRET` + optional DB session row |

---

## 7. Data model direction (not implemented)

Future SQL milestone (requires explicit approval — not part of v1.3.0):

| Table (proposed) | Purpose |
|------------------|---------|
| `users` | Identity, password hash, status |
| `roles` | Role catalog (`SYSTEM_ADMIN`, …) |
| `user_roles` | Many-to-many assignment |
| `sessions` | Refresh token hash, expiry, user_id |

**No migration in v1.3.0.** Prisma migrate / db push remain forbidden.

---

## 8. Integration with existing systems

| System | Integration |
|--------|-------------|
| **env.ts** | Already requires `JWT_SECRET`, `SESSION_SECRET` in production |
| **logger.ts** | Log auth failures at `warn`; never log tokens |
| **ERROR_HANDLING.md** | 401/403 taxonomy; `UNAUTHORIZED` / `FORBIDDEN` codes |
| **request-logger** | Continue `request_id` correlation for denied requests |
| **212 integration tests** | Unchanged until auth test milestone; no header required until Phase B |

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
| Stolen refresh cookie | HttpOnly, Secure, SameSite; server revocation |
| Privilege escalation | Server-side RBAC check; roles not client-editable |
| Secret leakage | redactSensitive; env validation; no secrets in repo |
| Confused deputy (business vs API role) | Separate RBAC from `formula_participants` |

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-23 | v1.3.0 — Auth architecture foundation (DL-041); design only |
