# TOCS Project Context

> **Purpose:** Bootstrap new ChatGPT / Cursor conversations with ≥95% project context retention.  
> **Last updated:** 2026-07-01 (v1.5.x — Productization specs + backend stable)  
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
| **Integration tests** | **343 / 343 PASS** |
| **CI** | **GREEN** on `main` (GitHub Actions) |
| **Release tag** | `v1.0.0-core-mvp-accepted` |

Public endpoint: `GET /api/v1/health` only.

---

## 6. Current State

### Backend Engine Status

| Area | Status |
|------|--------|
| **Core Domain** | Completed |
| **Database** | Completed |
| **HTTP API** | Completed |
| **Auth/RBAC** | Completed |
| **Protected Routes** | Completed |
| **Global Company Context** | Completed |
| **Service-layer Company Scope Filters** | Completed |
| **Backend Engine** | **Stable** |

**Integration gate:** **343 / 343 PASS** · GitHub Actions **GREEN** on `main`.

### Productization Status

| Area | Status |
|------|--------|
| **Dashboard V1 Specification** | Completed (docs only) |
| **Formula Wizard** | Spec Draft (Pending Decisions) |
| **Product UI Shell** | Not Started |
| **Dashboard Module UI** | Not Started |
| **Formula Wizard UI** | Not Started |

---

## 7. Pending Decisions

Items below are **Pending Decision** — not approved for implementation. Do not treat as fixed UX policy.

### Confirmed terminology (profit metrics)

| Term | Status | Reference |
|------|--------|-----------|
| **Estimated Net Profit (예상 순이익)** | **Confirmed** | `FORMULA_WIZARD_SPEC.md` §2.5 |
| **Realized Net Profit (실현 순이익)** | **Confirmed** | `FORMULA_WIZARD_SPEC.md` §2.5 · `DASHBOARD_V1_SPEC.md` §4.4 |
| **Estimated ≠ Realized** (no mixing) | **Confirmed** | Same |

### Dashboard KPI (confirmed v1.5.4)

| Item | Status |
|------|--------|
| **P0 KPI** — 실현 순이익, 미수금, 미지급금, 예정 입·출금, 종결 대기, 계산서 미매칭 | **Confirmed** |
| **Loss policy** — 음수 실현순이익, 별도 손실 카드, 손실 Formula 수, 총 손실액 | **Confirmed** |
| **Profit on Dashboard** — **Realized only**; Estimated excluded | **Confirmed** |
| **P1 KPI** — 월 매출/매입, 회사별·품목별 순이익 등 | **Deferred** (V2+, §4.6) |

See `docs/specs/DASHBOARD_V1_SPEC.md` §4.0–§4.6.

### Formula Wizard

| Item | Status |
|------|--------|
| Share 입력 포함 여부 | **Pending Decision** |
| Invoice 예정 정보 포함 여부 | **Pending Decision** |
| **Realized Net Profit** in Wizard (§12 C) | **Pending Decision** — preview = **Estimated Net Profit** (confirmed) |
| Wizard **Draft** (save / resume / list) | **Deferred** (V1 excluded) — `FORMULA_WIZARD_SPEC.md` §2.6 |

See `docs/specs/FORMULA_WIZARD_SPEC.md` §12 · §14.

---

## 8. Product Principles

| Principle | Rule |
|-----------|------|
| **문서 최소화** | Create or expand docs only when the task requires it; avoid duplicate spec churn. |
| **Formula First 유지** | All product flows anchor on Formula; no alternate business roots. |
| **승인되지 않은 UX 정책 확정 금지** | §7 Pending Decisions remain open until explicit product approval. |
| **Scope Creep 금지** | No backend/API/DB/UI expansion beyond approved milestone scope. |
| **Backend Filter 우선** | Company scope and business rules enforced in Service/Repository — not UI-only filters. |
| **Productization 가치 우선** | In productization phase, pursue designs with clear implementation value; defer speculative UX. |

---

## 9. Completed Domains

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

## 10. Deferred (do not implement without approval)

| Area | Notes |
|------|-------|
| **Auth/RBAC runtime** | ~~Deferred~~ — **Completed** (DL-049); see §13 Auth phase status |
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

## 11. Production Hardening (completed)

| Area | Reference |
|------|-----------|
| Environment | `docs/operations/ENVIRONMENT.md`, `src/config/env.ts` |
| Logging | `src/lib/logger.ts`, `docs/operations/LOGGING.md` |
| Request logger | `src/http/plugins/request-logger.ts` |
| Error handling | `docs/operations/ERROR_HANDLING.md` |
| Incident response | `docs/operations/INCIDENT_RESPONSE.md` |
| CI/CD | `.github/workflows/ci.yml` |
| Backup / release / readiness | `docs/operations/BACKUP_AND_RESTORE.md`, `RELEASE_AND_DEPLOYMENT.md`, `PRODUCTION_READINESS_REVIEW.md` |

**Verdict (DL-040):** Production Hardened Candidate — platform-wide **Production Ready: NO** for non-auth ops automation; **Auth subsystem Production Ready: YES** (DL-049).

---

