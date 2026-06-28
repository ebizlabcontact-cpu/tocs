# TOCS Release Governance

## Purpose

Define how TOCS versions are tagged, documented, and published on GitHub.

---

## Tag policy (effective DL-035)

| Rule | Policy |
|------|--------|
| **Format** | `vMAJOR.MINOR.PATCH` only (e.g. `v1.0.0`, `v1.2.0`) |
| **Suffixes** | **Forbidden** for new tags (`-core-mvp-accepted`, `-ci-minimal`, etc.) |
| **4-part IDs** | **Forbidden** for Git tags (`v1.2.2.1` and similar) |
| **Sub-milestones** | Record in `CHANGELOG.md` and `docs/releases/vX.Y.Z.md` — not in tag names |
| **Legacy tags** | Historical suffix tags remain in git; do not delete or move without explicit approval |
| **Immutability** | Published tags are never force-moved; fixes → next patch (`v1.2.1`, etc.) |

---

## What goes where

| Artifact | Contents |
|----------|----------|
| **Git tag** | SemVer pointer to an accepted commit |
| **GitHub Release** | Title `vX.Y.Z`, body from `RELEASE_NOTES.md` section |
| **CHANGELOG.md** | User-facing changes + internal batch tables |
| **RELEASE_NOTES.md** | Per-release summary for operators and reviewers |
| **docs/releases/vX.Y.Z.md** | Tag plan, preconditions, operator commands |
| **DECISION_LOG.md** | Architectural / governance decisions (DL-xxx) |

---

## Milestone map

| Tag | Milestone | Decision |
|-----|-----------|----------|
| `v1.0.0` | Core MVP Backend + HTTP slice Accepted | DL-034 |
| `v1.2.0` | Production Hardening (env, logging, health, startup validation) | DL-035 |

### Production Hardening (`v1.2.0`) — consolidated internal work

The following **engineering batch labels** are changelog-only (not tags):

- Environment v1.2.1
- Logging v1.2.2
- Request logger activation (formerly v1.2.2.1)
- Health + startup validation v1.2.3

Engineering Hardening v1.1.x (CI workflow) is part of the **v1.0.0** acceptance story.

---

## Creating a release (operator)

1. Confirm quality gates on `main` (`npm run test`, CI green).
2. Update `CHANGELOG.md` and `RELEASE_NOTES.md` if not already done.
3. Add or update `docs/releases/vX.Y.Z.md`.
4. Record decision in `DECISION_LOG.md` when governance changes.
5. Create annotated tag: `git tag -a vX.Y.Z -m "..."`.
6. Push tag: `git push origin vX.Y.Z`.
7. Publish GitHub Release from `RELEASE_NOTES.md`.

---

## Version bump guidance

| Change type | Bump | Example |
|-------------|------|---------|
| Breaking API / schema contract | MAJOR | `v2.0.0` |
| New domain feature, hardening milestone | MINOR | `v1.3.0` |
| Bug fix, docs-only tag correction | PATCH | `v1.2.1` |

Core MVP scope changes require explicit milestone approval per `.cursor/rules/tocs-core.mdc` §15.

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-28 | DL-035 — SemVer-only tag policy; legacy suffix deprecation |
