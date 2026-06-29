# TOCS Release & Deployment Runbook

## Purpose

Define how TOCS Backend is released, deployed, verified, and rolled back as an **operational unit** — without implementing deployment automation in this milestone.

**Scope:** Documentation and operator procedures only. No CI workflow changes, no deploy scripts, no Auth/RBAC.

**Related:** [`../releases/RELEASE_GOVERNANCE.md`](../releases/RELEASE_GOVERNANCE.md), [`ENVIRONMENT.md`](./ENVIRONMENT.md), [`BACKUP_AND_RESTORE.md`](./BACKUP_AND_RESTORE.md), [`INCIDENT_RESPONSE.md`](./INCIDENT_RESPONSE.md), [`../DB_APPLY_ORDER.md`](../DB_APPLY_ORDER.md)  
**Decision:** DL-039 — Release and Deployment Governance (ACCEPTED)

---

## 1. Release criteria

A release candidate on `main` is **accepted for tagging** only when all gates pass:

| Gate | Command / check | Required result |
|------|-----------------|-----------------|
| **CI green** | GitHub Actions workflow `CI` on `main` | Latest run `completed` / `success` |
| **Typecheck** | `npm run typecheck` | Exit `0` |
| **Integration** | `npm run test:integration` | **212 pass / 0 fail / 0 skip** |
| **DB schema order** | Review `DB_APPLY_ORDER.md` | 3-file apply order unchanged or documented in CHANGELOG |
| **CHANGELOG** | `CHANGELOG.md` | `[Unreleased]` or new `[X.Y.Z]` section updated |
| **RELEASE_NOTES** | `RELEASE_NOTES.md` | Operator summary for the tag |
| **Release doc** | `docs/releases/vX.Y.Z.md` | Preconditions and commands for operators |
| **Decision log** | `DECISION_LOG.md` | DL entry when governance or policy changes |

### Tag creation criteria

1. All release criteria above satisfied on the **exact commit** to tag.
2. Tag format: **`vMAJOR.MINOR.PATCH`** only (DL-035) — no suffixes, no 4-part tags.
3. Tag is **annotated**: `git tag -a vX.Y.Z -m "..."`.
4. Tag is **immutable** after publish — fixes ship as next patch.
5. GitHub Release body sourced from `RELEASE_NOTES.md`.

**Failed CI on `main` → release forbidden** until green (§6).

---

## 2. Version / tag policy

| Line | Purpose | Examples |
|------|---------|----------|
| **v1.0.x** | Core MVP baseline / hotfix | `v1.0.0` Accepted backend + HTTP |
| **v1.1.x** | CI foundation (engineering; consolidated under acceptance story) | CI workflow, integration gate |
| **v1.2.x** | Production hardening | Env, logging, health, ops runbooks |
| **v1.3.x** | Auth/RBAC (future — not MVP) | Reserved |
| **v2.x** | Expansion features (future) | Breaking or major scope |

### Tag rules (DL-035, DL-039)

| Rule | Policy |
|------|--------|
| Format | `vMAJOR.MINOR.PATCH` only |
| **4-digit tags** | **Forbidden** (e.g. `v1.2.2.1`) |
| Suffix tags | **Forbidden** for new tags (`-core-mvp-accepted`, etc.) |
| Internal batches | Record in `CHANGELOG.md` + `docs/releases/vX.Y.Z.md` — **not** as Git tags |

### Production Hardening doc batches (changelog-only)

| Batch | Scope |
|-------|--------|
| v1.2.3 | Startup env validation, local port policy |
| v1.2.4 | Health metadata, test env defaults |
| v1.2.5 | Backup & restore runbook |
| v1.2.6 | Error handling & incident response |
| v1.2.7 | Release & deployment runbook (this document) |

---

## 3. Deployment checklist

Complete before directing production traffic to a new build.

### 3.1 Environment variables

| Variable | Production |
|----------|------------|
| `DATABASE_URL` | Production cluster; least-privilege user; from secret manager |
| `NODE_ENV` | `production` |
| `PORT` | Matches container / reverse proxy |
| `LOG_LEVEL` | `info` or `warn` (not `debug`) |
| `JWT_SECRET` | **Required** — CSPRNG; unique vs other envs |
| `SESSION_SECRET` | **Required** — distinct from JWT |
| `ENCRYPTION_KEY` | **Required** — distinct from JWT/SESSION |

Startup validation (`validateEnvironment()`) must pass before the HTTP listener binds.

### 3.2 Build steps

```bash
npm ci
npx prisma generate   # ORM client only — no migrate / db push
npm run typecheck
```

### 3.3 Database schema

See §4 — apply SQL **before** or **in lockstep** with app deploy; backup required first.

### 3.4 Health check

```bash
curl -sf http://<host>:<port>/api/v1/health
```

Expect HTTP **200**, JSON `"ok": true`, `"environment": "production"`.  
Health endpoint does **not** query the database — also verify DB separately (§5.5).

