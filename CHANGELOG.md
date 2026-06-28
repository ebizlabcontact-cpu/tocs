# Changelog

All notable changes to TOCS are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [1.0.0-core-mvp-accepted] — 2026-06-28

### Added

- **Core MVP Backend + HTTP slice** — Formula-first architecture, Action → Service → Repository → Prisma → PostgreSQL.
- **Action-backed HTTP Routes (48)** — Health, Formula, Payment, Close, Dashboard, Invoice, Version, Share, Settlement, Company, Participant, Logistics.
- **Integration test suite** — 212 tests across 17 `*.integration.test.ts` files (`npm run test:integration`).
- **GitHub Actions CI** — `.github/workflows/ci.yml` on `push` / `pull_request` to `main` (PostgreSQL 16 service, SQL schema apply, typecheck, integration tests).
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
- GitHub Actions CI run [#1](https://github.com/ebizlabcontact-cpu/tocs/actions/runs/28326776089): **SUCCESS** (`main`, commit `fa809e4`).
- Remaining Core MVP gap: **0** (per `docs/api/API_MVP_SCOPE.md`).

### Deferred (not in this release)

- Auth / RBAC
- File evidence upload
- Notification system
- Reopen, Cancel undo, Close undo
- Adjustment Formula entity
- Participant order swap API (§2.4)
- Formula partial cancel
- Version retry advanced policy (multi-retry / backoff)
- Logistics §5.3 `audit_logs` INSERT (status log only today)

### Documentation

- Acceptance recorded in `RELEASE_NOTES.md`, `docs/decisions/DECISION_LOG.md` (DL-034), `docs/releases/RELEASE_TAG_PLAN_v1.0.0-core-mvp-accepted.md`.

---

## [Unreleased]

_No changes yet._
