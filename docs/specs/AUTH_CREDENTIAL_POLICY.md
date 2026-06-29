# TOCS Password & Credential Policy

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.3.3 (Strategy — documentation only) |
| **Status** | ACCEPTED (DL-044) |
| **Implementation** | **Not started** — no password hashing, login API, user repository, or bootstrap command |

**Related:** [`AUTH_RBAC_SPEC.md`](./AUTH_RBAC_SPEC.md), [`AUTH_TOKEN_SESSION_STRATEGY.md`](./AUTH_TOKEN_SESSION_STRATEGY.md), [`AUTH_DB_SCHEMA.md`](./AUTH_DB_SCHEMA.md), [`../architecture/AUTH_ARCHITECTURE.md`](../architecture/AUTH_ARCHITECTURE.md), [`../operations/ENVIRONMENT.md`](../operations/ENVIRONMENT.md)

**Decision:** DL-044 — Password and Credential Policy (ACCEPTED)

---

## 1. Overview

TOCS authenticates human users with **email + password**. This document defines:

1. How passwords are hashed and verified  
2. Password complexity and rejection rules  
3. Login failure tracking and account lockout  
4. Account lifecycle statuses  
5. One-time initial admin bootstrap  
6. Sensitive-data handling for credentials  

**Raw passwords are never stored.** Only `users.password_hash` persists in PostgreSQL ([`AUTH_DB_SCHEMA.md`](./AUTH_DB_SCHEMA.md)). Token issuance after successful login follows [`AUTH_TOKEN_SESSION_STRATEGY.md`](./AUTH_TOKEN_SESSION_STRATEGY.md).

---

## 2. Password hashing

### 2.1 Primary algorithm: Argon2id

| Parameter | Value | Notes |
|-----------|-------|-------|
| Algorithm | **Argon2id** (RFC 9106) | Preferred over Argon2i/d for password hashing |
| Memory (`m`) | **65536** KiB (64 MiB) | OWASP-aligned baseline |
| Iterations (`t`) | **3** | Time cost |
| Parallelism (`p`) | **4** | Threads |
| Output length | **32** bytes | Encoded in PHC string format |
| Salt | **16** bytes random per password | Unique per hash; never reused |
| Encoding | PHC string (e.g. `$argon2id$v=19$m=65536,t=3,p=4$...`) | Stored in `users.password_hash` (`VARCHAR(255)`) |

**Verification:** Use constant-time compare of recomputed hash against stored PHC string. Never compare plaintext to hash with timing leaks.

### 2.2 bcrypt fallback (exception only)

| Condition | Policy |
|-----------|--------|
| When | Argon2id library unavailable at runtime **or** platform compatibility issue documented in implementation |
| Algorithm | **bcrypt** with cost factor **12** minimum |
| Scope | New hashes only while fallback active; document migration back to Argon2id when resolved |
| Default | **Do not** use bcrypt if Argon2id is available |

### 2.3 Storage rules

| Rule | Policy |
|------|--------|
| Plaintext password | **Never** stored, logged, or returned |
| `password_hash` | DB column only; **never** logged, never in API responses |
| Re-hash on login | Optional upgrade path: if stored hash uses deprecated params, re-hash with current Argon2id params after successful verify (implementation milestone) |

---

## 3. Password validation (create / change)

Applies when setting or changing a password (bootstrap, admin create user, future password-change API).

### 3.1 Length and composition

| Rule | Policy |
|------|--------|
| Minimum length | **12** characters |
| Maximum length | **128** characters (prevent DoS on hash) |
| Passphrases | **Allowed** — length ≥ 12 satisfies minimum |
| Character categories | At least **2** of: letters (any case), digits, symbols (non-alphanumeric) |
| Unicode | Allowed; normalize to NFC before validation and hashing |

### 3.2 Rejection rules

Reject password if:

| Check | Policy |
|-------|--------|
| Email-as-password | Matches user email (case-insensitive) or local-part only |
| Service names | Contains obvious tokens: `tocs`, `password`, `admin`, `123456`, `qwerty` (extend blocklist in implementation) |
| Company name | Matches assigned company `name` or normalized slug (when company context known at set-password time) |
| Common passwords | Top-N breach list check **deferred** (see §10) |

Validation errors return **generic** messages to clients (see §9); field-level detail only in server logs at `debug` without password content.

---

## 4. Login failure policy

### 4.1 Tracking

| Aspect | Policy |
|--------|--------|
| Scope | Per **user account** (by email lookup) |
| Counter | Increment on failed password verify |
| Window | Rolling **15 minutes** from first failure in current streak |
| Success | **Reset** failure counter and window on successful login |
| Unknown email | Same generic error as wrong password; optionally increment a separate IP-based rate limit (implementation) without revealing account existence |

### 4.2 Lockout threshold

| Trigger | Action |
|---------|--------|
| **5** failed attempts within **15 minutes** | Account enters **LOCKED** state (see §5) |
| Lock duration | **15 minutes** from lock event |
| After lock expires | Status returns to prior non-lock state (typically `ACTIVE`); failure counter reset |
| During lock | Login attempts rejected with generic **401**; no password verify (fail fast) |

### 4.3 Response contract

| Situation | HTTP | Client message (example) |
|-----------|------|--------------------------|
| Wrong password | 401 | `Invalid email or password` |
| Locked account | 401 | `Invalid email or password` (same — do not reveal lock) |
| Suspended / invited | 401 | `Invalid email or password` |
| Rate limited (IP) | 429 | `Too many requests` |

Internal logs may record `user_id`, lock reason, and attempt count at **warn** — never password or hash.

---

## 5. Account status