## 12. Local Development

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

## 13. Auth Progress

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
| v1.3.11 | `AuthService` — login/logout/refresh/getCurrentUser |
| v1.3.12 | `TokenService` + `SessionService` — JWT + refresh rotation |
| v1.3.13 | `AuthActions` — login/logout/refresh/me HTTP action layer |
| v1.3.14 | Auth Fastify HTTP routes — `/api/v1/auth/*` |
| v1.3.15 | Authentication middleware — JWT Bearer, `request.auth` |
| v1.3.16 | RBAC middleware — `requireRole`, `requireCompanyScope` |
| v1.3.17 | Protected routes — 47 business routes + auth/me JWT |

### Auth phase status (DL-049)

| Field | Value |
|-------|--------|
| **Status** | **Completed** |
| **Stable** | **Yes** |
| **Production Ready** | **Yes** |
| **Integration gate** | **343 / 343 PASS** |
| **Decision** | DL-049 — Authentication & Route Protection Completed |

Code milestones v1.3.7–v1.3.17 close DL-047 Implementation Phases 1–6. Phase 7 (extended auth regression / `AUTH_ENFORCE` CI) remains optional V2 scope.

### Schema objects live

- **Enums:** `user_status` (`ACTIVE`, `INVITED`, `SUSPENDED`, `LOCKED`), `membership_role` (`SUPER_ADMIN`, `COMPANY_ADMIN`, `MANAGER`, `VIEWER`)
- **Tables:** `users`, `company_memberships`, `sessions`

### Integration gate

**343 / 343 PASS** (includes protected route, company context middleware, and company scope filter tests).

---

## 14. Current Milestone

### v1.5.1 Formula Wizard Core Design (spec)

