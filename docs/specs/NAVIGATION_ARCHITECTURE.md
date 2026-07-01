# TOCS Navigation Architecture

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.5.5 (Productization V1 IA baseline) |
| **Status** | **V1 Baseline Architecture** — accepted baseline; **evolvable** with real-usage feedback |
| **Implementation** | Backend context **shipped** (v1.4.2); UI shell **not started** (P5–P6) |

**Related:** [`GLOBAL_COMPANY_CONTEXT_POLICY.md`](./GLOBAL_COMPANY_CONTEXT_POLICY.md), [`PRODUCTIZATION_V1_PLAN.md`](./PRODUCTIZATION_V1_PLAN.md), [`DASHBOARD_V1_SPEC.md`](./DASHBOARD_V1_SPEC.md), [`FORMULA_WIZARD_SPEC.md`](./FORMULA_WIZARD_SPEC.md), [`ROUTE_PROTECTION_POLICY.md`](./ROUTE_PROTECTION_POLICY.md)

**Governance:** This document fixes **Productization V1 baseline** information architecture (IA). **Add, remove, or rename** menus/tabs is **allowed** after feedback — not a permanent lock. **Formula First**, **Global Company Context**, **Timeline-centric Formula Detail**, and **Profit Engine** semantics are **maintained** across IA changes.

---

## 1. Overview

