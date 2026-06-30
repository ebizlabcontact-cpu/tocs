# TOCS Project Context

> **Purpose:** Bootstrap new ChatGPT / Cursor conversations with ≥95% project context retention.  
> **Last updated:** 2026-06-23 (Engineering Hardening — Project Context Bootstrap)  
> **Canonical deep specs:** `docs/master/TOCS_MASTER_SPEC.md`, `docs/decisions/DECISION_LOG.md`, `.cursor/rules/tocs-core.mdc`

---

## 1. Project Overview

| Item | Value |
|------|--------|
| **Name** | TOCS — Transaction Operating Control System |
| **Domain** | B2B trade, settlement, logistics, and finance management |
| **Architecture** | **Formula First** — Formula is the sole top-level business unit |
| **Tagline** | Formula = Source of Truth; Formula 1 = Item 1 |

TOCS tracks end-to-end B2B operations: formulas (trades), participants, payments, invoices, logistics, versions, shares, close/settlement, and KPI dashboards — without Deal/Order/Project top-level entities.

---

## 2. Architecture Principles

| Principle | Rule |
|-----------|------|
| **Formula First** | All business flows start from `formula_id`. Never create Deal, Order, Project, Pipeline, Transaction, Contract, SalesOrder, PurchaseOrder as top-level entities. |
| **Formula = Source of Truth** | KPI, profit, receivable, payable, invoice, logistics, share, version, cancel, close derive from Formula. |
| **SQL-first** | PostgreSQL SQL files are schema source of truth. Prisma is ORM mapping only. |
| **Audit log separation** | Sensitive mutations write `audit_logs`; status changes use `formula_status_logs`. |
| **Version = Formula only** | Version-triggering field changes create `formula_versions` + `formula_calculation_snapshots` + `audit_logs` — never direct UPDATE on those fields. |
| **Company horizontal** | Company has no fixed role; role is `formula_participants.role_group` (business) vs `company_memberships.role` (API RBAC). |
| **Layer discipline** | `Action → Service → Repository → Prisma → PostgreSQL` |
| **Scope creep forbidden** | Do not expand MVP/deferred scope without explicit approval. |
| **Deferred policy** | V2 features documented but not implemented until approved. |

---

## 3. Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20 |
| Language | TypeScript |
| HTTP | Fastify |
| Database | PostgreSQL 16 |
| ORM | Prisma (generate only — no migrate/db push) |
| CI | GitHub Actions |
| IDE / AI | Cursor, Claude, ChatGPT |
| Local DB | Docker (`tocs-postgres`) |

---

## 4. Database Policy

### Source of truth

PostgreSQL SQL files — **not** `schema.prisma`.

### Forbidden

- `prisma migrate dev`
- `prisma migrate deploy`
- `prisma db push`

### Allowed

- `prisma validate`
- `prisma generate`
- `prisma db pull` (read-only comparison, when explicitly approved)

### Apply order

```
1. db/schema/tocs_base_schema.sql    — tables, enums, FKs, sequences (incl. auth tables 16–18)
2. db/schema/tocs_supplement.sql     — views, triggers, generated cols, composite FKs
3. db/fixes/tocs_fix_amount_verified.sql
```

See `docs/DB_APPLY_ORDER.md`.

### Auth tables (v1.3.7+)

- Enums: `user_status`, `membership_role`
- Tables: `users`, `company_memberships`, `sessions`

---

## 5. Core MVP Status

| Gate | Status |
|------|--------|
| **Core MVP Backend + HTTP Slice** | **ACCEPTED** (DL-034) |
| **HTTP routes** | **48** (health + 47 business) |
| **Remaining Core gap** | **0** |
| **Integration tests** | **214 / 214 PASS** (212 Core + 2 auth schema/repo) |
| **CI** | **GREEN** on `main` |
| **Release tag** | `v1.0.0-core-mvp-accepted` |

Public endpoint: `GET /api/v1/health` only.

---

## 6. Completed Domains

All domains below have Backend Action + HTTP Route unless noted.

| Domain | Scope |
|--------|--------|
| **Formula** | Create, read, list, by-formula-no, status |
| **PATCH** | Metadata only (content, note, unit) — not version-triggering |
| **Cancel** | Full formula cancel (6 statuses + audit) |
| **Company** | Create, read, list |
| **Participant** | Create, list, read |
| **Payment** | Schedules, records, cancel |
| **Invoice** | Create, list, read, status read/update; internal sync (no HTTP) |
| **Logistics** | Create, list, read, logistics-status |
| **Version** | Create (1-retry), list, read, latest |
| **Share** | Create, update, delete (version-triggered) |
| **Close** | Formula close |
| **Settlement** | Payment-schedule append, settlement notes (DL-033) |
| **Dashboard/KPI** | Confirmed, expected, receivable-payable, participant KPI, unmatched |
| **HTTP layer** | Fastify, request logger, health, handle-action |

