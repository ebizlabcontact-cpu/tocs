# TOCS PostgreSQL Backup & Restore Runbook

## Purpose

Define how TOCS PostgreSQL data is backed up, restored, retained, and verified across **local**, **CI**, and **production** environments.

**Scope:** Operations documentation only — no automated backup jobs, schema changes, or application code in this milestone.

**Related:** [`ENVIRONMENT.md`](./ENVIRONMENT.md), [`LOCAL_DEVELOPMENT.md`](./LOCAL_DEVELOPMENT.md), [`../DB_APPLY_ORDER.md`](../DB_APPLY_ORDER.md), [`../decisions/DECISION_LOG.md`](../decisions/DECISION_LOG.md) (DL-037)

**Decision:** DL-037 — PostgreSQL Backup and Restore Policy (ACCEPTED)

---

## 1. Backup strategy

| Environment | Database target | Strategy | Owner |
|-------------|-----------------|----------|-------|
| **Local** | Docker `tocs-postgres` on `localhost:5433` | Manual `pg_dump` before destructive work; **latest dump only** retained on disk | Developer |
| **CI** | Ephemeral Postgres 16 service container | **No backup** — database is recreated from SQL files on every run | CI pipeline |
| **Production** | Managed PostgreSQL cluster | Automated **daily** logical backups, **weekly** snapshots, **monthly** archive to long-term storage | Platform / DBA |

### Principles

1. **Never restore production data into local or CI** — environments stay isolated (`ENVIRONMENT.md` §1).
2. **Schema source of truth** remains the 3 SQL files in `DB_APPLY_ORDER.md`; dumps are for **data** recovery, not schema drift.
3. Backups contain credentials-adjacent data — treat dump files like secrets (gitignored, encrypted at rest in production).
4. Use **`pg_dump` / `pg_restore` or `psql`** — TOCS does not use Prisma Migrate; do not rely on ORM tooling for backup/restore.

---

## 2. Dump naming convention

```
tocs_{environment}_{YYYYMMDD}_{HHmmss}.sql
```

| Token | Values |
|-------|--------|
| `environment` | `local` \| `ci` \| `production` |
| `YYYYMMDD` | UTC or local date (document in run ticket) |
| `HHmmss` | Time of dump start |

**Examples:**

- `tocs_local_20260629_143000.sql`
- `tocs_production_20260629_020000.sql`

**Local storage (recommended):**

```text
./backups/          # gitignored — add to .gitignore if not present
  tocs_local_latest.sql   # optional symlink or copy of most recent dump
```

Local policy: keep **one latest** file; delete or overwrite previous manual dumps.

---

## 3. PostgreSQL backup commands

### 3.1 Local — `pg_dump` via host (port 5433)

Requires `pg_dump` on PATH and `DATABASE_URL` pointing at TOCS Docker Postgres:

```powershell
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outFile = ".\backups\tocs_local_$timestamp.sql"
New-Item -ItemType Directory -Force -Path .\backups | Out-Null

pg_dump "postgresql://tocs:tocs@localhost:5433/tocs_db" `
  --format=plain `
  --no-owner `
  --no-acl `
  --file=$outFile

Copy-Item $outFile .\backups\tocs_local_latest.sql -Force
```

### 3.2 Local — `docker exec pg_dump`

No host `pg_dump` required:

```powershell
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outFile = ".\backups\tocs_local_$timestamp.sql"
New-Item -ItemType Directory -Force -Path .\backups | Out-Null

docker exec tocs-postgres pg_dump -U tocs -d tocs_db --no-owner --no-acl > $outFile

Copy-Item $outFile .\backups\tocs_local_latest.sql -Force
```

### 3.3 Production — logical backup (operator)

Run from a host with network access to production PostgreSQL and credentials from secret manager:

```bash
timestamp=$(date -u +%Y%m%d_%H%M%S)
pg_dump "$DATABASE_URL" \
  --format=custom \
  --file="tocs_production_${timestamp}.dump"
```

Upload to object storage / backup vault per platform policy. **Do not commit dump files.**

### 3.4 CI

CI Postgres is **ephemeral**. Backup is **not performed**. Recovery = re-run workflow (schema apply + integration tests).

---

## 4. Restore commands

### 4.1 Restore into existing database (local)

**Warning:** Restoring a plain SQL dump into a non-empty database may fail on duplicate objects. Prefer **empty DB restore** (§4.3) for full recovery.

```powershell
# Plain SQL dump created by §3.1 or §3.2
psql "postgresql://tocs:tocs@localhost:5433/tocs_db" -v ON_ERROR_STOP=1 -f .\backups\tocs_local_latest.sql
```

Docker exec variant:

```powershell
Get-Content .\backups\tocs_local_latest.sql | docker exec -i tocs-postgres psql -U tocs -d tocs_db -v ON_ERROR_STOP=1
```

### 4.2 Production restore (operator)

1. Schedule maintenance window and stop application traffic.
2. Restore from latest verified backup (custom format example):

