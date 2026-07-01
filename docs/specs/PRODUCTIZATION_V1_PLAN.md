# TOCS Productization v1 Plan

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.5.1 (Plan — **Product UI implementation scope** locked) |
| **Status** | ACCEPTED (DL-050 foundation; DL-051 Dashboard v1) |
| **Implementation** | P4 **shipped** (v1.4.1–v1.4.2); **UI-P1–P5 not started** — see [`PRODUCT_UI_IMPLEMENTATION_SCOPE.md`](./PRODUCT_UI_IMPLEMENTATION_SCOPE.md) |

**Related:** [`GLOBAL_COMPANY_CONTEXT_POLICY.md`](./GLOBAL_COMPANY_CONTEXT_POLICY.md), [`NAVIGATION_ARCHITECTURE.md`](./NAVIGATION_ARCHITECTURE.md), [`DASHBOARD_V1_SPEC.md`](./DASHBOARD_V1_SPEC.md), [`ROUTE_PROTECTION_POLICY.md`](./ROUTE_PROTECTION_POLICY.md)

**Decision:** DL-050 — Global Company Context Policy (ACCEPTED)

---

## 1. Overview

**Productization v1** turns the TOCS Core MVP backend into a **coherent multi-company product experience**: shared navigation, global company scope, and Dashboard as one menu among many — not an isolated filter island.

**Prerequisites (complete):**

- Core MVP backend + 48 HTTP routes (DL-034)
- Auth + RBAC + route protection (DL-049, v1.3.7–v1.3.17)
- Global company context middleware + service filters (v1.4.1–v1.4.2, DL-050)
- Integration gate **343 / 343 PASS**

**v1.5.0 scope:** Dashboard V1 specification refresh (DL-051). **No UI code. No new API.**

---

## 2. Productization phases

| Phase | Name | Status | Deliverable |
|-------|------|--------|-------------|
| **P1** | Global Company Context policy | ✅ **Complete** | [`GLOBAL_COMPANY_CONTEXT_POLICY.md`](./GLOBAL_COMPANY_CONTEXT_POLICY.md), DL-050 |
| **P2** | Navigation + shell architecture | ✅ **Spec complete** | [`NAVIGATION_ARCHITECTURE.md`](./NAVIGATION_ARCHITECTURE.md) |
| **P3** | Dashboard v1 specification | ✅ **v1.5.0 refresh** | [`DASHBOARD_V1_SPEC.md`](./DASHBOARD_V1_SPEC.md), DL-051 |
| **P4** | Company context (backend) | ✅ **Shipped** | v1.4.1 middleware + v1.4.2 service filters |
| **P5** | Product UI shell + Header Switcher | **Not started** | **UI-P1** in [`PRODUCT_UI_IMPLEMENTATION_SCOPE.md`](./PRODUCT_UI_IMPLEMENTATION_SCOPE.md) |
| **P6** | Menu modules (Formula, Payment, …) | **Not started** | **UI-P2–P5** (Dashboard → List → Detail → Wizard) |

```
P1 Policy ──▶ P2 Navigation ──▶ P3 Dashboard spec
                    │
                    ▼
              P4 Backend context
                    │
                    ▼
              P5 UI shell ──▶ P6 Menu modules
                    │
                    └── UI-P1…P5 detail: PRODUCT_UI_IMPLEMENTATION_SCOPE.md
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

## 5. Phase P3 — Dashboard v1 (v1.5.0)

**Goal:** Define post-login Dashboard layout — summary cards, recent activity, quick actions — consuming **global company context** and **existing scoped APIs only**.

| Area | v1.5.0 content |
|------|----------------|
| Summary cards | 미수금, 미지급금, 예정 입금, 예정 출금, 종결 대기, 계산서 미매칭 |
| Recent Activity | 최근 Formula, 최근 입출금, 최근 계산서 상태 |
| Quick Actions | Formula 생성, 입금/출금 등록, 계산서 확인 |
| Context | Header Company Switcher; SUPER_ADMIN `all` = platform aggregate |

See [`DASHBOARD_V1_SPEC.md`](./DASHBOARD_V1_SPEC.md). Decision: **DL-051**.

**Gate (documentation):** DL-051 ACCEPTED; no backend/UI changes in v1.5.0 batch.

**Gate (implementation — future):** P5 shell + P6 Dashboard module; 343+ PASS unchanged.

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
| v1.4.0 | Documentation | P1–P3 initial specs, DL-050 |
| v1.4.1–v1.4.2 | Code | P4 backend context + service filters |
| v1.5.0 | Documentation | P3 Dashboard v1 full spec, DL-051 |
| v1.5.x+ | Code (proposed) | P5–P6 UI — scope: [`PRODUCT_UI_IMPLEMENTATION_SCOPE.md`](./PRODUCT_UI_IMPLEMENTATION_SCOPE.md) |

See [`docs/releases/RELEASE_GOVERNANCE.md`](../releases/RELEASE_GOVERNANCE.md).

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-30 | v1.4.0 — Productization v1 plan; P1–P3 specification foundation (DL-050) |
| 2026-07-01 | v1.5.0 — P3 Dashboard v1 spec refresh; P4 marked shipped (DL-051) |
| 2026-06-23 | v1.5.1 — Link **PRODUCT_UI_IMPLEMENTATION_SCOPE** (UI-P1–P5 gate for v0/Cursor) |
