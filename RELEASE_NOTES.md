# TOCS Release Notes

## v1.0.0-core-mvp-accepted — Core MVP Backend + HTTP Slice

**Release date:** 2026-06-28  
**Status:** Accepted  
**Repository:** [ebizlabcontact-cpu/tocs](https://github.com/ebizlabcontact-cpu/tocs)  
**Git tag (planned):** `v1.0.0-core-mvp-accepted`

---

### Summary

TOCS Core MVP Backend and HTTP slice are **accepted** as the baseline for Formula-first trade operations. All MVP-scoped domains are implemented with Action-backed HTTP routes, full integration test coverage, and green GitHub Actions CI on `main`.

---

### Core MVP Domains (complete)

1. **Formula** — create, read, list, formula_no lookup, metadata PATCH, cancel  
2. **Company** — create, read, list  
3. **Participant** — add, list, read  
4. **Payment** — schedules, records, record cancel  
5. **Invoice** — create, read, list, status read; formula `invoice_status` sync (service-internal)  
6. **Logistics** — create, read, list, logistics-status update  
7. **Version** — create (MVP 1-retry), read, list, latest  
8. **Share** — create, update, delete (always new Version + Snapshot)  
9. **Close** — close formula, close-status read  
10. **Settlement** — closed-formula payment-schedule append, settlement notes (DL-033)  
11. **Dashboard / KPI** — confirmed KPI, expected profit engine, receivable-payable, participant KPI, unmatched payments  
12. **HTTP layer** — Fastify server, health check, unified `ActionError` mapping  

---

### HTTP Routes

| Metric | Value |
|--------|------:|
| Action-backed HTTP routes | **48** |
| Remaining Core MVP HTTP gap | **0** |

Route breakdown: Health 1, Formula 7, Payment 7, Close 1, Dashboard 5, Invoice 5, Version 5, Share 5, Settlement 2, Company 3, Participant 3, Logistics 4.

See `docs/api/API_MVP_SCOPE.md` for the canonical route list.

---

### Quality gates

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | Pass |
| Integration suite | **212 / 212** pass, 0 fail, 0 skip |
| GitHub Actions CI | **SUCCESS** ([run #1](https://github.com/ebizlabcontact-cpu/tocs/actions/runs/28326776089), `push` → `main`, `fa809e4`) |
| DB schema apply (CI) | `tocs_base_schema.sql` → `tocs_supplement.sql` → `tocs_fix_amount_verified.sql` |
| Prisma | `generate` only — **no migrate / db push** |

---

### Architecture constraints (unchanged)

- Formula is the sole top-level business unit; no Deal/Order/Project entities.
- PostgreSQL SQL files are schema source of truth; Prisma is ORM mapping only.
- Version-triggering fields must go through VersionService, not direct Formula PATCH.
- Closed Formula trade mutation guarded per DL-033; settlement allowlist only.

---

### Deferred / out of scope

| Item | Notes |
|------|--------|
| Auth / RBAC | Not implemented |
| File evidence | Not implemented |
| Notifications | Not implemented |
| Reopen (`is_closed` TRUE → FALSE) | V2 |
| Cancel undo / Close undo | MVP forbidden |
| Adjustment Formula entity | V2 |
| Participant order swap (§2.4) | V2 — transaction risk |
| Formula partial cancel | V2 — policy undefined |
| Version multi-retry / backoff | V2 |
| Logistics §5.3 `audit_logs` | Deferred — status log only |

---

### Upgrade / deploy notes

1. Apply DB schema per `docs/DB_APPLY_ORDER.md` (3 SQL files, fixed order).  
2. Set `DATABASE_URL` for PostgreSQL 16+.  
3. Run `npm ci` → `npx prisma generate`.  
4. Start HTTP: `tsx src/http/server.ts` (or equivalent; no `start` npm script in this release).  
5. Verify: `npm run test` (typecheck + integration) with database available.

---

### References

- Decision: `docs/decisions/DECISION_LOG.md` — **DL-034**  
- Tag plan: `docs/releases/RELEASE_TAG_PLAN_v1.0.0-core-mvp-accepted.md`  
- Changelog: `CHANGELOG.md`
