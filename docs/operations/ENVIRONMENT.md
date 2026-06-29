# TOCS Environment & Configuration

## Purpose

Standardize how TOCS separates **local**, **test**, and **production** environments, which variables are required, how secrets are stored, and how startup must fail when configuration is invalid.

**Scope:** Operations policy and templates only. Auth/RBAC is not implemented in Core MVP; secret variables are **reserved** for a future auth milestone.

**Template:** [`.env.example`](../../.env.example)  
**Related:** [`LOCAL_DEVELOPMENT.md`](./LOCAL_DEVELOPMENT.md), [`docs/DB_APPLY_ORDER.md`](../DB_APPLY_ORDER.md), [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)

---

## 1. Environment kinds

| Environment | `NODE_ENV` | Primary use | Config source |
|-------------|------------|-------------|---------------|
| **local** | `local` (or `development`) | Developer workstation, manual API testing | `.env.local` or `.env` (gitignored) |
| **test** | `test` | GitHub Actions CI, local integration runs | CI job `env`, or `.env.test` (gitignored) |
| **production** | `production` | Deployed API + PostgreSQL | Secret manager / host env — **never** git |

### Separation rules

1. **One database per environment** — never point local/test at production PostgreSQL.
2. **Distinct secrets per environment** — JWT/SESSION/ENCRYPTION keys must not be reused across local, test, and production.
3. **SQL schema** — same 3-file apply order in every environment (`DB_APPLY_ORDER.md`); only connection target differs.
4. **Prisma** — `prisma generate` only; no `migrate` / `db push` in any environment.

---

## 2. Environment matrix

| Variable | local | test (CI) | production | Notes |
|----------|:-----:|:---------:|:----------:|-------|
| `DATABASE_URL` | **R** | **R** | **R** | App + Prisma adapter; missing → current code throws at import |
| `NODE_ENV` | **R** | **R** | **R** | `local` / `test` / `production` |
| `PORT` | **R** | **R** | **R** | Validated at startup (`src/config/env.ts`) |
| `LOG_LEVEL` | **R** | **R** | **R** | Validated at startup (`src/config/env.ts`) |
| `JWT_SECRET` | O | O | **R** | Reserved — Auth not in Core MVP |
| `SESSION_SECRET` | O | O | **R** | Reserved — Auth not in Core MVP |
| `ENCRYPTION_KEY` | O | O | **R** | Reserved — field/token encryption future use |
| `CI` | — | O (auto) | — | `true` on GitHub Actions |

**Legend:** **R** = required for that environment to be considered correctly configured; **O** = optional or has safe default.

---

## 3. Variable reference

### `DATABASE_URL`

- **Description:** PostgreSQL connection string for `@prisma/adapter-pg` + `pg.Pool`.
- **Example (local — Docker on Windows):** `postgresql://tocs:tocs@localhost:5433/tocs_db?schema=public`  
  See **Local PostgreSQL Port Policy** (§9) and [`LOCAL_DEVELOPMENT.md`](./LOCAL_DEVELOPMENT.md).
- **Example (CI):** `postgresql://tocs:tocs_ci_password@localhost:5432/tocs_db`
- **Example (production):** `postgresql://tocs_app:***@db.internal:5432/tocs_prod`
- **Ownership:** Platform / DBA — credentials rotated with DB user policy.
- **Current behavior:** `src/config/env.ts` fail-fast on startup; `src/lib/prisma.ts` also throws if unset when the module loads.

### `NODE_ENV`

- **Description:** Runtime environment label for logging, error verbosity, and future middleware.
- **Values:** `local` | `test` | `production` (use `test` in CI, not `local`).
- **Example:** `NODE_ENV=production`
- **Ownership:** DevOps / deploy pipeline.

### `PORT`

- **Description:** HTTP server bind port for `src/http/server.ts`.
- **Required:** always set (no default at startup validation)
- **Example:** `PORT=8080`
- **Ownership:** DevOps (load balancer must match).

### `LOG_LEVEL`

- **Description:** Minimum log severity (policy standard; implement in logging layer when added).
- **Values:** `error` | `warn` | `info` | `debug` (validated by `src/config/env.ts`)
- **Example:** `LOG_LEVEL=info` (production), `LOG_LEVEL=debug` (local)
- **Ownership:** DevOps + backend lead.

### `JWT_SECRET`

- **Description:** Signing key for JWT access tokens (future Auth/RBAC).
- **Example:** 64-character hex or 32+ byte base64 from CSPRNG — **not** a literal placeholder.
- **Ownership:** Security / platform — production only in secret manager.
- **MVP:** Not read by application code yet; **must** be set before production auth go-live.

### `SESSION_SECRET`

- **Description:** Signing/encryption material for server-side sessions or cookies (future).
- **Must differ from** `JWT_SECRET`.
- **Ownership:** Security / platform.
- **MVP:** Not read by application code yet.

### `ENCRYPTION_KEY`