| Deliverable | Status |
|-------------|--------|
| [`FORMULA_WIZARD_SPEC.md`](docs/specs/FORMULA_WIZARD_SPEC.md) — 6-step minimal wizard | ✅ Spec draft |
| Pending approval | Share / Invoice / Realized in Wizard / post-create navigation (§12 A–C, §14 #5) — **Draft Deferred** §2.6 |

**Scope:** Documentation only — no backend, API, DB, or UI.

**Integration gate:** **343 / 343 PASS** (unchanged).

**Next milestone (requires approval):** P5 Product UI shell; P6 Dashboard + Formula Wizard UI (§12 sign-off first).

### v1.5.0 Dashboard V1 Specification ✅

| Deliverable | Status |
|-------------|--------|
| [`DASHBOARD_V1_SPEC.md`](docs/specs/DASHBOARD_V1_SPEC.md) — 6 cards, activity, quick actions | ✅ Spec complete |
| [`NAVIGATION_ARCHITECTURE.md`](docs/specs/NAVIGATION_ARCHITECTURE.md) — landing + dashboard nav | ✅ Updated |
| [`PRODUCTIZATION_V1_PLAN.md`](docs/specs/PRODUCTIZATION_V1_PLAN.md) — P3 refresh, P4 shipped | ✅ Updated |
| **DL-051** Dashboard v1 Specification | ✅ ACCEPTED |

**Scope:** Documentation only — no backend, API, DB, or UI.

**Integration gate:** **343 / 343 PASS** (unchanged).

**Next milestone (requires approval):** P5 Product UI shell + P6 Dashboard module implementation.

### v1.4.2 Company Context Scope Filters ✅

| Deliverable | Status |
|-------------|--------|
| `CompanyScopeFilter` + `assertFormulaCompanyScope` | ✅ Shipped |
| Formula / Company list filters (Repository) | ✅ Shipped |
| Dashboard/KPI scoped aggregation | ✅ Shipped |
| Formula child list scope (Payment, Invoice, Logistics, Share, Version, Participant) | ✅ Shipped |
| `requireCompanyContext()` on business list/KPI routes | ✅ Shipped |
| `company-context.scope.integration.test.ts` | ✅ Shipped |

**Behavior:** `request.companyContext` flows Route → Action → Service → Repository. `mode=company` filters by `formula_participants.company_id`; `mode=all` (SUPER_ADMIN only) skips filter. Missing context on business list routes → **400** `Company context required`.

**Integration gate:** **343 / 343 PASS**.

**Next milestone (requires approval):** Product UI shell P5–P6 (Header Company Switcher).

### v1.4.1 Company Context Middleware ✅

| Deliverable | Status |
|-------------|--------|
| `src/http/types/company-context-request.ts` | ✅ Shipped |
| `src/http/plugins/company-context.ts` | ✅ Shipped |
| `src/http/server.ts` — plugin order | ✅ Shipped |
| Company context integration tests | ✅ Shipped |

**Behavior:** Parses `X-Company-Id` / `X-Company-Scope: all`; sets `request.companyContext`; public routes exempt.

**Integration gate:** **320 / 320 PASS** (baseline + company context middleware tests).

### v1.4.0 Productization Foundation — Global Company Context (DL-050) ✅

**Scope:** Documentation only — no backend middleware, Service filters, DB schema, or Product UI.

| Deliverable | Status |
|-------------|--------|
| [`GLOBAL_COMPANY_CONTEXT_POLICY.md`](docs/specs/GLOBAL_COMPANY_CONTEXT_POLICY.md) | ✅ Spec complete |
| [`PRODUCTIZATION_V1_PLAN.md`](docs/specs/PRODUCTIZATION_V1_PLAN.md) | ✅ Plan complete |
| [`NAVIGATION_ARCHITECTURE.md`](docs/specs/NAVIGATION_ARCHITECTURE.md) | ✅ Spec complete |
| [`DASHBOARD_V1_SPEC.md`](docs/specs/DASHBOARD_V1_SPEC.md) | ✅ Spec complete |
| [`ROUTE_PROTECTION_POLICY.md`](docs/specs/ROUTE_PROTECTION_POLICY.md) §6.0–§6.7 | ✅ Extended |
| **DL-050** Global Company Context Policy | ✅ ACCEPTED |

**Core decisions:**

1. Header Company Switcher = **Global Company Context** (all menus, not Dashboard-only).
2. Non–`SUPER_ADMIN` requires `X-Company-Id`; `all` scope forbidden.
3. All business APIs return data within selected company scope (backend enforced).

**Integration gate:** **308 / 308 PASS** (unchanged — docs-only batch).

**Next milestone (requires approval):** Company context middleware; `request.companyContext`; Service-layer list filters; integration tests.

### v1.3.x Auth Phase — CLOSED ✅ (DL-049)

| Phase (DL-047) | Scope | Status |
|----------------|-------|--------|
| Phase 1 | Auth DB schema | ✅ Completed (v1.3.7) |
| Phase 2 | Repository + credentials + bootstrap | ✅ Completed (v1.3.8–v1.3.10) |
| Phase 3 | Auth services + HTTP routes | ✅ Completed (v1.3.11–v1.3.14) |
| Phase 4 | JWT + session rotation | ✅ Completed (v1.3.12) |
| Phase 5 | Authentication middleware | ✅ Completed (v1.3.15) |
| Phase 6 | RBAC + route protection | ✅ Completed (v1.3.16–v1.3.17) |

**Auth:** Status = **Completed** · Stable = **Yes** · Production Ready = **Yes**

**Integration gate:** **308 / 308 PASS**

**Next (optional / V2):** Phase 7 extended regression; `AUTH_ENFORCE` env; cookie refresh transport; signup / password reset; OAuth.

### Explicitly not in Auth MVP (still forbidden until approved)

- Signup / self-registration
- Password reset email flow
- OAuth / SSO / 2FA / API keys
- Cookie-based refresh transport (body `refresh_token` today)
- Central permission-key `RbacService` engine

---

## 15. Development Rules

1. **SQL-first always** — schema changes in SQL files first; then `schema.prisma` mapping.
2. **Formula First** — no alternate business roots; all flows from Formula.
3. **Deferred = no code** until explicit approval.
4. **Core domain changes** require integration suite green (**343 / 343 PASS**).
5. **CI green** on `main` before merge (GitHub Actions).
6. **No scope creep** — touch only requested files; no drive-by refactors.
7. **`formula_no`** — DB DEFAULT `generate_formula_no()` only; never manual assign.
8. **Closed formula** — fully immutable via normal update paths (DL-033, DL-041 rules).
9. **Pending Decisions (§7)** — do not implement or document as fixed until approved.

---

## 16. AI Working Rules

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

## 17. Important Decisions Summary

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
| **DL-049** | Authentication & Route Protection Completed |
| **DL-050** | Global Company Context Policy |
| **DL-051** | Dashboard v1 Specification |

Full log: `docs/decisions/DECISION_LOG.md`.

---

## 18. Conversation Bootstrap Prompt

Copy-paste to start a new AI session:

```
You are working on TOCS (Transaction Operating Control System).

Read PROJECT_CONTEXT.md and .cursor/rules/tocs-core.mdc before answering.

Current state:
- Integration 343 / 343 PASS
- Auth Completed · Stable · Production Ready
- Company Context + Service-layer Filters Completed
- Dashboard V1 docs completed
- Formula Wizard spec draft
- Next: Product UI Shell, Dashboard Module UI, Formula Wizard UI

Non-negotiable:
- 문서 최소화
- 사용자 승인 없는 UX 확정 금지
- Formula First
- SQL-first
- No scope creep

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
| `docs/specs/GLOBAL_COMPANY_CONTEXT_POLICY.md` | Global company context (DL-050) |
| `docs/specs/PRODUCTIZATION_V1_PLAN.md` | Productization v1 phases |
| `docs/specs/NAVIGATION_ARCHITECTURE.md` | Header switcher + shell |
| `docs/specs/DASHBOARD_V1_SPEC.md` | Dashboard v1 (global context) |
| `docs/specs/FORMULA_WIZARD_SPEC.md` | Formula Wizard v1.5.1 (minimal design) |
| `CHANGELOG.md` | Release batches |

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-23 | Initial PROJECT_CONTEXT.md — Engineering Hardening bootstrap |
| 2026-07-01 | v1.5.x — Current State, Productization, Pending Decisions, Product Principles; integration gate 343/343 |
