# TOCS Authentication Database Schema (Design)

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.3.1 (Design only) |
| **Status** | ACCEPTED (DL-042) |
| **Implementation** | **Not applied** — no changes to `db/schema/*.sql`, `schema.prisma`, or migrations in this milestone |

**Related:** [`AUTH_RBAC_SPEC.md`](./AUTH_RBAC_SPEC.md), [`../architecture/AUTH_ARCHITECTURE.md`](../architecture/AUTH_ARCHITECTURE.md), [`../DB_APPLY_ORDER.md`](../DB_APPLY_ORDER.md)

**Decision:** DL-042 — Authentication Database Foundation (ACCEPTED)

---

## 1. Purpose

Define the **minimum PostgreSQL schema** for Authentication and company-scoped RBAC:

1. **users** — identity and credentials  
2. **company_memberships** — user ↔ company role assignment  
3. **sessions** — refresh token persistence  

This design extends the existing TOCS schema (15 business tables) without modifying Core MVP SQL files until an explicit approved apply milestone.

---

## 2. Design principles

1. **SQL-first** — Future DDL lives in a new approved SQL file (e.g. `db/schema/tocs_auth_schema.sql`), applied **after** the existing 3-file order — not via Prisma migrate / db push.
2. **Formula First preserved** — Auth tables are horizontal; they do not replace `formula_participants` or add Deal/Order entities.
3. **Company horizontal** — `companies` remains a participant registry (DL-004); `company_memberships.role` is **API access within a company context**, not `formula_participants.role_group`.
4. **Secrets never stored** — Only password and refresh token **hashes** in DB; JWTs remain stateless.
5. **Minimal v1.3.1** — Three tables only; no OAuth, invitations, or permission builder tables.

---

## 3. Entity relationship

```
┌─────────────┐       1:N        ┌──────────────────────┐
│    users    │─────────────────▶│  company_memberships │
└──────┬──────┘                  └──────────┬───────────┘
       │                                    │
       │ 1:N                                │ N:1
       ▼                                    ▼
┌─────────────┐                  ┌──────────────────────┐
│   sessions  │                  │      companies       │
└─────────────┘                  │   (existing table)   │
                                 └──────────┬───────────┘
                                            │
                                            │ indirect
                                            ▼
                                 ┌──────────────────────┐
                                 │ formula_participants │
                                 │  (company_id FK)     │
                                 └──────────┬───────────┘
                                            │
                                            ▼
                                 ┌──────────────────────┐
                                 │      formulas        │
                                 └──────────────────────┘
```

**Indirect formula access path:**  
`user` → `company_memberships` → `companies.id` → `formula_participants.company_id` → `formulas.id`

Row-level filtering by company is **policy in Service/RbacService** (future), not PostgreSQL RLS in v1.3.1.

---

## 4. Enum: membership role

PostgreSQL ENUM (proposed name: `membership_role`):

| Value | Description |
|-------|-------------|
| `SUPER_ADMIN` | Full access within assigned company context; platform operators may hold membership on internal org company |
| `COMPANY_ADMIN` | User/role management within company; broad write access |
| `MANAGER` | Operational write (formula, participant, logistics, etc.) per API permission map |
| `VIEWER` | Read-only within company scope |

**Note:** These are **membership roles** stored in DB. [`AUTH_RBAC_SPEC.md`](./AUTH_RBAC_SPEC.md) API permission names (`formula:read`, …) are mapped from membership role (+ `SUPER_ADMIN` overrides) in application layer — not duplicated as DB columns in v1.3.1.

---

## 5. Enum: user status

Proposed PostgreSQL ENUM (`user_status`):

| Value | Description |
|-------|-------------|
| `ACTIVE` | May authenticate |
| `SUSPENDED` | Login rejected |
| `PENDING` | Account created; not yet activated (invitation flow deferred) |

---

## 6. Table: `users`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Stable subject for JWT `sub` |
| `email` | `VARCHAR(320)` | `NOT NULL`, `UNIQUE` | Login identifier; case-normalize to lower in Service |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | Argon2id or bcrypt; never plaintext |
| `name` | `VARCHAR(200)` | `NOT NULL` | Display name |
| `status` | `user_status` | `NOT NULL`, `DEFAULT 'ACTIVE'` | |
| `last_login_at` | `TIMESTAMPTZ` | `NULL` | Updated on successful login |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | |

### Indexes (proposed)

| Index | Columns | Purpose |
|-------|---------|---------|
| `users_pkey` | `id` | Primary key |
| `users_email_key` | `email` | Unique login lookup |
| `idx_users_status` | `status` | Admin listing active users |

---

## 7. Table: `company_memberships`

