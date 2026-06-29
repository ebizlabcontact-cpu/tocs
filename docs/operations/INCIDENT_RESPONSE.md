# TOCS Incident Response Runbook

## Purpose

Operational playbooks for common TOCS failures: quick diagnosis, recovery, and verification.

**Scope:** Runbooks only — no notification system, on-call tooling, or code changes in this milestone.

**Related:** [`ERROR_HANDLING.md`](./ERROR_HANDLING.md), [`LOGGING.md`](./LOGGING.md), [`ENVIRONMENT.md`](./ENVIRONMENT.md), [`LOCAL_DEVELOPMENT.md`](./LOCAL_DEVELOPMENT.md), [`BACKUP_AND_RESTORE.md`](./BACKUP_AND_RESTORE.md), [`RELEASE_AND_DEPLOYMENT.md`](./RELEASE_AND_DEPLOYMENT.md)  
**Decision:** DL-038 — Error Handling and Incident Response Policy (ACCEPTED)

---

## 1. General incident workflow

1. **Detect** — CI failure, integration test failure, health check failure, or user report.
2. **Correlate** — Collect `x-request-id` / log `request_id`, timestamp, environment (`NODE_ENV`).
3. **Classify** — See [`ERROR_HANDLING.md`](./ERROR_HANDLING.md) §1.
4. **Recover** — Runbook section below.
5. **Verify** — §7 verification commands.
6. **Document** — Ticket note; DECISION_LOG only if policy changes.

---

## 2. PostgreSQL authentication failure

**Symptoms**

- `Authentication failed against the database server`
- Prisma / `pg` errors on startup or first query
- Integration tests fail connecting to DB

**Likely causes**

| Cause | Environment |
|-------|-------------|
| `DATABASE_URL` points to Windows PG `:5432` instead of Docker `:5433` | Local (DL-036) |
| Stale `$env:DATABASE_URL` overrides `.env` | Local PowerShell |
| Wrong password vs container `POSTGRES_PASSWORD` | Local |
| Rotated production credentials not updated in secret manager | Production |

**Recovery**

```powershell
# Local — clear shell override
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue

# Verify Docker Postgres (port 5433)
docker exec tocs-postgres psql -U tocs -d tocs_db -c "SELECT 1"

# Align .env
# DATABASE_URL=postgresql://tocs:tocs@localhost:5433/tocs_db?schema=public
```

Production: update secret → rolling restart → verify health.

**Verify:** §7.1–7.3

---

## 3. PostgreSQL unavailable

**Symptoms**

- `connection refused`, `ECONNREFUSED`, `pg_isready` fails
- All DB-backed API routes return 500
- Integration tests fail en masse

**Recovery (local Docker)**

```powershell
docker ps --filter name=tocs-postgres
docker start tocs-postgres
# If container missing — recreate per LOCAL_DEVELOPMENT.md §2
docker exec tocs-postgres pg_isready -U tocs -d tocs_db
```

**Recovery (empty / corrupt DB)**

Follow [`BACKUP_AND_RESTORE.md`](./BACKUP_AND_RESTORE.md) §4.3 — drop/create DB, apply 3 SQL files, optional data restore.

**Verify:** §7.1–7.3

---

## 4. Port collision

**Symptoms**

- HTTP server fails to bind: `EADDRINUSE`
- Docker: wrong Postgres port mapping
- Local tests connect to wrong database

**PostgreSQL (local)**

| Service | Port | Policy |
|---------|------|--------|
| Windows PostgreSQL | 5432 | Do not use for TOCS |
| TOCS Docker | **5433** | Standard (DL-036) |

```powershell
docker ps --filter name=tocs-postgres
# Expect 0.0.0.0:5433->5432/tcp
```

**HTTP `PORT`**

- Check `.env` `PORT` vs process already listening on that port.
- Change `PORT` or stop conflicting process.

**Verify:** §7.2 health on configured port.

---

## 5. CI failure (GitHub Actions)

**Symptoms**

- Workflow `CI` red on `push` / `pull_request`
- Typecheck or integration step failed