---

## 7. Deferred (do not implement without approval)

| Area | Notes |
|------|-------|
| **Auth/RBAC runtime** | Middleware, login API, JWT enforcement on 48 routes — spec complete, code partial |
| **File evidence** | Upload / attachments |
| **Notification** | Push, email alerts |
| **Reopen** | `is_closed TRUE → FALSE` |
| **Undo** | Cancel undo, close undo |
| **Adjustment Formula** | Top-level adjustment entity |
| **Participant order swap** | §2.4 V2 |
| **Partial cancel** | Formula partial cancellation |
| **Version advanced retry** | Multi-retry / exponential backoff |
| **Logistics §5.3 audit_logs** | `audit_logs` on logistics-status (status log only today) |
| **OAuth / SSO / 2FA / API keys** | Auth non-goals (DL-047) |
| **Password reset email** | V2 (DL-044) |

---

## 8. Production Hardening (completed)

| Area | Reference |
|------|-----------|
| Environment | `docs/operations/ENVIRONMENT.md`, `src/config/env.ts` |
| Logging | `src/lib/logger.ts`, `docs/operations/LOGGING.md` |
| Request logger | `src/http/plugins/request-logger.ts` |
| Error handling | `docs/operations/ERROR_HANDLING.md` |
| Incident response | `docs/operations/INCIDENT_RESPONSE.md` |
| CI/CD | `.github/workflows/ci.yml` |
| Backup / release / readiness | `docs/operations/BACKUP_AND_RESTORE.md`, `RELEASE_AND_DEPLOYMENT.md`, `PRODUCTION_READINESS_REVIEW.md` |

**Verdict (DL-040):** Production Hardened Candidate — **Production Ready: NO** (auth enforcement + ops automation deferred).

---

## 9. Local Development

| Item | Value |
|------|--------|
| Docker container | `tocs-postgres` |
| Host port | **5433** → container **5432** |
| `DATABASE_URL` | `postgresql://tocs:<password>@localhost:5433/tocs_db?schema=public` |

**Warning:** Windows native PostgreSQL often uses port **5432**. TOCS Docker uses **5433** to avoid conflict (DL-036).

See `docs/operations/LOCAL_DEVELOPMENT.md`.

### Verification commands

```powershell
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
npm run typecheck
npm run test:integration
```

---

## 10. Auth Progress

### Documentation milestones (ACCEPTED)

| Batch | Deliverable |
|-------|-------------|
| v1.3.0 | `AUTH_RBAC_SPEC.md`, `AUTH_ARCHITECTURE.md` (DL-041) |
| v1.3.1 | `AUTH_DB_SCHEMA.md` (DL-042) |
| v1.3.2 | `AUTH_TOKEN_SESSION_STRATEGY.md` (DL-043) |
| v1.3.3 | `AUTH_CREDENTIAL_POLICY.md` (DL-044) |
| v1.3.4 | `RBAC_PERMISSION_MATRIX.md` (DL-045) |
| v1.3.5 | `ROUTE_PROTECTION_POLICY.md` (DL-046) |
| v1.3.6 | `AUTH_IMPLEMENTATION_PLAN.md` (DL-047) |

### Code milestones (implemented)

| Batch | Deliverable |
|-------|-------------|
| v1.3.7 | Auth DDL in `tocs_base_schema.sql`, Prisma models (DL-048) |
| v1.3.8 | `AuthRepository` — users, memberships, sessions CRUD |
| v1.3.9 | `CredentialService` — Argon2id, validation, lockout (DL-044) |
| v1.3.10 | Bootstrap admin CLI — env-driven SUPER_ADMIN bootstrap (DL-044 §6) |
| v1.3.11 | `AuthService` — credential orchestration without JWT (Phase 3 partial) |
| v1.3.12 | `TokenService` + `SessionService` — JWT + refresh rotation (Phase 4 partial) |
| v1.3.13 | `AuthActions` — auth HTTP action layer (Phase 3 partial) |

### Schema objects live

- **Enums:** `user_status` (`ACTIVE`, `INVITED`, `SUSPENDED`, `LOCKED`), `membership_role` (`SUPER_ADMIN`, `COMPANY_ADMIN`, `MANAGER`, `VIEWER`)
- **Tables:** `users`, `company_memberships`, `sessions`