```bash
pg_restore --clean --if-exists --no-owner --no-acl \
  -d "$DATABASE_URL" tocs_production_YYYYMMDD_HHmmss.dump
```

3. Run verification (§6) before reopening traffic.
4. Log incident + restore ticket; update DECISION_LOG if policy changes.

### 4.3 Empty database restore procedure

Use when the database is corrupt, schema is unknown, or a clean slate is required.

**Step 1 — Drop and recreate database (local Docker example):**

```powershell
docker exec tocs-postgres psql -U tocs -d postgres -c "DROP DATABASE IF EXISTS tocs_db;"
docker exec tocs-postgres psql -U tocs -d postgres -c "CREATE DATABASE tocs_db;"
```

**Step 2 — Apply schema (required even if restoring data dump):**

Follow [`DB_APPLY_ORDER.md`](../DB_APPLY_ORDER.md) or [`LOCAL_DEVELOPMENT.md`](./LOCAL_DEVELOPMENT.md) §4:

1. `db/schema/tocs_base_schema.sql`
2. `db/schema/tocs_supplement.sql`
3. `db/fixes/tocs_fix_amount_verified.sql`

**Step 3 — Restore data (optional):**

If recovering **data** from a logical dump taken **after** schema was applied:

```powershell
psql "postgresql://tocs:tocs@localhost:5433/tocs_db" -v ON_ERROR_STOP=1 -f .\backups\tocs_local_latest.sql
```

If recovering from **schema-only** loss with no data dump, stop after Step 2.

---

## 5. Retention policy

| Environment | Retention | Notes |
|-------------|-----------|-------|
| **Local** | **Latest dump only** | Developer workstation; no long-term archive |
| **CI** | **Ephemeral** | Container destroyed after job; no retention |
| **Production** | **Daily** logical backups (≥ 7 days hot) | Automated job + monitoring |
| | **Weekly** snapshots | Point-in-time recovery tier (platform-dependent) |
| | **Monthly** archive | Cold storage; compliance / audit retention per org policy |

Production retention numbers are minimum policy targets — adjust with DBA and compliance requirements.

---

## 6. Verification

After every restore (or scheduled production backup test restore to staging):

### 6.1 Row count checks

```powershell
docker exec tocs-postgres psql -U tocs -d tocs_db -P pager=off -c "
SELECT 'formulas' AS table_name, COUNT(*) FROM formulas
UNION ALL SELECT 'companies', COUNT(*) FROM companies
UNION ALL SELECT 'formula_participants', COUNT(*) FROM formula_participants
UNION ALL SELECT 'formula_payment_records', COUNT(*) FROM formula_payment_records
UNION ALL SELECT 'formula_invoices', COUNT(*) FROM formula_invoices;
"
```

Compare counts to pre-backup baseline or expected staging values. Zero rows may be valid for fresh schema-only recovery.

### 6.2 Schema smoke

```powershell
docker exec tocs-postgres psql -U tocs -d tocs_db -P pager=off -c "
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY 1;
"

docker exec tocs-postgres psql -U tocs -d tocs_db -P pager=off -c "
SELECT COUNT(*) AS view_count
FROM information_schema.views
WHERE table_schema = 'public';
"
```

Expect **15 base tables** and **6 views** per `DB_APPLY_ORDER.md`. Spot-check:

```powershell
docker exec tocs-postgres psql -U tocs -d tocs_db -c "SELECT 1 FROM v_formula_closeable LIMIT 1;"
```

(Empty result is OK if no formulas exist; query must not error.)

### 6.3 Integration test execution

From repository root:

```powershell
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
npm run typecheck
npm run test:integration
```

**Success criteria:** `212 pass`, `0 fail`, `0 skip`.

Optional API smoke:

```powershell
# With server running and .env loaded
curl http://127.0.0.1:3000/api/v1/health
```

---

## 7. Disaster recovery checklist

Use for production incidents or local total DB loss.

- [ ] **Assess scope** — data loss vs schema-only vs full cluster failure
- [ ] **Stop writes** — take app offline or read-only if production
- [ ] **Identify backup** — latest verified daily / weekly / monthly artifact
- [ ] **Provision target DB** — empty PostgreSQL 16 instance, correct `DATABASE_URL`
- [ ] **Apply schema** — 3-file order from `DB_APPLY_ORDER.md` if DB is empty or schema unknown
- [ ] **Restore data** — `pg_restore` or `psql -f` per §4
- [ ] **Row counts** — §6.1 baseline comparison
- [ ] **Schema smoke** — §6.2 tables/views/triggers present
- [ ] **Integration suite** — §6.3 `212/212` on staging before production cutover
- [ ] **Health check** — `GET /api/v1/health` returns `ok: true`
- [ ] **Resume traffic** — update secret manager `DATABASE_URL` if endpoint changed
- [ ] **Post-incident** — ticket, timeline, backup gap analysis, retention review

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-23 | v1.2.5 — Initial backup & restore runbook (Production Hardening) |