**Diagnosis**

```powershell
gh run list --limit 5
gh run view <run-id> --log-failed
```

**Common causes**

| Log signal | Fix |
|------------|-----|
| `Missing required environment variable(s): PORT, LOG_LEVEL` | Ensure `NODE_ENV=test` (test defaults apply in `env.ts` v1.2.4+) or set vars in workflow |
| `EnvironmentValidationError` | Check CI `env:` block in `.github/workflows/ci.yml` |
| Schema apply `psql` error | SQL file order / Postgres service health |
| Integration `fail N` | Read subtest name; often DB state or regression |

**Recovery**

1. Reproduce locally: `npm run typecheck` + `npm run test:integration`
2. Fix code/docs on branch; push triggers new run
3. Do not skip failing tests to green CI

**Verify:** §7.4

---

## 6. Integration test failure (local)

**Symptoms**

- `npm run test:integration` — pass &lt; 212 or fail &gt; 0

**Checklist**

- [ ] Docker `tocs-postgres` running on **5433**
- [ ] Schema applied (3 SQL files)
- [ ] `.env` has `DATABASE_URL`, `NODE_ENV`, `PORT`, `LOG_LEVEL`
- [ ] `Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue`
- [ ] `npx prisma generate` after clone

**Recovery**

```powershell
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
npm run typecheck
npm run test:integration
```

For persistent DB corruption: [`BACKUP_AND_RESTORE.md`](./BACKUP_AND_RESTORE.md) §4.3.

**Verify:** §7.3 — expect **212 / 0 / 0**.

---

## 7. Recovery procedures

### 7.1 Database connectivity

```powershell
docker exec tocs-postgres pg_isready -U tocs -d tocs_db
docker exec tocs-postgres psql -U tocs -d tocs_db -c "SELECT 1"
```

### 7.2 Application health (no DB query in endpoint)

```powershell
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
# Start server: npm run … or node src/http/server.ts equivalent
curl -i http://127.0.0.1:3000/api/v1/health
```

Expect `200`, body includes `"ok": true`, header `x-request-id` present.

### 7.3 Full validation suite

```powershell
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
npm run typecheck
npm run test:integration
```

Success: **212 pass, 0 fail, 0 skip**.

### 7.4 CI validation

```powershell
gh run list --branch main --limit 1
```

Success: latest run **`completed` / `success`**.

### 7.5 Restart commands (local)

```powershell
# Postgres container
docker restart tocs-postgres

# Application — stop existing Node process, then:
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
npm run typecheck
# start server per team convention
```

---

## 8. Escalation

| Severity | Condition | Action |
|----------|-----------|--------|
| **S3** | Local dev blocked | Developer self-serve runbook |
| **S2** | CI red on `main` | Fix before next merge; owner: last pusher |
| **S1** | Production DB down / data loss | DBA + platform; invoke [`BACKUP_AND_RESTORE.md`](./BACKUP_AND_RESTORE.md) DR checklist |

Notification/on-call integration: **V2** — not in Core MVP.

---

## 9. Deployment / rollback incident

**Symptoms**

- Post-deploy 500 spike, health check failure, startup `EnvironmentValidationError`
- Wrong version running after deploy
- Schema apply failure mid-migration

**Recovery**

1. **Stop traffic** to new version.
2. **Application rollback** — redeploy prior tag/image ([`RELEASE_AND_DEPLOYMENT.md`](./RELEASE_AND_DEPLOYMENT.md) §5.1).
3. **Database** — if schema changed, restore from pre-deploy backup ([`BACKUP_AND_RESTORE.md`](./BACKUP_AND_RESTORE.md) §4).
4. **Verify** — §7.1–7.3 + health with `environment: production`.

**Release gate reminder:** Do not re-deploy failed release until root cause fixed and **CI green** on fix commit.

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-23 | v1.2.6 — Initial incident response runbooks (Production Hardening) |
| 2026-06-23 | v1.2.7 — Deployment / rollback incident section; link release runbook |