### Integration gate

**262 / 262 PASS** (includes auth actions login/logout/refresh/me tests).

---

## 11. Current Milestone

### v1.3.13 — Auth HTTP Actions ✅ COMPLETED

| Component | Location | Status |
|-----------|----------|--------|
| `AuthActions` | `src/actions/auth.actions.ts` | Done |
| Integration test | `src/tests/auth.actions.integration.test.ts` | Done |

**Next (Phase 3 remainder — DL-047):** Fastify auth routes — **not started**.

### Explicitly not allowed in v1.3.13 scope (still forbidden until approved)

- Fastify route registration
- Middleware / route protection
- RBAC enforcement
- Core domain modification

---

## 12. Development Rules

1. **SQL-first always** — schema changes in SQL files first; then `schema.prisma` mapping.
2. **Formula First** — no alternate business roots; all flows from Formula.
3. **Deferred = no code** until explicit approval.
4. **Core domain changes** require integration suite green (262/262).
5. **CI green** on `main` before merge.
6. **No scope creep** — touch only requested files; no drive-by refactors.
7. **`formula_no`** — DB DEFAULT `generate_formula_no()` only; never manual assign.
8. **Closed formula** — fully immutable via normal update paths (DL-033, DL-041 rules).

---

## 13. AI Working Rules

Every implementation response should include:

1. **Goal** — what this change achieves  
2. **Changed files** — explicit list  
3. **Implementation scope** — what is in/out  
4. **Forbidden** — what must not be done  
5. **Verification commands** — typecheck, tests  
6. **Git commands** — only when user requests commit  

### End-of-feedback template (Cursor handoff)

```
## Cursor 지시서
<concise implementation instructions>

## 검증 명령어
npm run typecheck
npm run test:integration

## 커밋 명령어
git add <files>
git commit -m "<message>"
```

Do not commit unless the user explicitly asks.

---

## 14. Important Decisions Summary

| ID | Title |
|----|-------|
| **DL-033** | Closed Formula Settlement Policy |
| **DL-034** | Core MVP Backend + HTTP Slice Accepted |
| **DL-038** | Error Handling and Incident Response Policy |
| **DL-043** | JWT and Session Strategy |
| **DL-044** | Password and Credential Policy |
| **DL-045** | RBAC Permission Matrix |
| **DL-046** | Route Protection Policy |
| **DL-047** | Authentication Implementation Plan |
| **DL-048** | Auth DB Schema Implementation |

Full log: `docs/decisions/DECISION_LOG.md`.

---

## 15. Conversation Bootstrap Prompt

Copy-paste to start a new AI session:

```
You are working on TOCS (Transaction Operating Control System).

Read PROJECT_CONTEXT.md and .cursor/rules/tocs-core.mdc before answering.

Current state:
- Core MVP ACCEPTED (DL-034); 48 HTTP routes; gap 0
- Integration 224/224 PASS; GitHub Actions GREEN on main
- Auth foundation docs v1.3.0–v1.3.6 ACCEPTED
- Auth schema v1.3.7 … Token/Session v1.3.12 + AuthActions v1.3.13 IMPLEMENTED
- Next: Fastify auth routes (DL-047)

Non-negotiable:
- Formula First Architecture — Formula is source of truth
- SQL-first — no prisma migrate / db push
- Action → Service → Repository → Prisma
- Deferred features require explicit approval
- No scope creep; impact analysis before changes
- Do not modify Core domain unless explicitly requested

When implementing, state: goal, files, scope, forbidden, verification, git (if asked).
```

---

## Key File Index

| Path | Purpose |
|------|---------|
| `PROJECT_CONTEXT.md` | This file — session bootstrap |
| `docs/master/TOCS_MASTER_SPEC.md` | Master business spec |
| `docs/decisions/DECISION_LOG.md` | All decision records |
| `docs/specs/AUTH_IMPLEMENTATION_PLAN.md` | Auth code phases 1–7 |
| `docs/api/API_MVP_SCOPE.md` | 48-route inventory |
| `prisma/schema.prisma` | ORM mapping (read SQL first) |
| `db/schema/tocs_base_schema.sql` | Base DDL |
| `.cursor/rules/tocs-core.mdc` | Cursor agent rules |
| `CHANGELOG.md` | Release batches |

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-23 | Initial PROJECT_CONTEXT.md — Engineering Hardening bootstrap |
