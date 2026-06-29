# TOCS JWT & Session Strategy

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.3.2 (Strategy — documentation only) |
| **Status** | ACCEPTED (DL-043) |
| **Implementation** | **Not started** — no JWT, session repository, login API, or middleware |

**Related:** [`AUTH_RBAC_SPEC.md`](./AUTH_RBAC_SPEC.md), [`AUTH_DB_SCHEMA.md`](./AUTH_DB_SCHEMA.md), [`../architecture/AUTH_ARCHITECTURE.md`](../architecture/AUTH_ARCHITECTURE.md), [`../operations/ENVIRONMENT.md`](../operations/ENVIRONMENT.md)

**Decision:** DL-043 — JWT and Session Strategy (ACCEPTED)

---

## 1. Overview

TOCS uses a **dual-token** model:

| Token | Type | Lifetime | Storage |
|-------|------|----------|---------|
| **Access token** | Signed JWT | **15 minutes** | Client memory; `Authorization: Bearer` header |
| **Refresh token** | Opaque random string | **14 days** | HttpOnly cookie (browser); hash in `sessions` table |

Access tokens authorize API calls. Refresh tokens renew access without re-entering password. **Raw refresh tokens are never stored** — only `refresh_token_hash` in PostgreSQL ([`AUTH_DB_SCHEMA.md`](./AUTH_DB_SCHEMA.md)).

---

## 2. Access token (JWT)

### 2.1 Format

| Aspect | Policy |
|--------|--------|
| Standard | JWT (RFC 7519) |
| Algorithm | **HS256** with `JWT_SECRET` (production required) |
| Transport | `Authorization: Bearer <access_token>` |
| TTL | **15 minutes** fixed for v1.3.2 (configurable env in implementation milestone) |

### 2.2 Payload claims

| Claim | Required | Description |
|-------|----------|-------------|
| `sub` | Yes | User UUID (`users.id`) |
| `email` | Yes | Login email (for display/context; not a secret) |
| `roles` | Yes | Aggregated role codes derived from active memberships (e.g. highest privilege or distinct set) |
| `memberships` | Yes | **Summary** array: `{ company_id, role }[]` for active `company_memberships` only |
| `iat` | Yes | Issued-at (Unix seconds) |
| `exp` | Yes | Expiry (Unix seconds); `iat + 15m` |

Optional (implementation may add):

| Claim | Description |
|-------|-------------|
| `jti` | Unique access token id for optional denylist (V2) |
| `ver` | Token schema version integer |

### 2.3 Forbidden in payload

Never embed in JWT:

- `password`, `password_hash`
- `DATABASE_URL`, secrets, refresh tokens
- Full PII beyond email
- `formula_participants.role_group` as authorization source
- `JWT_SECRET`, `SESSION_SECRET`, `ENCRYPTION_KEY`

### 2.4 Validation (middleware — future)

1. Verify HS256 signature with `JWT_SECRET`.
2. Reject if `exp` in the past.
3. Reject if `sub` user `status != ACTIVE` on sensitive routes (optional re-check in AuthService).
4. RBAC uses `memberships` + route permission map — do not trust client-side role editing.

---

## 3. Refresh token

### 3.1 Format

| Aspect | Policy |
|--------|--------|
| Type | **Opaque** cryptographically random string (≥ 256 bits entropy) |
| TTL | **14 days** from issue (`sessions.expires_at`) |
| Client storage | **HttpOnly**, **Secure**, **SameSite=Strict** cookie |
| Cookie name (proposed) | `tocs_refresh` |
| Server storage | **`refresh_token_hash` only** in `sessions` — never raw token |

### 3.2 Hashing

Before persist:

```
refresh_token_hash = HMAC-SHA256(refresh_token, SESSION_SECRET)
```

Or Argon2id/bcrypt of token — implementation choice; must be one-way and constant-time compare on lookup.

`SESSION_SECRET` is required in production (existing `validateEnvironment()` policy).

### 3.3 API clients (non-browser)

May receive refresh token in JSON response body for mobile/CLI; clients must store securely. Browser clients **must** use cookie path only.

---

## 4. Session record (`sessions` table)

Aligns with [`AUTH_DB_SCHEMA.md`](./AUTH_DB_SCHEMA.md):

| Column | Purpose |
|--------|---------|
| `id` | Session UUID (may link to refresh rotation chain) |
| `user_id` | Owner |
| `refresh_token_hash` | Lookup key for refresh request |
| `expires_at` | Absolute expiry (**14 days** from creation at issue) |
| `revoked_at` | `NULL` = active; timestamp = revoked |
| `created_at` | Audit |

**Active session:** `revoked_at IS NULL AND expires_at > NOW()`.