- **Description:** Application-level symmetric encryption (PII at rest, token wrapping, etc.).
- **Must differ from** `JWT_SECRET` and `SESSION_SECRET`.
- **Ownership:** Security / platform.
- **MVP:** Not read by application code yet.

### `CI` (optional)

- **Description:** Set `true` in GitHub Actions; used to detect automated runs.
- **Example:** `CI=true`
- **Ownership:** CI workflow.

---

## 4. Secret policy

### Never commit

| File / artifact | Policy |
|-----------------|--------|
| `.env` | Gitignored — local secrets |
| `.env.local` | **Commit forbidden** |
| `.env.production` | **Commit forbidden** |
| `.env.test` | **Commit forbidden** if it contains real credentials |
| Production connection strings | Secret manager or encrypted CI secrets only |

**Safe to commit:** `.env.example` (placeholders only), this document, CI workflow with **ephemeral test-only** passwords (e.g. `tocs_ci_password` for disposable Postgres service).

### GitHub Actions secrets

| Secret type | Core MVP CI | Production deploy (future) |
|-------------|-------------|----------------------------|
| `DATABASE_URL` | Job `env` inline (ephemeral Postgres) — OK for CI | Repository or environment secret — **required** |
| `JWT_SECRET` | Not needed (auth not tested) | Environment secret `production` |
| `SESSION_SECRET` | Not needed | Environment secret `production` |
| `ENCRYPTION_KEY` | Not needed | Environment secret `production` |

**Rules:**

1. Do not echo secrets in workflow logs (`DATABASE_URL` print forbidden — already enforced in CI design).
2. Use GitHub **Environments** (`production`) with required reviewers before deploy jobs (future).
3. CI integration job may use service-container credentials; they are not production secrets.
4. Rotate CI test passwords only when workflow definition changes — no rotation schedule for disposable DB.

### Production secret rotation

| Secret | Rotation trigger | Procedure |
|--------|------------------|-----------|
| `DATABASE_URL` password | Quarterly or on personnel change | Create new DB user/password → update secret → rolling restart → revoke old user |
| `JWT_SECRET` | Compromise or annual policy | Issue new tokens only after deploy; short TTL when auth ships; invalidate old sessions |
| `SESSION_SECRET` | With JWT rotation or compromise | Force re-login for all sessions |
| `ENCRYPTION_KEY` | Rare; requires re-encryption plan | Dual-key period — document in auth milestone before implementation |

**Rotation ownership:** Security + DevOps. Every rotation logged in change record (ticket / DECISION_LOG entry if policy change).

---

## 5. Startup validation policy (Fail Fast)

**Implementation:** `src/config/env.ts` — Production Hardening v1.2.3

1. On process start, `loadEnvironment()` calls `validateEnvironment()` before parsing values.
2. If any required variable is missing or empty → throw `EnvironmentValidationError` (variable names only, never values) → caller exits with code 1.
3. HTTP listener must not bind until validation passes (`src/http/server.ts` calls `loadEnvironment()` first).
4. Do not lazy-fail on first request.

### API

| Function | Purpose |
|----------|---------|
| `validateEnvironment()` | Presence check for all required variables; logs secret **presence only** |
| `getRequiredEnvironmentVariables(nodeEnv?)` | Returns required variable names for the given `NODE_ENV` |
| `EnvironmentValidationError` | Thrown when required variables are missing or invalid |

### Required-by-environment (validation matrix)

| Check | local / development | test | production |
|-------|:-------------------:|:----:|:----------:|
| `DATABASE_URL` present | Yes | Yes | Yes |
| `NODE_ENV` present | Yes | Yes | Yes |
| `PORT` present | Yes | Yes | Yes |
| `LOG_LEVEL` present | Yes | Yes | Yes |
| `JWT_SECRET` present | No | No | Yes |
| `SESSION_SECRET` present | No | No | Yes |
| `ENCRYPTION_KEY` present | No | No | Yes |

### Logging policy

- Secret variables (`DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET`, `ENCRYPTION_KEY`): log `[env] VAR=present` only — **never** log values.
- Non-secret variables: validated but not echoed at startup.

### Current implementation status

| Variable | Fail-fast |
|----------|-----------|
| `DATABASE_URL` | **Yes** — `validateEnvironment()` + `src/lib/prisma.ts` |
| `NODE_ENV` | **Yes** — `validateEnvironment()` |
| `PORT` | **Yes** — `validateEnvironment()` |
| `LOG_LEVEL` | **Yes** — `validateEnvironment()` |
| `JWT_SECRET` | **Yes** — production only |
| `SESSION_SECRET` | **Yes** — production only |
| `ENCRYPTION_KEY` | **Yes** — production only |

Integration tests skip DB suites when `DATABASE_URL` is unset (`hasDatabase`); CI and local runs must set all always-required variables.

---

## 6. Local setup quick start

Full walkthrough: [`LOCAL_DEVELOPMENT.md`](./LOCAL_DEVELOPMENT.md).

