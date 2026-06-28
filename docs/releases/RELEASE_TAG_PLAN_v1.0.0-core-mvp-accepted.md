# Release Tag Plan — v1.0.0-core-mvp-accepted

## Purpose

Permanently mark the **Core MVP Backend + HTTP Slice Accepted** milestone in Git history and GitHub Releases.

---

## Tag identity

| Field | Value |
|-------|--------|
| **Tag name** | `v1.0.0-core-mvp-accepted` |
| **Target branch** | `main` |
| **Target commit** | `fa809e41f80db05e1135485450cc589046167092` (minimum: CI workflow commit) |
| **Recommended HEAD** | Latest `main` after acceptance documentation commit |
| **Tag type** | Annotated (recommended) |

### Naming note

An earlier local tag `v1.0-core-mvp-accepted` may exist. This release uses **`v1.0.0-core-mvp-accepted`** (semver-style prefix) for GitHub Release governance. Do not delete historical tags without explicit approval.

---

## Preconditions (all met)

- [x] Core MVP domains complete (`docs/api/API_MVP_SCOPE.md`, `.cursor/rules/tocs-core.mdc` §15)
- [x] HTTP routes: **48**, gap **0**
- [x] Integration suite: **212 / 212 / 0 skip**
- [x] GitHub Actions CI: **SUCCESS** on `main` ([run #1](https://github.com/ebizlabcontact-cpu/tocs/actions/runs/28326776089))
- [x] `CHANGELOG.md`, `RELEASE_NOTES.md`, DL-034 recorded

---

## Tag creation commands (operator)

Run from repository root after documentation commit is on `main`:

```bash
git checkout main
git pull origin main

# Verify gates locally (optional but recommended)
npm ci
npx prisma generate
npm run typecheck
# DATABASE_URL required:
npm run test:integration

# Create annotated tag
git tag -a v1.0.0-core-mvp-accepted -m "Core MVP Backend + HTTP slice accepted (48 routes, 212 integration tests, CI green)"

# Push tag
git push origin v1.0.0-core-mvp-accepted
```

---

## GitHub Release (recommended)

1. Open **Releases → Draft a new release**.  
2. Choose tag `v1.0.0-core-mvp-accepted`.  
3. Title: `v1.0.0 — Core MVP Backend + HTTP Slice Accepted`.  
4. Body: paste from `RELEASE_NOTES.md` (Summary + Quality gates + Deferred).  
5. Attach no binaries (backend-only milestone).  
6. Publish release.

---

## What this tag does **not** include

- Production deployment
- Auth/RBAC
- UI / frontend
- DB migration tooling (Prisma migrate remains forbidden)
- V2 features listed in `RELEASE_NOTES.md` Deferred section

---

## Rollback / correction policy

- Tag points at immutable commit; do not move tag after publish.
- If documentation-only fixes are needed after tag: new patch tag (e.g. `v1.0.1-core-mvp-accepted-docs`) or next milestone tag — never force-move `v1.0.0-core-mvp-accepted`.

---

## Checklist before push

| Step | Command / action |
|------|------------------|
| Typecheck | `npm run typecheck` |
| Integration (with DB) | `npm run test:integration` |
| Docs committed | `CHANGELOG.md`, `RELEASE_NOTES.md`, `DECISION_LOG.md`, this file |
| CI green on `main` | GitHub Actions `CI` workflow |
| Tag annotated | `git tag -a v1.0.0-core-mvp-accepted ...` |
| Tag pushed | `git push origin v1.0.0-core-mvp-accepted` |
| GitHub Release | Draft from `RELEASE_NOTES.md` |
