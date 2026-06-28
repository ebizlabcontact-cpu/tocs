# TOCS Release Notes

Release tags follow **Semantic Versioning** (`vMAJOR.MINOR.PATCH`) only.  
Governance: [`docs/releases/RELEASE_GOVERNANCE.md`](docs/releases/RELEASE_GOVERNANCE.md)

**Repository:** [ebizlabcontact-cpu/tocs](https://github.com/ebizlabcontact-cpu/tocs)

---

## Tag index

| Tag | Date | Milestone |
|-----|------|-----------|
| `v1.2.0` | 2026-06-28 | Production Hardening |
| `v1.0.0` | 2026-06-28 | Core MVP Backend + HTTP slice Accepted |

Legacy suffix tags (e.g. `v1.0.0-core-mvp-accepted`, `v1.1.1-ci-minimal`) may exist in history; **do not create new suffix tags.**

---

## v1.2.0 — Production Hardening

**Release date:** 2026-06-28  
**Git tag:** `v1.2.0`  
**Status:** Ready to tag  
**Plan:** [`docs/releases/v1.2.0.md`](docs/releases/v1.2.0.md)

### Summary

Operational hardening for production deploys: environment documentation, structured logging, HTTP request tracing, startup env validation, and extended health check. **No business-domain, DB schema, or API contract changes.**

### Included work (consolidated)

| Area | Deliverables |
|------|----------------|
| Environment | `.env.example`, `docs/operations/ENVIRONMENT.md` |
| Logging | `src/lib/logger.ts`, `src/http/plugins/request-logger.ts`, `docs/operations/LOGGING.md` |
| HTTP observability | Request logger registered in `createServer()` |
| Startup | `src/config/env.ts` — `loadEnvironment()` fail-fast |
| Health | Extended `GET /api/v1/health` (no DB query) |

Internal engineering batch IDs (v1.2.1, v1.2.2, v1.2.2.1, v1.2.3) are documented in `CHANGELOG.md` only.

### Quality gates

| Gate | Result |
|------|--------|
| `npm run typecheck` | Pass |
| Integration suite | **212 / 212**, 0 skip |
| API routes | **48** unchanged |
| Prisma migrate / db push | Not used |

### References

- `CHANGELOG.md` § [1.2.0]
- `DECISION_LOG.md` — DL-035

---

## v1.0.0 — Core MVP Backend + HTTP Slice Accepted

**Release date:** 2026-06-28  
**Git tag:** `v1.0.0`  
**Status:** Accepted  
**Plan:** [`docs/releases/v1.0.0.md`](docs/releases/v1.0.0.md)

### Summary

TOCS Core MVP Backend and HTTP slice are **accepted** as the baseline for Formula-first trade operations: 48 Action-backed HTTP routes, 212 integration tests, green GitHub Actions CI on `main`.

### Core MVP Domains (complete)

Formula (incl. PATCH, cancel), Company, Participant, Payment, Invoice, Logistics, Version, Share, Close, Settlement (DL-033), Dashboard/KPI, HTTP layer.

### HTTP Routes

| Metric | Value |
|--------|------:|
| Action-backed HTTP routes | **48** |
| Remaining Core MVP HTTP gap | **0** |

### Quality gates

| Gate | Result |
|------|--------|
| `npm run typecheck` | Pass |
| Integration suite | **212 / 212**, 0 skip |
| GitHub Actions CI | **SUCCESS** ([run #1](https://github.com/ebizlabcontact-cpu/tocs/actions/runs/28326776089)) |
| DB schema (CI) | SQL 3-file apply order per `DB_APPLY_ORDER.md` |

### Architecture constraints

- Formula is the sole top-level business unit.
- PostgreSQL SQL = schema source of truth; Prisma = ORM mapping only.
- Version-triggering fields → VersionService; closed-formula rules per DL-033.

### Deferred / out of scope

Auth/RBAC, File evidence, Notifications, Reopen, undo flows, Adjustment Formula, participant order swap, partial cancel, version multi-retry, Logistics §5.3 audit_logs.

### Upgrade / deploy notes

1. Apply DB schema per `docs/DB_APPLY_ORDER.md`.  
2. Set `DATABASE_URL` (see `.env.example`).  
3. `npm ci` → `npx prisma generate`.  
4. `npm run test` with database for verification.

### References

- `CHANGELOG.md` § [1.0.0]
- `DECISION_LOG.md` — DL-034

---

## Changelog

Full history: [`CHANGELOG.md`](CHANGELOG.md)
