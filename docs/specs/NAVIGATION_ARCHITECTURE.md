# TOCS Navigation Architecture

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.5.0 (Architecture — Dashboard v1 layout added) |
| **Status** | ACCEPTED (DL-050; DL-051 Dashboard) |
| **Implementation** | Backend context **shipped** (v1.4.2); UI shell **not started** |

**Related:** [`GLOBAL_COMPANY_CONTEXT_POLICY.md`](./GLOBAL_COMPANY_CONTEXT_POLICY.md), [`PRODUCTIZATION_V1_PLAN.md`](./PRODUCTIZATION_V1_PLAN.md), [`DASHBOARD_V1_SPEC.md`](./DASHBOARD_V1_SPEC.md), [`ROUTE_PROTECTION_POLICY.md`](./ROUTE_PROTECTION_POLICY.md)

---

## 1. Overview

TOCS Product UI uses a **persistent application shell**: header, primary navigation, and content area. The **Header Company Switcher** lives in the shell header and drives **Global Company Context** for every business menu.

```
┌─────────────────────────────────────────────────────────────┐
│  TOCS Logo    [ Company Switcher ▼ ]          User / Logout │
├──────────────┬──────────────────────────────────────────────┤
│  Dashboard ★ │  Summary Cards (6)                           │
│  Formula     │  Recent Activity │ Quick Actions             │
│  Payment     │                                              │
│  Invoice     │                                              │
│  …           │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

★ **Dashboard** is the default landing menu after login (DL-051).

**Rule:** Changing the company in the header **immediately changes scope for all menus**, including Dashboard, Formula list, Payment list, and KPI views — not Dashboard alone.

---

## 2. Header Company Switcher

| Aspect | Specification |
|--------|---------------|
| **Location** | Global header; visible on all authenticated business screens |
| **Purpose** | Set `active_company_id` (or `all` for SUPER_ADMIN) |
| **Persistence** | Client session (sessionStorage or app store); restored on reload |
| **API transport** | `X-Company-Id` or `X-Company-Scope: all` on every business request |

### 2.1 Options population

| User type | Switcher options |
|-----------|------------------|
| **Non–SUPER_ADMIN** | Active `company_memberships` only (from `GET /api/v1/auth/me`) |
| **SUPER_ADMIN** | **All companies** (`all` scope) + individual companies |

### 2.2 Selection rules

| User type | Default on login | Required before business navigation |
|-----------|------------------|-------------------------------------|
| Single membership | That company | Auto-selected |
| Multiple memberships | Last used or prompt | Must select if none stored |
| SUPER_ADMIN | Last used or `all` | Must have explicit scope before API calls |

Non–SUPER_ADMIN users **cannot** enter Formula, Payment, Dashboard, or other business menus without a selected company (DL-050).

---

## 3. Primary navigation map

Menus align with Core MVP API domains ([`API_MVP_SCOPE.md`](../api/API_MVP_SCOPE.md)):

| Menu | Primary API areas | Global context |
|------|-------------------|----------------|
| Dashboard | Summary cards, recent activity, quick actions | Scoped formula set; see [`DASHBOARD_V1_SPEC.md`](./DASHBOARD_V1_SPEC.md) |
| Formula | Formula CRUD, status, cancel, close | Formula participant filter |
| Participant | Formula participants | Active company participants |
| Payment | Schedules, records | Formula scope |
| Invoice | Invoices, status | Formula scope |
| Logistics | Logistics, status | Formula scope |
| Settlement | Settlement notes, schedules | Formula scope |
| Share | Shares | Formula scope |
| Version | Versions | Formula scope |
| Company | Company register/list | Active membership company |

Each menu module **reads** the same global context from the shell — no local company picker except where UX requires drill-down within already-scoped data.

---

## 4. Client request pipeline

```
User action in any menu
  → Read global companyContext from app store
  → Attach Authorization: Bearer …
  → Attach X-Company-Id OR X-Company-Scope: all
  → HTTP client → TOCS API
```

**Forbidden:**

- Dashboard sending different company header than Formula menu
- Routine `?company_id=` on list URLs
- Filtering sensitive lists only in Frontend after unscoped API fetch

---

## 5. Routing (design)

| Route pattern | Notes |
|---------------|-------|
| `/login` | No company context |
| `/app/*` | Shell + menus; company context required |
| `/app/dashboard` | **Default landing** — Dashboard v1 (6 cards + activity + quick actions) |
| `/app/formulas`, `/app/formulas/:id` | Formula module |

Exact path names are implementation detail; **global header persists across `/app/*`**.

---

## 6. Auth integration

1. Login → `GET /api/v1/auth/me` → populate switcher options.
2. User selects company → store `active_company_id` (or SUPER_ADMIN `all`).
3. **Navigate to `/app/dashboard`** (default landing).
4. Dashboard loads scoped widgets per [`DASHBOARD_V1_SPEC.md`](./DASHBOARD_V1_SPEC.md).
5. All subsequent business API calls include company headers per [`GLOBAL_COMPANY_CONTEXT_POLICY.md`](./GLOBAL_COMPANY_CONTEXT_POLICY.md).

Logout clears tokens and company context.

---

## 7. Dashboard navigation (v1.5.0)

Dashboard is **not** a separate product island. It shares the global shell and company context.

| Dashboard zone | Navigation behavior |
|----------------|---------------------|
| Summary card click | Drill-down to Formula / Payment / Invoice menu with implied filter |
| Recent Formula row | `/app/formulas/{id}` |
| Recent payment row | Formula detail → payments tab |
| Recent invoice row | Formula detail → invoices tab |
| Quick Actions | Route to create/list flows in target menu (RBAC-gated) |

Company switch while on Dashboard → full widget refetch (DL-050 §7).

---

## 8. SUPER_ADMIN UX

| Mode | Header | User-visible label (example) |
|------|--------|------------------------------|
| All companies | `X-Company-Scope: all` | "All companies" |
| Single company | `X-Company-Id: <uuid>` | Company name |

All-scope views must be **visually distinct** (badge/banner) to prevent accidental platform-wide operations.

---

## 9. Non-goals

- Implementing React/Electron shell (P5 milestone)
- Dashboard aggregate API (V2 — see DASHBOARD_V1_SPEC §10)
- Breadcrumb-based company switching
- Per-tab independent company context (single global context per session)

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-30 | v1.4.0 — Navigation architecture; global company switcher (DL-050) |
| 2026-07-01 | v1.5.0 — Dashboard landing default; Dashboard navigation zone (DL-051) |