Links a **user** to a **company** with a **membership role**.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | |
| `company_id` | `UUID` | `NOT NULL`, `FK → companies(id)` | Existing Core MVP table |
| `user_id` | `UUID` | `NOT NULL`, `FK → users(id)` | |
| `role` | `membership_role` | `NOT NULL` | See §4 |
| `is_active` | `BOOLEAN` | `NOT NULL`, `DEFAULT TRUE` | Soft disable without delete |
| `joined_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | |

### Constraints (proposed)

| Constraint | Definition |
|------------|------------|
| `uq_company_memberships_company_user` | `UNIQUE (company_id, user_id)` — one membership row per pair |
| `fk_company_memberships_company` | `REFERENCES companies(id)` |
| `fk_company_memberships_user` | `REFERENCES users(id)` |

### Indexes (proposed)

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_company_memberships_user_id` | `user_id` | Load all companies for user at login |
| `idx_company_memberships_company_id` | `company_id` | List members of company |
| `idx_company_memberships_active` | `company_id`, `is_active` | Partial: `WHERE is_active = TRUE` (optional) |

---

## 8. Table: `sessions`

Server-side refresh session records. Access JWTs are **not** stored.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `UUID` | `PRIMARY KEY`, `DEFAULT gen_random_uuid()` | Session id; may appear in JWT refresh claims |
| `user_id` | `UUID` | `NOT NULL`, `FK → users(id)` | |
| `refresh_token_hash` | `VARCHAR(255)` | `NOT NULL`, `UNIQUE` | Hash of refresh token; never store raw token |
| `expires_at` | `TIMESTAMPTZ` | `NOT NULL` | Absolute expiry |
| `revoked_at` | `TIMESTAMPTZ` | `NULL` | Set on logout or reuse detection |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL`, `DEFAULT NOW()` | |

### Indexes (proposed)

| Index | Columns | Purpose |
|-------|---------|---------|
| `idx_sessions_user_id` | `user_id` | Revoke all sessions for user |
| `idx_sessions_expires_at` | `expires_at` | Cleanup job (future) |
| `sessions_refresh_token_hash_key` | `refresh_token_hash` | Lookup on refresh |

### Session validity rule (application)

A session is valid when `revoked_at IS NULL` and `expires_at > NOW()`.

---

## 9. Relationships summary

| From | To | Cardinality | FK |
|------|-----|-------------|-----|
| `users` | `company_memberships` | 1:N | `company_memberships.user_id` |
| `users` | `sessions` | 1:N | `sessions.user_id` |
| `companies` | `company_memberships` | 1:N | `company_memberships.company_id` |
| `companies` | `formula_participants` | 1:N | existing `formula_participants.company_id` |
| `formula_participants` | `formulas` | N:1 | existing |

**Membership → formulas (indirect):**  
A user with active membership on `company_id = X` may be authorized (via future RBAC) to access formulas where ∃ `formula_participants` row with `company_id = X`. This does **not** auto-grant access to all formulas globally.

---

## 10. Apply order (future — not executed in v1.3.1)

When SQL implementation is approved:

```
1. db/schema/tocs_base_schema.sql          (existing)
2. db/schema/tocs_supplement.sql           (existing)
3. db/fixes/tocs_fix_amount_verified.sql   (existing)
4. db/schema/tocs_auth_schema.sql          (NEW — users, enums, memberships, sessions)
```

Update `DB_APPLY_ORDER.md` in that milestone. **Backup required** before production apply ([`BACKUP_AND_RESTORE.md`](../operations/BACKUP_AND_RESTORE.md)).

Prisma: `schema.prisma` models added only after PostgreSQL DDL is source-of-truth approved.

---

## 11. Mapping to API RBAC (DL-041)

| Layer | Source | Example |
|-------|--------|---------|
| DB membership role | `company_memberships.role` | `MANAGER` |
| API permission | `AUTH_RBAC_SPEC` matrix | `formula:create` |
| Resolution | `RbacService` (future) | `MANAGER` + company scope → permission set |

JWT claims (future) may include `memberships: [{ company_id, role }]` — short TTL; server re-validates membership `is_active` on sensitive operations.

---

## 12. Deferred scope

Not in v1.3.1 schema design implementation:

| Item | Notes |
|------|-------|
| OAuth / social login | External IdP tables |
| 2FA | TOTP/WebAuthn credentials table |
| Invitation | `invitations` table + email flow |
| API keys | `api_keys` / service accounts |
| Permission builder | Normalized `permissions`, `role_permissions` tables |
| ABAC | Attribute-based policies |
| Multi-organization | User org switcher, org-level billing |
| `roles` / `user_roles` global tables | Replaced by company-scoped membership model (DL-042) |
| Audit `actor_user_id` on all mutations | Incremental Service wiring |

---

## 13. Security notes

1. **password_hash** — Use Argon2id (preferred) or bcrypt with per-password salt; work factor from platform policy.
2. **refresh_token_hash** — Store SHA-256 or HMAC of refresh token with pepper from `SESSION_SECRET`; compare constant-time.
3. **Cascade deletes** — `ON DELETE RESTRICT` on FKs by default; user delete requires explicit session/membership cleanup policy.
4. **No PII in logs** — Email/password never logged (`LOGGING.md`, `ERROR_HANDLING.md`).
5. **Email uniqueness** — Enforced at DB level.

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-23 | v1.3.1 — Auth DB schema design (DL-042); documentation only |