```powershell
cp .env.example .env
# Set DATABASE_URL to localhost:5433 (TOCS Docker — not Windows PG on 5432)
# Set NODE_ENV, PORT, LOG_LEVEL (required by startup validation)

npm ci
npx prisma generate
npm run typecheck
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
npm run test:integration   # requires DATABASE_URL + applied SQL schema
```

---

## 7. CI setup (reference)

From [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml):

```yaml
env:
  DATABASE_URL: postgresql://tocs:tocs_ci_password@localhost:5432/tocs_db
  CI: true
  NODE_ENV: test
  PORT: "3000"
  LOG_LEVEL: info
```

No JWT/SESSION/ENCRYPTION in CI for Core MVP.

---

## 8. Production checklist (pre-deploy)

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` points to production cluster (least-privilege DB user)
- [ ] `PORT` matches reverse proxy / container port
- [ ] `LOG_LEVEL=info` or `warn`
- [ ] `JWT_SECRET`, `SESSION_SECRET`, `ENCRYPTION_KEY` set from CSPRNG (unique values)
- [ ] Secrets stored in host/secret manager — not in git
- [ ] DB schema applied per `DB_APPLY_ORDER.md`
- [ ] `npx prisma generate` in build image
- [ ] Startup validation passes (`validateEnvironment()` — v1.2.3)
- [ ] Health check: `GET /api/v1/health`

---

## 9. Local PostgreSQL port policy

**Decision:** DL-036 — [`docs/decisions/DECISION_LOG.md`](../decisions/DECISION_LOG.md)

| PostgreSQL instance | Host port | Use with TOCS |
|--------------------|-----------|---------------|
| Windows PostgreSQL service | **5432** | **No** — separate OS install; wrong target for TOCS local dev |
| TOCS Docker (`tocs-postgres`) | **5433** | **Yes** — host `5433` maps to container `5432` |

**Rules:**

1. Local `DATABASE_URL` must use **`localhost:5433`** when using the standard TOCS Docker container.
2. Do not point local integration tests at `localhost:5432` unless you intentionally run Postgres on 5432 with TOCS credentials and schema (not recommended on Windows).
3. CI uses port **5432** inside the Linux runner (no Windows service conflict) — local and CI port numbers may differ; only the connection string for your environment matters.

---

## 10. Local integration test checklist

Before `npm run test:integration`:

- [ ] Docker Desktop running; `tocs-postgres` container up with `5433:5432` mapping
- [ ] Schema applied in order: `tocs_base_schema.sql` → `tocs_supplement.sql` → `tocs_fix_amount_verified.sql`
- [ ] `.env` contains `DATABASE_URL`, `NODE_ENV`, `PORT`, `LOG_LEVEL`
- [ ] `DATABASE_URL` uses **`localhost:5433`** and matches Docker user/password (`tocs` / `tocs` by default)
- [ ] Shell `DATABASE_URL` cleared: `Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue`
- [ ] `npx prisma generate` completed after clone or schema change
- [ ] Expect **212 pass / 0 fail / 0 skip**

Details: [`LOCAL_DEVELOPMENT.md`](./LOCAL_DEVELOPMENT.md).

---

## 11. Troubleshooting — Authentication failed against the database server

Prisma or `pg` may report authentication failure when the client reaches the **wrong** PostgreSQL instance or uses credentials that do not match the server.

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| Auth failed, URL shows `:5432` | Connected to Windows PostgreSQL instead of TOCS Docker | Set `DATABASE_URL` to **`localhost:5433`** (DL-036) |
| Auth failed after `.env` edit | Stale `$env:DATABASE_URL` in PowerShell | `Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue`; rerun tests |
| Auth failed, URL looks correct | Password mismatch vs container | Recreate container with known `POSTGRES_PASSWORD` or align URL |
| `connection refused` on 5433 | Container stopped or wrong mapping | `docker ps --filter name=tocs-postgres`; recreate per `LOCAL_DEVELOPMENT.md` §2 |
| Tests skip DB cases | Empty `DATABASE_URL` | Populate `.env`; do not rely on skip as success |

Verify Docker Postgres directly (bypasses app):

```powershell
docker exec tocs-postgres psql -U tocs -d tocs_db -c "SELECT 1"
```

---

## 12. Secret ownership summary

| Asset | Owner |
|-------|--------|
| PostgreSQL credentials | DBA / Platform |
| `JWT_SECRET`, `SESSION_SECRET`, `ENCRYPTION_KEY` | Security + Platform |
| `PORT`, `LOG_LEVEL`, `NODE_ENV` | DevOps |
| `.env.example` | Engineering (PR review) |
| CI test DB password | Engineering (workflow YAML, disposable) |

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-28 | v1.2.1 — Initial environment & secret policy (Production Hardening) |
| 2026-06-23 | v1.2.3 — Startup fail-fast validation in `src/config/env.ts` |
| 2026-06-23 | v1.2.3 — Local PostgreSQL port policy, integration checklist, troubleshooting; link `LOCAL_DEVELOPMENT.md` |
