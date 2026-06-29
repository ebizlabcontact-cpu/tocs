# TOCS Local Development Guide

## Purpose

Step-by-step guide for running TOCS integration tests against a **local Docker PostgreSQL** instance on Windows, without connecting to the host PostgreSQL service by mistake.

**Related:** [`ENVIRONMENT.md`](./ENVIRONMENT.md) (variable policy), [`../DB_APPLY_ORDER.md`](../DB_APPLY_ORDER.md) (schema apply order), [`../decisions/DECISION_LOG.md`](../decisions/DECISION_LOG.md) (DL-036)

---

## 1. Prerequisites

| Tool | Version / note |
|------|----------------|
| **Node.js** | 20.x (matches CI) |
| **npm** | Bundled with Node |
| **Docker Desktop** | Running; Linux containers enabled |
| **Git** | Clone of TOCS repository |

Optional but recommended:

- **PostgreSQL client** (`psql`) — for manual schema apply and diagnostics
- **PowerShell** — examples below use Windows syntax

Verify Docker:

```powershell
docker version
docker ps
```

---

## 2. Docker PostgreSQL bootstrap

### Port policy (DL-036)

| Instance | Host port | Purpose |
|----------|-----------|---------|
| Windows PostgreSQL service | **5432** | OS-installed Postgres — **do not use for TOCS** |
| TOCS Docker container | **5433** | Maps host `5433` → container `5432` |

Using port **5433** prevents accidental connections to the Windows service and avoids authentication failures caused by wrong credentials on the wrong server.

### Create or recreate the container

From the repository root:

```powershell
docker rm -f tocs-postgres 2>$null

docker run -d `
  --name tocs-postgres `
  -e POSTGRES_USER=tocs `
  -e POSTGRES_PASSWORD=tocs `
  -e POSTGRES_DB=tocs_db `
  -p 5433:5432 `
  postgres:16
```

Wait until Postgres accepts connections:

```powershell
docker exec tocs-postgres pg_isready -U tocs -d tocs_db
```

Expected: `accepting connections`.

### Verify port mapping

```powershell
docker ps --filter name=tocs-postgres
```

Confirm `PORTS` shows `0.0.0.0:5433->5432/tcp`.

---

## 3. DATABASE_URL configuration

Create or edit `.env` at the repository root (gitignored). **Use port 5433** and credentials that match the Docker bootstrap above:

```env
DATABASE_URL="postgresql://tocs:tocs@localhost:5433/tocs_db?schema=public"
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
```

All four variables are required by startup validation (`src/config/env.ts` — v1.2.3).

### Shell override warning

If `DATABASE_URL` is set in the PowerShell session, it **overrides** `.env` (dotenv does not replace existing process env). Before running tests:

```powershell
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
```

Then confirm:

```powershell
# Should be empty or match .env — not an old 5432 URL
echo $env:DATABASE_URL
```

---

## 4. Schema apply order

Apply SQL files **in this order only** on a fresh database. See [`../DB_APPLY_ORDER.md`](../DB_APPLY_ORDER.md) for full rationale.

| Step | File |
|------|------|
| 1 | `db/schema/tocs_base_schema.sql` |
| 2 | `db/schema/tocs_supplement.sql` |
| 3 | `db/fixes/tocs_fix_amount_verified.sql` |

### Apply via Docker (PowerShell)

From repository root:

```powershell
docker cp .\db\schema\tocs_base_schema.sql tocs-postgres:/tmp/tocs_base_schema.sql
docker exec tocs-postgres psql -U tocs -d tocs_db -P pager=off -v ON_ERROR_STOP=1 -f /tmp/tocs_base_schema.sql

docker cp .\db\schema\tocs_supplement.sql tocs-postgres:/tmp/tocs_supplement.sql
docker exec tocs-postgres psql -U tocs -d tocs_db -P pager=off -v ON_ERROR_STOP=1 -f /tmp/tocs_supplement.sql

docker cp .\db\fixes\tocs_fix_amount_verified.sql tocs-postgres:/tmp/tocs_fix_amount_verified.sql
docker exec tocs-postgres psql -U tocs -d tocs_db -P pager=off -v ON_ERROR_STOP=1 -f /tmp/tocs_fix_amount_verified.sql
```

Each step must finish with no errors. Step 2 runs inside a single transaction (`BEGIN` … `COMMIT` in the supplement file).

### Apply via local psql (optional)

If `psql` is installed and `DATABASE_URL` points to port **5433**:

```powershell
$env:DATABASE_URL = "postgresql://tocs:tocs@localhost:5433/tocs_db"
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/schema/tocs_base_schema.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/schema/tocs_supplement.sql
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f db/fixes/tocs_fix_amount_verified.sql
```

---

## 5. Local integration test execution

One-time setup:

```powershell
npm ci
npx prisma generate
```

Before each test run:

```powershell
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
npm run typecheck
npm run test:integration
```

**Success criteria:** `212 pass`, `0 fail`, `0 skip`.

Tests load `.env` via `dotenv/config`. DB-backed suites are skipped only when `DATABASE_URL` is unset (`hasDatabase` guard); a wrong URL causes real failures instead of skip.

---

## 6. Troubleshooting

### Authentication failed against the database server

Typical Prisma / `pg` error when user/password or target server is wrong.

| Cause | Fix |
|-------|-----|
| `DATABASE_URL` uses port **5432** | Change to **5433** (TOCS Docker). See DL-036. |
| Password mismatch | Docker bootstrap uses `tocs` / `tocs`; align `DATABASE_URL` or recreate container with matching `POSTGRES_PASSWORD`. |
| Stale shell `DATABASE_URL` | `Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue` then rerun. |
| Container not running | `docker start tocs-postgres` or recreate per §2. |
| Schema not applied | Re-run §4; empty DB causes relation/view errors, not always auth errors. |

Quick connectivity check:

```powershell
docker exec tocs-postgres psql -U tocs -d tocs_db -c "SELECT 1"
```

### Connection refused on localhost:5433

- Docker Desktop not running.
- Container missing or wrong port mapping — recreate with `-p 5433:5432`.
- Another process bound to 5433 — `docker ps` and choose a free host port; update `DATABASE_URL` consistently.

### Integration tests skip all DB suites (0 pass, many skip)

- `DATABASE_URL` empty in process env **and** missing from `.env`.
- Fix `.env` and clear shell override (§3).

### EnvironmentValidationError at startup

Startup validation (v1.2.3) requires `DATABASE_URL`, `NODE_ENV`, `PORT`, and `LOG_LEVEL`. Add all four to `.env`. See [`ENVIRONMENT.md`](./ENVIRONMENT.md) §5.

### Wrong database / mixed schema version

Drop and recreate:

```powershell
docker exec tocs-postgres psql -U tocs -d postgres -c "DROP DATABASE IF EXISTS tocs_db;"
docker exec tocs-postgres psql -U tocs -d postgres -c "CREATE DATABASE tocs_db;"
```

Then re-apply §4.

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-23 | v1.2.3 — Initial local development guide (Production Hardening) |