### 3.5 Rollback point

Before deploy, record:

- [ ] Previous **Git tag** and commit SHA in production
- [ ] Previous **container image** digest (if applicable)
- [ ] **Database backup** timestamp ([`BACKUP_AND_RESTORE.md`](./BACKUP_AND_RESTORE.md))
- [ ] **Schema version** / SQL files applied (git SHA of `db/schema/`)

---

## 4. DB schema deployment policy

| Rule | Policy |
|------|--------|
| **Prisma migrate** | **Forbidden** |
| **Prisma db push** | **Forbidden** |
| **Source of truth** | PostgreSQL SQL files in repository |
| **Apply order** | 1 → 2 → 3 only |

```
1. db/schema/tocs_base_schema.sql
2. db/schema/tocs_supplement.sql
3. db/fixes/tocs_fix_amount_verified.sql
```

### Production apply procedure

1. **Backup required** — daily backup or on-demand `pg_dump` before any schema change ([`BACKUP_AND_RESTORE.md`](./BACKUP_AND_RESTORE.md) §3.3).
2. Apply files in order with `psql … -v ON_ERROR_STOP=1 -f …`.
3. Verify: 15 tables, 6 views (schema smoke in backup runbook §6.2).
4. Deploy application build that matches schema expectations (`prisma generate` only).

**Never** apply archive/patch SQL outside the 3-file order without explicit DECISION_LOG approval.

---

## 5. Rollback policy

### 5.1 Application rollback

1. Stop traffic to new version (load balancer / scale to zero).
2. Redeploy **previous known-good artifact** (image or commit tagged `vX.Y.Z-1`).
3. Confirm `GET /api/v1/health` on rolled-back build.
4. Monitor HTTP logs: `status_code >= 500`.

**Tag-based rollback:** checkout or deploy the prior SemVer tag — do not move an existing tag pointer.

### 5.2 Database rollback

| Scenario | Action |
|----------|--------|
| Schema-only deploy failed mid-apply | Do not leave partial state — restore from pre-change backup (empty DB + 3-file apply + restore data if needed) |
| Bad data migration (future) | Restore from backup taken before migration |
| App rollback, schema unchanged | DB rollback usually **not** required |

Database rollback **always** uses backup restore — there is no down-migration in TOCS.

### 5.3 Restore from backup

Follow [`BACKUP_AND_RESTORE.md`](./BACKUP_AND_RESTORE.md) §4 — empty DB → 3 SQL files → optional data restore.

### 5.4 Rollback verification

| Step | Check |
|------|-------|
| Health | `GET /api/v1/health` → 200, `ok: true` |
| DB connectivity | `SELECT 1` via production read-only check |
| Smoke query | Row counts on `formulas`, `companies` vs baseline |
| Integration (staging) | `212/212` against restored staging DB |
| CI reference | Tag commit must have been CI-green at release time |

---

## 6. GitHub Actions release gate

| Condition | Release allowed |
|-----------|-----------------|
| Latest `main` CI run **success** | Yes |
| CI **failure** or **in progress** | **No** |
| Local-only green (CI red) | **No** |

```powershell
gh run list --branch main --limit 1
# status: completed, conclusion: success
```

Workflow: `.github/workflows/ci.yml` — typecheck + integration (PostgreSQL 16, 3-file schema apply).

**Policy:** Do not tag, deploy to production, or publish GitHub Release while `main` CI is red.

---

## 7. Emergency hotfix flow

For production defects requiring immediate patch outside normal minor release:

1. **Branch** from latest **accepted production tag** (e.g. `v1.2.0`), not from arbitrary `main` unless `main` is known good.
2. **Minimal fix** — no scope expansion, no Auth/V2 features.
3. **Verify locally:** `npm run typecheck`, `npm run test:integration` → 212/212.
4. **Merge to `main`** — wait for **CI green**.
5. **Bump PATCH** only — e.g. `v1.2.0` → `v1.2.1`.
6. Update `CHANGELOG.md`, `RELEASE_NOTES.md`, `docs/releases/vX.Y.Z.md`.
7. **Tag** annotated `vX.Y.Z.PATCH`, push tag, GitHub Release.
8. **Deploy** hotfix build; keep rollback point (§3.5).
9. If schema change required — backup first (§4); hotfix schema changes need explicit approval.

---

## 8. Operator quick reference

```powershell
# Pre-release verification (local)
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
npm run typecheck
npm run test:integration

# CI gate
gh run list --branch main --limit 1

# Post-deploy health
curl -i http://127.0.0.1:3000/api/v1/health

# Tag (after gates pass — example)
git tag -a v1.2.1 -m "TOCS v1.2.1 — hotfix description"
git push origin v1.2.1
```

Full governance: [`../releases/RELEASE_GOVERNANCE.md`](../releases/RELEASE_GOVERNANCE.md).

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-23 | v1.2.7 — Initial release & deployment runbook (Production Hardening) |
