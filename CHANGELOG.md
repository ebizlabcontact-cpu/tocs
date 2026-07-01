# Changelog

All notable changes to TOCS are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

**Release tags** use [Semantic Versioning](https://semver.org/) only (`vMAJOR.MINOR.PATCH`).  
Internal batches (e.g. Environment, Logging, Health) are recorded here and in `docs/releases/` — not as Git tag suffixes.

See [`docs/releases/RELEASE_GOVERNANCE.md`](docs/releases/RELEASE_GOVERNANCE.md).

---

## [Unreleased]

### Documentation — Production Hardening (changelog-only batches)

Operational runbooks and governance docs; no application or schema code changes.

| Batch | Scope |
|-------|--------|
| v1.2.3 | Local port policy, startup validation docs |
| v1.2.4 | Health response contract, CI env notes |
| v1.2.5 | `BACKUP_AND_RESTORE.md`, DL-037 |
| v1.2.6 | `ERROR_HANDLING.md`, `INCIDENT_RESPONSE.md`, DL-038 |
| v1.2.7 | `RELEASE_AND_DEPLOYMENT.md`, DL-039 release/deploy/rollback governance |
| v1.2.8 | `PRODUCTION_READINESS_REVIEW.md`, DL-040 production readiness assessment |

### Documentation — Auth Foundation v1.3.0 (specification only)

| Batch | Scope |
|-------|--------|
| v1.3.0 | `AUTH_RBAC_SPEC.md`, `AUTH_ARCHITECTURE.md`, DL-041 |
| v1.3.1 | `AUTH_DB_SCHEMA.md`, DL-042 (`users`, `company_memberships`, `sessions`) |
| v1.3.2 | `AUTH_TOKEN_SESSION_STRATEGY.md`, DL-043 (JWT 15m, refresh 14d, rotation) |
| v1.3.3 | `AUTH_CREDENTIAL_POLICY.md`, DL-044 (Argon2id, lockout, bootstrap) |
| v1.3.4 | `RBAC_PERMISSION_MATRIX.md`, DL-045 (membership roles, company scope) |
| v1.3.5 | `ROUTE_PROTECTION_POLICY.md`, DL-046 (48-route protection registry) |
| v1.3.6 | `AUTH_IMPLEMENTATION_PLAN.md`, DL-047 (7-phase execution order) |

Documentation-only batches (v1.3.0–v1.3.6) precede code implementation.

| Batch | Scope |
|-------|--------|
| v1.3.7 | Auth DB schema in `tocs_base_schema.sql`, Prisma models, DL-048 |
| v1.3.8 | `AuthRepository` + integration tests (Phase 2 partial) |
| v1.3.9 | `CredentialService` — Argon2id, validation, lockout (Phase 2 remainder) |
| v1.3.10 | Bootstrap admin CLI — one-time SUPER_ADMIN creation (DL-044 §6) |
| v1.3.11 | `AuthService` — login/logout/refresh/getCurrentUser orchestration |
| v1.3.12 | `TokenService` + `SessionService` — JWT access + refresh rotation (DL-043) |
| v1.3.13 | `AuthActions` — login/logout/refresh/me HTTP action layer |
| v1.3.14 | Auth Fastify HTTP routes — `/api/v1/auth/*` |
| v1.3.15 | Authentication middleware — JWT Bearer, `request.auth` (Phase 5 partial) |
| v1.3.16 | RBAC middleware — `requireRole`, `requireCompanyScope` (Phase 6 partial) |
| v1.3.17 | Protected routes — 47 business routes + auth/me JWT (Phase 6 partial) |

### Auth Phase Closed (v1.3.x — DL-049)

Documentation-only closure batch; no application or schema code changes.

**Status:** Authentication & Route Protection **Completed** · **Stable** · **Production Ready**

| Deliverable | Batch |
|-------------|-------|
| Auth DB Schema | v1.3.7 |
| Auth Repository | v1.3.8 |
| CredentialService | v1.3.9 |
| Bootstrap CLI | v1.3.10 |
| AuthService | v1.3.11 |
| TokenService + SessionService | v1.3.12 |
| Auth HTTP Actions | v1.3.13 |
| Auth HTTP Routes | v1.3.14 |
| Authentication Middleware | v1.3.15 |
| RBAC Middleware | v1.3.16 |
| Protected Routes (47 business) | v1.3.17 |

**Integration gate:** **308 / 308 PASS** · DL-047 Phases 1–6 closed.

No application, schema SQL, middleware, or route implementation in v1.3.0–v1.3.6 batches.

### Documentation — Productization Foundation v1.4.0 (specification only)

Documentation-only batch; no application, schema, middleware, UI, or test changes.

| Batch | Scope |
|-------|--------|
| v1.4.0 | Global Company Context Policy — `GLOBAL_COMPANY_CONTEXT_POLICY.md`, `PRODUCTIZATION_V1_PLAN.md`, `NAVIGATION_ARCHITECTURE.md`, `DASHBOARD_V1_SPEC.md`; `ROUTE_PROTECTION_POLICY.md` §6 extension; **DL-050** |

**Integration gate:** **308 / 308 PASS** (unchanged).

**Forbidden in v1.4.0:** Dashboard-only company filter; per-menu `company_id` query params; Frontend-only scope filtering; Core DB schema changes; Product UI; backend company-context middleware.

**Next (proposed):** Service-layer list filters by `request.companyContext` (v1.4.2+).

### Dashboard V1 Specification v1.5.0

| Batch | Scope |
|-------|--------|
| v1.5.0 | Dashboard V1 full spec — 6 summary cards, Recent Activity, Quick Actions; DL-051 |

**Integration gate:** **343 / 343 PASS** (unchanged — documentation-only batch).

**In scope:** `DASHBOARD_V1_SPEC.md`, `NAVIGATION_ARCHITECTURE.md`, `PRODUCTIZATION_V1_PLAN.md` P3 refresh, DL-051.

**Forbidden:** Backend/API/DB/UI changes; new KPI engine; Formula Wizard; aggregate dashboard API.

**Pending (docs):** Wizard §12 A–C · §14 #5 Pending. Wizard **Draft Deferred** (§2.6). Dashboard **KPI policy confirmed** v1.5.4 (`DASHBOARD_V1_SPEC.md` §4.0–§4.6).

### Profit terminology v1.5.2 (docs)

| Batch | Scope |
|-------|--------|
| v1.5.2 | **Estimated Net Profit** / **Realized Net Profit** definitions confirmed; mixing forbidden; `FORMULA_WIZARD_SPEC.md` §2.5; `DASHBOARD_V1_SPEC.md` §4.4 layout Pending |

**Integration gate:** **343 / 343 PASS** (unchanged — documentation-only).

### Formula Wizard Draft policy v1.5.3 (docs)

| Batch | Scope |
|-------|--------|
| v1.5.3 | Wizard **Draft Deferred** from V1 — no save/auto-save/resume/list/expiry; `FORMULA_WIZARD_SPEC.md` §2.6 |

**Integration gate:** **343 / 343 PASS** (unchanged — documentation-only).

### Dashboard KPI policy v1.5.4 (docs)

| Batch | Scope |
|-------|--------|
| v1.5.4 | P0 KPI (7 cards + loss), P1 deferred; Dashboard **Realized Net Profit only**; Estimated on Wizard/Detail/Preview only |

**Integration gate:** **343 / 343 PASS** (unchanged — documentation-only).

### Navigation IA baseline v1.5.5 (docs)

| Batch | Scope |
|-------|--------|
| v1.5.5 | Productization V1 IA — global nav (Dashboard, Formulas, Companies, Calendar, Reports, Settings); Formula Detail 9 tabs; `NAVIGATION_ARCHITECTURE.md` |

**Integration gate:** **343 / 343 PASS** (unchanged — documentation-only).

### Formula Wizard Core Design v1.5.1

| Batch | Scope |
|-------|--------|
| v1.5.1 | Minimal Formula Wizard spec — 6 steps, Core API commit sequence, Version/Snapshot rules; `FORMULA_WIZARD_SPEC.md` |

**Integration gate:** **343 / 343 PASS** (unchanged — documentation-only batch).

**In scope:** Wizard UX design mapped to existing MVP routes; pending approval items §12.

**Forbidden:** New API/DB; Dashboard/Timeline/Settlement expansion; DL entry (unless §12 resolved separately).

### Company Context Scope Filters v1.4.2

| Batch | Scope |
|-------|--------|
| v1.4.2 | Service-layer company scope filters — Route → Action → Service → Repository; `requireCompanyContext()` on business list/KPI routes; `assertFormulaCompanyScope`; DL-050 filtering rules |

**Integration gate:** **337+ / 337+ PASS** (320 baseline + company scope test suite).

**In scope:** Formula/Company/Payment unmatched/Dashboard KPI list filters; formula child lists (participants, payments, invoices, logistics, shares, versions); `company-context.scope.integration.test.ts`.

**Out of scope:** DB schema, UI, Auth/RBAC policy changes, frontend-only filtering.

### Company Context Middleware v1.4.1

| Batch | Scope |
|-------|--------|
| v1.4.1 | `company-context-request.ts`, `company-context.ts`, `server.ts` plugin order, integration tests |

**Integration gate:** **320 / 320 PASS** (308 baseline + 12 company context tests).

**Out of scope:** Service-layer filtering, Dashboard/Formula query changes, UI, schema.

### Added

- **Release & deployment runbook** — `docs/operations/RELEASE_AND_DEPLOYMENT.md` (release gates, deployment checklist, SQL-first deploy, rollback, hotfix flow, CI release gate).
- **Production readiness review** — `docs/operations/PRODUCTION_READINESS_REVIEW.md` (readiness matrix, go-live recommendation: **Production Hardened Candidate**, **Production Ready: NO**).
- **Auth/RBAC specification** — `docs/specs/AUTH_RBAC_SPEC.md` (roles, resources, permission matrix, JWT/session strategy, security principles).
- **Auth architecture** — `docs/architecture/AUTH_ARCHITECTURE.md` (HTTP layer placement, separation from Formula business roles, phased rollout).
- **Auth database schema (design)** — `docs/specs/AUTH_DB_SCHEMA.md` (users, company_memberships, sessions; membership role enum).
- **JWT & session strategy** — `docs/specs/AUTH_TOKEN_SESSION_STRATEGY.md` (access/refresh TTL, rotation, reuse detection, logout).
- **Password & credential policy** — `docs/specs/AUTH_CREDENTIAL_POLICY.md` (Argon2id, validation, lockout, bootstrap, sensitive-data rules).
- **RBAC permission matrix** — `docs/specs/RBAC_PERMISSION_MATRIX.md` (membership roles, resource actions, company scope, sensitive ops).
- **Route protection policy** — `docs/specs/ROUTE_PROTECTION_POLICY.md` (48-route auth/RBAC/scope registry).
- **Auth implementation plan** — `docs/specs/AUTH_IMPLEMENTATION_PLAN.md` (Phases 1–7, non-goals, gates).
- **Auth schema integration test** — `src/tests/auth.schema.integration.test.ts` (users, memberships, sessions constraints).
- **Auth repository** — `src/repositories/auth.repository.ts` (users, memberships, sessions CRUD).
- **Auth repository integration test** — `src/tests/auth.repository.integration.test.ts`.
- **Credential validation** — `src/utils/credential.validation.ts` (length, categories, blocklist, email/company rejection).
- **Credential lockout store** — `src/services/credential.lockout-store.ts` (in-memory 5/15m policy).
- **Credential service** — `src/services/credential.service.ts` (Argon2id hash/verify, login eligibility, lockout).
- **Credential service integration test** — `src/tests/credential.service.integration.test.ts`.
- **Bootstrap admin CLI** — `src/scripts/bootstrap-admin.ts` (`npm run bootstrap:admin`).
- **Bootstrap admin integration test** — `src/tests/bootstrap-admin.integration.test.ts`.
- **Auth service** — `src/services/auth.service.ts` (login, logout, refresh, getCurrentUser).
- **Auth service integration test** — `src/tests/auth.service.integration.test.ts`.
- **Token service** — `src/services/token.service.ts` (HS256 access JWT, 15m TTL).
- **Session service** — `src/services/session.service.ts` (opaque refresh, HMAC hash, rotation, reuse detection).
- **Token/session integration test** — `src/tests/token.service.integration.test.ts`.
- **Auth actions** — `src/actions/auth.actions.ts` (login, logout, refresh, me).
- **Auth actions integration test** — `src/tests/auth.actions.integration.test.ts`.
- **Auth HTTP routes** — `src/http/routes/auth.routes.ts`.
- **Auth HTTP integration test** — `src/tests/auth.http.integration.test.ts`.
- **Authentication middleware** — `src/http/plugins/authentication.ts` (Bearer JWT, `request.auth` context).
- **Auth request types** — `src/http/types/auth-request.ts` (Fastify `request.auth` decoration).
- **Auth middleware integration test** — `src/tests/auth.middleware.integration.test.ts`.
- **RBAC middleware** — `src/http/plugins/rbac.ts` (`requireRole`, `requireCompanyScope` preHandlers).
- **RBAC middleware integration test** — `src/tests/rbac.middleware.integration.test.ts`.
- **Route protection on 47 business HTTP routes** — `requireRole` + formula/company scope preHandlers per DL-046.
- **Formula scope resolvers** — child resource → formula linkage in `src/http/plugins/rbac.ts`.
- **Protected routes integration test** — `src/tests/protected-routes.integration.test.ts`.
- **HTTP auth test helper** — `src/tests/helpers/http-auth.helper.ts`.

### Company Context Middleware (v1.4.1)

- **company-context-request.ts** — `RequestCompanyContext` type; Fastify `request.companyContext` decoration.
- **company-context.ts** — `X-Company-Id` / `X-Company-Scope: all` parsing; membership validation; public route exempt list.
- **server.ts** — plugin order: request logger → authentication → company context → routes.
- **company-context.middleware.integration.test.ts** — middleware test suite.
- **GLOBAL_COMPANY_CONTEXT_POLICY.md** — v1.4.1 implementation status.
- **PROJECT_CONTEXT.md** — v1.4.1 milestone.

### Productization Foundation (DL-050)

- **DL-050** — Global Company Context Policy; Header Company Switcher applies to all menus.
- **GLOBAL_COMPANY_CONTEXT_POLICY.md** — `request.companyContext`, headers, domain filtering, forbidden patterns.
- **PRODUCTIZATION_V1_PLAN.md** — Productization phases P1–P6.
- **NAVIGATION_ARCHITECTURE.md** — App shell, Header Company Switcher, client request pipeline.
- **DASHBOARD_V1_SPEC.md** — Dashboard uses global context (not Dashboard-only filter).
- **ROUTE_PROTECTION_POLICY.md** — §6.0 global company context; §6.6–§6.7 domain rules.
- **PROJECT_CONTEXT.md** — v1.4.0 milestone; DL-050 in decisions summary.

### Auth Phase Closed (DL-049)

- **DL-049** — Authentication & Route Protection Completed; v1.3.x auth milestone closed.
- **PROJECT_CONTEXT.md** — Auth Status = Completed, Stable = Yes, Production Ready = Yes.
- **AUTH_IMPLEMENTATION_PLAN.md** — Implementation Phases 1–6 marked complete.

### Changed

- `db/schema/tocs_base_schema.sql` — `user_status`, `membership_role` enums; `users`, `company_memberships`, `sessions` tables (v1.3.7).
- `prisma/schema.prisma` — `User`, `CompanyMembership`, `Session` models; `UserStatus`, `MembershipRole` enums.
- `docs/specs/AUTH_DB_SCHEMA.md` — v1.3.7 implemented status; column/FK/index alignment.

- `docs/specs/AUTH_RBAC_SPEC.md` — §8–§9 aligned to v1.3.2 token/session policy.
- `docs/specs/AUTH_RBAC_SPEC.md` — §10 credential policy summary (DL-044).
- `docs/specs/AUTH_RBAC_SPEC.md` — §3/§5/§11 membership roles and matrix summary (DL-045).
- `docs/specs/AUTH_RBAC_SPEC.md` — §12 route protection summary (DL-046).
- `docs/specs/AUTH_RBAC_SPEC.md` — §13 implementation plan summary (DL-047).
- `docs/architecture/AUTH_ARCHITECTURE.md` — doc phases A–G complete; code Phases 1–7 per DL-047.

- `src/http/routes/*.ts` — RBAC preHandlers on all business routes (v1.3.17).
- `src/http/routes/auth.routes.ts` — `GET /api/v1/auth/me` requires JWT; query `user_id` removed (v1.3.17).
- `docs/operations/ENVIRONMENT.md` — production checklist links CI green, backup-before-schema, rollback point.
- `docs/operations/INCIDENT_RESPONSE.md` — deployment / rollback incident section.
- `docs/specs/AUTH_IMPLEMENTATION_PLAN.md` — Phases 1–6 complete; auth phase closure (DL-049).
- `PROJECT_CONTEXT.md` — Auth phase status and milestone closure (DL-049).

### Decision

- `DECISION_LOG.md` DL-039 — Release and Deployment Governance.
- `DECISION_LOG.md` DL-040 — Production Readiness Assessment.
- `DECISION_LOG.md` DL-041 — Authentication and RBAC Foundation.
- `DECISION_LOG.md` DL-042 — Authentication Database Foundation.
- `DECISION_LOG.md` DL-043 — JWT and Session Strategy.
- `DECISION_LOG.md` DL-044 — Password and Credential Policy.
- `DECISION_LOG.md` DL-045 — RBAC Permission Matrix.
- `DECISION_LOG.md` DL-046 — Route Protection Policy.
- `DECISION_LOG.md` DL-047 — Authentication Implementation Plan.
- `DECISION_LOG.md` DL-048 — Auth DB Schema Implementation.
- `DECISION_LOG.md` DL-049 — Authentication & Route Protection Completed.

---

## [1.2.0] — 2026-06-28

### Production Hardening milestone

Operational readiness for deployed environments (no business-domain or API contract changes).

### Added

- **Environment policy** — `.env.example`, `docs/operations/ENVIRONMENT.md` (local / test / production, secret policy, fail-fast policy).
- **Structured logging** — `src/lib/logger.ts` (singleton, `error` / `warn` / `info` / `debug`, sensitive-field redaction, domain event constants).
- **HTTP request logging** — `src/http/plugins/request-logger.ts` (`request_id`, method, url, status, duration, ip).
- **Startup validation** — `src/config/env.ts` (`loadEnvironment()`, `DATABASE_URL` / `NODE_ENV` / `PORT` / `LOG_LEVEL`).
- **Health check extension** — `GET /api/v1/health` returns `status`, `service`, `version`, `environment`, `timestamp` (retains `ok: true`; no DB/Prisma).

### Changed

- `src/http/server.ts` — `loadEnvironment()` on startup; `registerRequestLogger(app)` before routes; `PORT` from validated env.

### Internal batches (changelog only — not Git tags)

| Batch | Scope |
|-------|--------|
| Environment v1.2.1 | `.env.example`, `ENVIRONMENT.md` |
| Logging v1.2.2 | `logger.ts`, `request-logger.ts`, `LOGGING.md` |
| Request logger activation | `server.ts` plugin registration |
| Health + startup validation v1.2.3 | `env.ts`, `health.routes.ts`, `server.ts` |

### Verified

- Integration suite: **212 / 212 / 0 skip** unchanged.
- `npm run typecheck` pass.

### Documentation

- Release: `docs/releases/v1.2.0.md`, `RELEASE_NOTES.md` § v1.2.0.
- Decision: `DECISION_LOG.md` DL-035 (SemVer tag policy).

---

## [1.0.0] — 2026-06-28

### Core MVP Backend + HTTP slice — Accepted

### Added

- **Core MVP Backend + HTTP slice** — Formula-first architecture, Action → Service → Repository → Prisma → PostgreSQL.
- **Action-backed HTTP Routes (48)** — Health, Formula, Payment, Close, Dashboard, Invoice, Version, Share, Settlement, Company, Participant, Logistics.
- **Integration test suite** — 212 tests across 17 `*.integration.test.ts` files (`npm run test:integration`).
- **GitHub Actions CI** — `.github/workflows/ci.yml` on `push` / `pull_request` to `main` (PostgreSQL 16, SQL schema apply, typecheck, integration tests).
- **npm scripts** — `typecheck`, `prisma:generate`, `test:integration`, `test`.

### Core MVP Domains (complete)

| Domain | Scope |
|--------|--------|
| Formula | Create, read, list, PATCH (metadata), cancel |
| Company | Create, read, list |
| Participant | Create, list, read |
| Payment | Schedules, records, cancel |
| Invoice | Create, read, list, status sync (internal), status read |
| Logistics | Create, read, list, logistics-status |
| Version | Create (1-retry policy), read, list, latest |
| Share | Create, update, delete (version-triggered) |
| Close | Close, close-status read |
| Settlement | Payment-schedule append, settlement notes (DL-033) |
| Dashboard / KPI | Confirmed, expected, receivable-payable, participant KPI, unmatched payments |
| HTTP layer | Fastify, health, `handle-action` error mapping |

### Verified

- Integration suite: **212 pass / 0 fail / 0 skip** (local + CI, `--test-concurrency=1`).
- GitHub Actions CI: **SUCCESS** on `main` ([run #1](https://github.com/ebizlabcontact-cpu/tocs/actions/runs/28326776089)).
- Remaining Core MVP gap: **0** (`docs/api/API_MVP_SCOPE.md`).

### Deferred (not in this release)

- Auth / RBAC, File evidence, Notifications
- Reopen, Cancel undo, Close undo, Adjustment Formula
- Participant order swap (§2.4), Formula partial cancel
- Version multi-retry / backoff
- Logistics §5.3 `audit_logs` INSERT (status log only)

### Internal batches (changelog only — not Git tags)

Acceptance Fix Batch 1–3, CI Minimal Implementation (Engineering Hardening v1.1.x) — recorded in git history and DL-034; tag **`v1.0.0`** only.

### Documentation

- `RELEASE_NOTES.md` § v1.0.0, `docs/releases/v1.0.0.md`, DL-034.