One refresh token maps to **one** session row. Rotation creates a **new** row and revokes the old row.

---

## 5. Token rotation

Issued on **login** and every **refresh**:

```
1. Client presents refresh token (cookie)
2. Server looks up sessions by refresh_token_hash
3. If invalid / expired / revoked → 401
4. Issue new access JWT (15m)
5. Generate new opaque refresh token
6. Insert new sessions row (new hash, new expires_at = now + 14d)
7. Set revoked_at = NOW() on previous session row
8. Return access token + Set-Cookie new refresh token
```

### 5.1 Reuse detection (refresh token replay)

If a **revoked** refresh token is presented again:

| Step | Action |
|------|--------|
| 1 | Treat as potential token theft |
| 2 | **Revoke all active sessions** for `user_id` (logout all devices) |
| 3 | Return **401 Unauthorized** |
| 4 | Log security event at `warn` (user id + session id only — **no token value**) |

This is **mandatory policy** for v1.3.2 implementation, not optional V2.

---

## 6. Logout (current session)

**Endpoint (future):** `POST /api/v1/auth/logout`

| Step | Action |
|------|--------|
| 1 | Resolve session from refresh cookie (or session id) |
| 2 | `UPDATE sessions SET revoked_at = NOW() WHERE id = ?` |
| 3 | Clear refresh cookie (`Max-Age=0`, same path/domain flags) |
| 4 | Client discards access JWT from memory |

Access JWT may remain valid until `exp` (≤ 15m) — acceptable; no server-side access denylist in v1.3.2.

---

## 7. Logout all devices

**Endpoint (future):** `POST /api/v1/auth/logout-all`

| Step | Action |
|------|--------|
| 1 | Require valid access JWT (or re-auth for high security — implementation choice) |
| 2 | `UPDATE sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL` |
| 3 | Clear refresh cookie on current client |
| 4 | All other devices fail on next refresh with 401 |

Also triggered automatically by **refresh reuse detection** (§5.1).

---

## 8. Flow diagrams

### 8.1 Login

```
Client                    AuthService              DB
  | POST /auth/login          |                    |
  | email+password            | verify users       |
  |                           | insert sessions    |
  |< access_token (body)      |                    |
  |< Set-Cookie refresh       |                    |
```

### 8.2 Authenticated request

```
Client                    Middleware
  | GET /formulas           |
  | Authorization: Bearer   | verify JWT (15m)
  |                         | RBAC check
  |< 200                    |
```

### 8.3 Refresh

```
Client                    SessionService           DB
  | POST /auth/refresh      |                    |
  | Cookie: refresh         | lookup hash        |
  |                           | rotate (§5)        |
  |< new access_token         |                    |
  |< Set-Cookie new refresh  |                    |
```

---

## 9. Security

| Rule | Policy |
|------|--------|
| `JWT_SECRET` | **Required** in production (`env.ts`) |
| `SESSION_SECRET` | **Required** in production; used for refresh hash pepper |
| `ENCRYPTION_KEY` | **Reserved** — field encryption future use; not used for tokens in v1.3.2 |
| Logging | **Never** log access token, refresh token, or `password_hash` |
| Logging | Email/user id/session id OK at `info`/`warn` |
| HTTPS | **Required** in production for cookies and Bearer tokens |
| Cookie flags | `HttpOnly; Secure; SameSite=Strict` |
| CSRF | Refresh endpoint same-site only; consider CSRF token if cookie used with cross-site frontends (V2) |

Existing `redactSensitive()` in [`logger.ts`](../../src/lib/logger.ts) covers `jwt_secret`, `session_secret`, `token`, `authorization`.

---

## 10. Environment summary

| Variable | Access JWT | Refresh token |
|----------|------------|---------------|
| `JWT_SECRET` | Sign / verify | — |
| `SESSION_SECRET` | — | Hash refresh token before DB store |
| `ENCRYPTION_KEY` | — (reserved) | — |

---

## 11. Deferred scope

Not in v1.3.2 strategy implementation:

| Item | Notes |
|------|-------|
| OAuth / SSO | External IdP tokens |
| 2FA | Step-up auth |
| Device fingerprinting | Bind session to device |
| Session anomaly detection | Geo / velocity alerts |
| Password reset flow | Email token tables |
| Email verification | Account activation |
| Access token denylist | Accept 15m window only in v1.3.2 |
| RS256 / JWKS | HS256 sufficient for v1.3 |

---

## 12. Integration gate

Until login/refresh routes and middleware ship:

- **212/212** integration tests unchanged (no auth headers).
- No changes to `db/schema/*.sql` or `schema.prisma` in v1.3.2.

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-23 | v1.3.2 — JWT & session strategy (DL-043); documentation only |
