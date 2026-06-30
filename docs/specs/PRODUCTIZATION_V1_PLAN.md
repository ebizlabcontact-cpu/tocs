# TOCS Productization v1 Plan

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.4.0 (Plan — documentation only) |
| **Status** | ACCEPTED (DL-050 foundation) |
| **Implementation** | **Not started** — Phase P1 is specification only in v1.4.0 |

**Related:** [`GLOBAL_COMPANY_CONTEXT_POLICY.md`](./GLOBAL_COMPANY_CONTEXT_POLICY.md), [`NAVIGATION_ARCHITECTURE.md`](./NAVIGATION_ARCHITECTURE.md), [`DASHBOARD_V1_SPEC.md`](./DASHBOARD_V1_SPEC.md), [`ROUTE_PROTECTION_POLICY.md`](./ROUTE_PROTECTION_POLICY.md)

**Decision:** DL-050 — Global Company Context Policy (ACCEPTED)

---

## 1. Overview

**Productization v1** turns the TOCS Core MVP backend into a **coherent multi-company product experience**: shared navigation, global company scope, and Dashboard as one menu among many — not an isolated filter island.

**Prerequisites (complete):**

- Core MVP backend + 48 HTTP routes (DL-034)
- Auth + RBAC + route protection (DL-049, v1.3.7–v1.3.17)
- Integration gate **308/308** PASS

**v1.4.0 scope:** Documentation and policy only. **No UI code. No backend company-context middleware.**

---

## 2. Productization phases

| Phase | Name | v1.4.0 status | Deliverable |
|-------|------|---------------|-------------|
| **P1** | Global Company Context policy | ✅ **Spec complete** | [`GLOBAL_COMPANY_CONTEXT_POLICY.md`](./GLOBAL_COMPANY_CONTEXT_POLICY.md), DL-050 |
| **P2** | Navigation + shell architecture | ✅ **Spec complete** | [`NAVIGATION_ARCHITECTURE.md`](./NAVIGATION_ARCHITECTURE.md) |
| **P3** | Dashboard v1 specification | ✅ **Spec complete** | [`DASHBOARD_V1_SPEC.md`](./DASHBOARD_V1_SPEC.md) |
| **P4** | Company context middleware (backend) | **Not started** | `request.companyContext`, header parsing, Service filters |
| **P5** | Product UI shell + Header Switcher | **Not started** | React/Electron shell; global header |
| **P6** | Menu modules (Formula, Payment, …) | **Not started** | Per-domain screens wired to scoped APIs |

```
P1 Policy ──▶ P2 Navigation ──▶ P3 Dashboard spec
                    │
                    ▼
              P4 Backend context
                    │
                    ▼
              P5 UI shell ──▶ P6 Menu modules
```

---

## 3. Phase P1 — Global Company Context (v1.4.0)

**Goal:** Define how Header Company Switcher drives **all menus**.

| Decision | Detail |
|----------|--------|
| Global context | `request.companyContext = { mode, companyId }` |
| Headers | `X-Company-Id`, `X-Company-Scope: all` (SUPER_ADMIN only) |
| Non-admin | `X-Company-Id` required; no business data without active company |
| Filtering | Domain rules in GLOBAL_COMPANY_CONTEXT_POLICY §6 |

**Gate (documentation):** DL-050 ACCEPTED; cross-references in ROUTE_PROTECTION_POLICY, PROJECT_CONTEXT, CHANGELOG.

**Gate (implementation — future):** Middleware + Service filters; integration tests; 308+ PASS.

---

## 4. Phase P2 — Navigation architecture

**Goal:** Single app shell; company switcher in header; menu routes share global context.

See [`NAVIGATION_ARCHITECTURE.md`](./NAVIGATION_ARCHITECTURE.md).

---

## 5. Phase P3 — Dashboard v1

**Goal:** Dashboard KPIs and summaries consume **global company context** — same headers as Formula/Payment menus.

See [`DASHBOARD_V1_SPEC.md`](./DASHBOARD_V1_SPEC.md).

---

## 6. Explicit non-goals (Productization v1 plan)

| Non-goal | Notes |
|----------|-------|
| OAuth / SSO / signup | Auth V2 |
| Multi-tenant billing | V2 |
| Custom dashboards / widgets builder | V2 |
| Mobile-native apps | V2 |
| DB schema changes for company context | Use existing `company_memberships` + `formula_participants` |
| Dashboard-only company filter | Forbidden (DL-050) |

---

## 7. Integration with release governance

| Milestone | Tag style | Content |
|-----------|-----------|---------|
| v1.4.0 | Documentation | P1–P3 specs, DL-050 |
| v1.4.1+ | Code batches | P4 backend (proposed) |
| v1.5.x | Code batches | P5–P6 UI (proposed) |

See [`docs/releases/RELEASE_GOVERNANCE.md`](../releases/RELEASE_GOVERNANCE.md).

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-30 | v1.4.0 — Productization v1 plan; P1–P3 specification foundation (DL-050) |