Canonical `user_status` enum for credential and login policy (**v1.3.3 supersedes** `PENDING` in v1.3.1 schema design doc when SQL is applied):

| Status | Login allowed | Description |
|--------|:-------------:|-------------|
| `ACTIVE` | Yes | Normal operational account |
| `INVITED` | No | Account created; password not yet set or invitation incomplete (email invite deferred) |
| `SUSPENDED` | No | Admin-disabled; login rejected until restored to `ACTIVE` |
| `LOCKED` | No | Temporary lockout from §4; auto-expires to previous status after 15 minutes |

### 5.1 Status transitions (credential-related)

```
INVITED ──(set password / activate)──▶ ACTIVE
ACTIVE ──(5 failures / 15m)──────────▶ LOCKED
LOCKED ──(15m elapsed)────────────────▶ ACTIVE
ACTIVE ──(admin suspend)──────────────▶ SUSPENDED
SUSPENDED ──(admin restore)───────────▶ ACTIVE
```

**Note:** `LOCKED` may be implemented as `status = LOCKED` or as `locked_until TIMESTAMPTZ` with `status` remaining `ACTIVE` — implementation milestone chooses one model; external behavior must match this policy.

Only `ACTIVE` users receive JWT + refresh session on successful login.

---

## 6. Initial admin bootstrap

First human operator in a fresh environment is created via **one-time bootstrap** — not a hardcoded seed password.

### 6.1 Mechanism

| Aspect | Policy |
|--------|--------|
| Delivery | CLI command (e.g. `npm run auth:bootstrap-admin`) or approved seed script — single execution |
| Idempotency | If admin already exists (by email or `SUPER_ADMIN` membership), **abort** with clear message; do not overwrite |
| Production default password | **Prohibited** — no `admin` / `password` / `changeme` defaults in code or docs |

### 6.2 Required environment variables

Bootstrap **must not run** unless all are explicitly set:

| Variable | Required | Purpose |
|----------|:--------:|---------|
| `BOOTSTRAP_ADMIN_EMAIL` | Yes | Initial admin login email |
| `BOOTSTRAP_ADMIN_PASSWORD` | Yes | Initial password (must pass §3 validation) |
| `BOOTSTRAP_ADMIN_NAME` | Yes | Display name |
| `BOOTSTRAP_CONFIRM` | Yes | Must equal `I_UNDERSTAND` (or similar explicit token) to prevent accidental run |

Optional:

| Variable | Purpose |
|----------|---------|
| `BOOTSTRAP_COMPANY_ID` | Link `SUPER_ADMIN` membership to existing company UUID |

### 6.3 Bootstrap outcome

1. Insert `users` row: `status = ACTIVE`, Argon2id `password_hash`.  
2. Insert `company_memberships` with `role = SUPER_ADMIN` (company per env or default internal org — implementation).  
3. Write **`audit_logs`** row: action `BOOTSTRAP_ADMIN_CREATED`, `actor_user_id` = new user or system sentinel, metadata `{ email }` only — no password.  
4. Log at **info**: bootstrap completed for email (not password).  

Bootstrap does **not** issue JWT; operator must use normal login flow after bootstrap.

---

## 7. Password reset

| Item | Policy |
|------|--------|
| Self-service email reset | **Deferred** — not in Auth MVP |
| Forgot-password API | **Not implemented** in v1.3.x foundation |
| Admin-assisted reset | **Future scope** — admin sets temporary password or activation link; document in V2 admin API spec |
| Token/session invalidation on reset | When implemented: revoke **all** sessions for user (same as logout all) |

---

## 8. Sensitive data policy

| Data | Policy |
|------|--------|
| Raw password | Never log, never persist, never return in API |
| `password_hash` | Never log, never return in API (including `GET /auth/me`) |
| Login request body | Redact `password` in any debug HTTP logging |
| Validation errors | Do not expose “password too short” vs “missing symbol” to unauthenticated clients in login path; acceptable on authenticated password-change with auth |
| Credential errors | Single generic message for login failure (§4.3) |
| Audit | Record login success/failure events without secrets ([`LOGGING.md`](../operations/LOGGING.md) redaction) |

---

## 9. Integration with auth stack

```
Login request
    │
    ▼
[Rate limit / IP guard] (optional)
    │
    ▼
[Lookup user by email]
    │
    ├─ not found ──▶ generic 401
    │
    ▼
[Check status: ACTIVE only]
    │
    ├─ INVITED / SUSPENDED / LOCKED ──▶ generic 401
    │
    ▼
[Verify password — Argon2id]
    │
    ├─ fail ──▶ increment failures; maybe LOCKED ──▶ generic 401
    │
    ▼
[Reset failure counter]
    │
    ▼
[AuthService — issue JWT + session]  ← AUTH_TOKEN_SESSION_STRATEGY.md
```

**Layer placement:** Password verify in `AuthService` (or dedicated `CredentialService`); Repository loads `password_hash` only; Action never touches hashes.

---

## 10. Deferred scope

Not in v1.3.3 strategy implementation:

| Item | Notes |
|------|-------|
| Password reset email | V2 |
| 2FA / MFA | V2 |
| Breach password database (HIBP) | V2 |
| Device trust / remember device | V2 |
| SSO / OAuth | V2 |
| Password history (prevent reuse) | V2 |
| Argon2id param tuning via env | Optional implementation |

---

## 11. Implementation gate

- No changes to `db/schema/*.sql` or `schema.prisma` in v1.3.3.  
- Enum reconciliation (`PENDING` → `INVITED`, add `LOCKED`) occurs in approved SQL apply milestone.  
- Integration suite **212/212** unchanged until login implementation milestone.

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-23 | v1.3.3 — Password & credential policy (DL-044); documentation only |