TOCS Product UI uses a **persistent application shell**: header, **global primary navigation**, and content area. The **Header Company Switcher** lives in the shell header and drives **Global Company Context** for every business menu.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  TOCS Logo    [ Company Switcher ▼ ]                    User / Logout      │
├──────────────┬───────────────────────────────────────────────────────────┤
│  Dashboard ★ │  [ Module content area ]                                    │
│  Formulas    │                                                           │
│  Companies   │  Formula Detail (when drilled in):                         │
│  Calendar    │  Overview │ Timeline │ Participants │ Payments │ …         │
│  Reports     │                                                           │
│  Settings    │                                                           │
└──────────────┴───────────────────────────────────────────────────────────┘
```

★ **Dashboard** is the default landing menu after login (DL-051).

**Baseline note:** The structure above is the **Productization V1 baseline**. Teams may **incrementally improve** layout, order, and drill-down after **real-usage feedback** — without abandoning §2 principles.

**Rule:** Changing the company in the header **immediately changes scope for all menus** (Dashboard, Formulas, Companies, Calendar, Reports) — not Dashboard alone.

---

## 2. Architecture principles (V1 baseline)

| Principle | Rule |
|-----------|------|
| **Formula First** | **Formulas** is the primary business ledger menu; Payment, Invoice, Logistics, Share, Version, Settlement are **Formula Detail** domains — not parallel top-level business roots |
| **Global Company Context** | Single header switcher; `X-Company-Id` / `X-Company-Scope: all` on all business APIs (DL-050, v1.4.2) |
| **Timeline-centric Formula Detail** | **Timeline** tab is the chronological spine for status, payment, invoice, and logistics events on a Formula |
| **Profit Engine** | **Estimated Net Profit** on Wizard / Detail / Preview; **Realized Net Profit** on Dashboard P0 — no mixing (`DASHBOARD_V1_SPEC.md` §4.4, `FORMULA_WIZARD_SPEC.md` §2.5) |
| **Evolution allowed** | V1 baseline is a **starting IA**; post-launch add/remove/rename requires **doc update**, not silent UI drift |
| **API reuse** | Menus map to existing Core MVP routes — no new aggregate APIs for navigation alone |

---

## 3. Global navigation (Productization V1 — **confirmed baseline**)

Six **top-level** menus. Order is **normative for v1 wireframes**; minor reorder is allowed with doc update.

| Menu | Purpose | Primary routes / modules | Global context |
|------|---------|--------------------------|----------------|
| **Dashboard** | Operational KPI overview, recent activity, quick actions | [`DASHBOARD_V1_SPEC.md`](./DASHBOARD_V1_SPEC.md) | Scoped formula set |
| **Formulas** | Formula list, create (Wizard), **Formula Detail** (§4) | `GET/POST /api/v1/formulas`, child routes per tab | Participant filter |
| **Companies** | Company register and membership context | `GET/POST /api/v1/companies` | Active membership / scoped list |
| **Calendar** | Date-centric view of schedules, logistics dates, invoice/payment due hints | Reuses Formula-scoped schedule/logistics reads — **no new API in v1** | Scoped formulas |
| **Reports** | Read-only roll-ups and exports (scoped) | Client aggregation over existing KPI/list APIs — **no new engine in v1** | Scoped formulas |
| **Settings** | User preferences, session, app config | Auth/me, membership display; **not** a second company filter | User scope |

### 3.1 Deliberately **not** top-level (V1)

These Core MVP domains appear under **Formula Detail** (§4), not global nav:

| Former / alternate IA | V1 placement |
|-----------------------|--------------|
| Payment (standalone menu) | Formula Detail → **Payments** |
| Invoice (standalone menu) | Formula Detail → **Invoices** |
| Logistics (standalone menu) | Formula Detail → **Logistics** |
| Share / Version / Settlement (standalone) | Formula Detail tabs |
| Participant (standalone menu) | Formula Detail → **Participants** |

**Forbidden:** Introducing Deal/Order/Project or parallel ledger roots in global nav.

---

## 4. Formula Detail structure (Productization V1 — **confirmed baseline**)

Formula Detail is the **single drill-in surface** for one `formula_id`. Accessed from Formulas list, Dashboard recent rows, or Quick Actions.

**Route pattern (design):** `/app/formulas/:formulaId` + tab segment (e.g. `/app/formulas/:id/timeline`).

### 4.1 Tab map

| Tab | Purpose | Core API areas (existing) |
|-----|---------|---------------------------|
| **Overview** | Formula header, 6 statuses, KPI summary (**Estimated** + **Realized** per surface rules), close/cancel entry points | `GET /formulas/{id}`, `kpi/expected`, `kpi/confirmed` |
| **Timeline** | **Chronological event spine** — status logs, payments, invoices, logistics milestones | Status logs, records, invoice status, logistics-status reads |
| **Participants** | A→B→C chain, roles, unit prices | `GET/POST .../participants` |
| **Payments** | Schedules and records (planned vs actual cash) | `.../payment-schedules`, `.../payment-records` |
| **Invoices** | Invoice list, status, sync display | `.../invoices`, `.../invoices/status` |
| **Logistics** | Carrier, cost, cost bearer, logistics status | `.../logistics`, `.../logistics-status` |
| **Shares** | Share rules (version-triggered writes) | `.../shares` |
| **Versions** | Version history, snapshots | `.../versions`, `.../versions/latest` |
| **Settlement** | Post-close settlement notes, append schedules (DL-033) | Settlement routes on closed formulas |

**Default tab on open:** **Overview** (implementation default; may remember last tab per user in V2).

### 4.2 Timeline-centric rule

| Rule | Detail |
|------|--------|
| **Timeline is not optional** | Every Formula Detail session must expose **Timeline** as the cross-domain chronological view |
| **Source of events** | Compose from existing tables/logs — **no** separate Timeline entity or API in v1 |
| **Dashboard drill-down** | Recent payment/invoice rows → Formula Detail **Timeline** or domain tab (Payments / Invoices) |

### 4.3 Profit display on Formula Detail

| Surface | Metric |
|---------|--------|
| **Overview** | **Estimated Net Profit** and **Realized Net Profit** — **separate labels** (§2 Profit Engine) |
| **Timeline** | Event-level amounts; no blended “profit” label without metric name |
| **Dashboard** | **Realized only** — Estimated **not** on Dashboard cards |

---

## 5. Header Company Switcher

| Aspect | Specification |
|--------|---------------|
| **Location** | Global header; visible on all authenticated `/app/*` screens |
| **Purpose** | Set `active_company_id` (or `all` for SUPER_ADMIN) |
| **Persistence** | Client session (sessionStorage or app store); restored on reload |
| **API transport** | `X-Company-Id` or `X-Company-Scope: all` on every business request |

### 5.1 Options population

| User type | Switcher options |
|-----------|------------------|
| **Non–SUPER_ADMIN** | Active `company_memberships` only (from `GET /api/v1/auth/me`) |
| **SUPER_ADMIN** | **All companies** (`all` scope) + individual companies |

### 5.2 Selection rules

| User type | Default on login | Required before business navigation |
|-----------|------------------|-------------------------------------|
| Single membership | That company | Auto-selected |
| Multiple memberships | Last used or prompt | Must select if none stored |
| SUPER_ADMIN | Last used or `all` | Must have explicit scope before API calls |

Non–SUPER_ADMIN users **cannot** enter business menus without a selected company (DL-050).

**Settings** does **not** replace the header switcher.

---

## 6. Client request pipeline

```
User action in any menu
  → Read global companyContext from app store
  → Attach Authorization: Bearer …
  → Attach X-Company-Id OR X-Company-Scope: all
  → HTTP client → TOCS API
```

**Forbidden:**

- Different company header per menu
- Routine `?company_id=` on list URLs
- Frontend-only filter after unscoped API fetch

---

## 7. Routing (design)

| Route pattern | Module |
|---------------|--------|
| `/login` | Auth — no company context |
| `/app/dashboard` | **Default landing** — Dashboard v1 |
| `/app/formulas` | Formulas list |
| `/app/formulas/new` | Formula Wizard (P6+) |
| `/app/formulas/:id` | Formula Detail — default **Overview** |
| `/app/formulas/:id/:tab` | Formula Detail tab (`overview`, `timeline`, `participants`, `payments`, `invoices`, `logistics`, `shares`, `versions`, `settlement`) |
| `/app/companies` | Companies |
| `/app/calendar` | Calendar (scoped) |
| `/app/reports` | Reports (scoped) |
| `/app/settings` | Settings |

Exact path strings are implementation detail; **global header + six menus persist across `/app/*`**.

---

## 8. Auth integration

1. Login → `GET /api/v1/auth/me` → populate switcher options.
2. User selects company → store `active_company_id` (or SUPER_ADMIN `all`).
3. **Navigate to `/app/dashboard`** (default landing).
4. All business API calls include company headers per [`GLOBAL_COMPANY_CONTEXT_POLICY.md`](./GLOBAL_COMPANY_CONTEXT_POLICY.md).

Logout clears tokens and company context.

---

## 9. Dashboard navigation

Dashboard shares the global shell (§3 **Dashboard** menu).

| Zone | Navigation behavior |
|------|---------------------|
| P0 summary card | Drill-down to Formulas list or Formula Detail with implied filter |
| Loss block (§4.5) | Formulas list filtered to loss formulas |
| Recent Formula row | `/app/formulas/{id}` (Overview) |
| Recent payment row | Formula Detail → **Payments** or **Timeline** |
| Recent invoice row | Formula Detail → **Invoices** or **Timeline** |
| Quick Actions | `/app/formulas/new`, Payment record flows, Invoice list |

Company switch on Dashboard → full widget refetch (DL-050).

---

## 10. SUPER_ADMIN UX

| Mode | Header | User-visible label (example) |
|------|--------|------------------------------|
| All companies | `X-Company-Scope: all` | "All companies" |
| Single company | `X-Company-Id: <uuid>` | Company name |

All-scope views must be **visually distinct** (badge/banner).

---

## 11. Non-goals (V1 baseline doc)

- Implementing React/Electron shell (P5 milestone)
- New navigation-specific backend routes
- Dashboard aggregate API (V2)
- Breadcrumb-based company switching
- Per-tab independent company context
- Locking IA against **documented** post-v1 iteration

---

## 12. Evolution policy

| Allowed | Requires |
|---------|----------|
| Add/remove/reorder global menu or Formula Detail tab | Update this doc + product sign-off |
| Merge Calendar into Reports (example) | Same |
| Deepen Calendar/Reports feature spec | Separate spec slice — not silent scope creep |

**Current structure = Productization V1 baseline.** Real-usage feedback may drive **gradual improvement** without breaking Formula First or Global Company Context.

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-30 | v1.4.0 — Navigation architecture; global company switcher (DL-050) |
| 2026-07-01 | v1.5.0 — Dashboard landing default; Dashboard navigation zone (DL-051) |
| 2026-07-01 | v1.5.5 — **Productization V1 IA baseline:** global nav (6) + Formula Detail tabs (9); Timeline-centric; evolution policy |
