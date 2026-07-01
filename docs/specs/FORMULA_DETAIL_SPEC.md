# TOCS Formula Detail — Screen Wireframe Spec

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.0.0 (Screen wireframe — documentation only) |
| **Status** | **DRAFT** — wireframe / IA only; **no** UI implementation |
| **Implementation** | **Not started** — P6+; **no backend/API/DB changes** |

**Related:** [`NAVIGATION_ARCHITECTURE.md`](./NAVIGATION_ARCHITECTURE.md) §4, [`FORMULA_WIZARD_SPEC.md`](./FORMULA_WIZARD_SPEC.md), [`DASHBOARD_V1_SPEC.md`](./DASHBOARD_V1_SPEC.md) §4.4, [`GLOBAL_COMPANY_CONTEXT_POLICY.md`](./GLOBAL_COMPANY_CONTEXT_POLICY.md), [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md), [`../decisions/DECISION_LOG.md`](../decisions/DECISION_LOG.md) (DL-033)

**Prerequisite (shipped):** Core MVP Formula + child HTTP routes; Global Company Context (DL-050); KPI reads (`kpi/expected`, `kpi/confirmed`).

---

## 1. Purpose

**Formula Detail** is the **single drill-in surface** for one `formula_id`. It complements the **Formula Wizard** — Wizard captures minimum create path; Detail is where users **complete, monitor, and close** the Formula lifecycle.

| Rule | Detail |
|------|--------|
| **Formula First** | All domains (Payment, Invoice, Logistics, Share, Version, Settlement) live **under** one Formula — no parallel business roots |
| **Timeline-centric** | **Timeline** tab is the cross-domain chronological spine; domain tabs deep-link from Timeline rows |
| **Profit Engine separation** | **Estimated Net Profit** and **Realized Net Profit** — **separate labels**, never blended (§2.2) |
| **Company Context** | Inherits global Header Company Switcher; all reads/writes scoped via `X-Company-Id` |
| **Wizard complement** | Share, Invoice depth, payment **records**, status completion, Close/Cancel/Settlement — **Detail (or domain tabs)**, not Wizard |

**Route (design):** `/app/formulas/:formulaId` — default tab **Overview**; `/app/formulas/:formulaId/:tab` — see [`NAVIGATION_ARCHITECTURE.md`](./NAVIGATION_ARCHITECTURE.md) §7.

---

## 2. Architecture constraints

### 2.1 Formula First (non-negotiable)

- One Formula = one ledger unit; no Deal/Order/Project drill-in.
- `formula_no` is read-only display — never editable in UI.
- Business role is on `formula_participants.role_group`, not on `companies`.

### 2.2 Profit terminology — **confirmed policy**

Shared with [`FORMULA_WIZARD_SPEC.md`](./FORMULA_WIZARD_SPEC.md) §2.5 and [`DASHBOARD_V1_SPEC.md`](./DASHBOARD_V1_SPEC.md) §4.4.

```
Estimated Net Profit (예상 순이익)  ≠  Realized Net Profit (실현 순이익)
```

| Surface on Formula Detail | Metric |
|---------------------------|--------|
| **Top Summary Cards** | **Both** — adjacent cards, distinct labels |
| **Overview tab** | **Both** — KPI row + engine snapshot reference |
| **Timeline** | Event amounts only; profit labels **only** when tied to a named metric |
| **Dashboard** | **Realized only** — Estimated **not** on Dashboard |

| Metric | API (existing) |
|--------|----------------|
| Estimated Net Profit | `GET /api/v1/formulas/{id}/kpi/expected` |
| Realized Net Profit | `GET /api/v1/formulas/{id}/kpi/confirmed` |

### 2.3 Global Company Context

| Rule | Detail |
|------|--------|
| **Inherited scope** | Detail **does not** host a second company filter |
| **Access** | Formula must be visible under active `companyId` participant filter |
| **SUPER_ADMIN `all`** | Allowed for read; **mutation** actions require explicit single-company context (same as Wizard) |
| **Context display** | Header shows active company name (read-only badge) alongside Formula identity |

### 2.4 Lifecycle surfaces (read vs write)

| Formula state | Detail behavior (wireframe) |
|---------------|----------------------------|
| **Open** (`is_closed = FALSE`, not canceled) | Full domain tabs; version-triggering edits via Version path |
| **Canceled** | Read-heavy; Cancel/Close actions hidden; cash history remains visible (View policy) |
| **Closed** (`is_closed = TRUE`) | **Original trade locked** (DL-033); **Settlement tab** for post-close allowlist only (§3.5) |

---

## 3. Screen wireframe overview

**Scope:** Information architecture and **ASCII wireframe only**. **No** visual design system, **no** React/components, **no** v0 code.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ GLOBAL APP HEADER (Company Switcher — unchanged)                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ FORMULA DETAIL HEADER — formula_no · item · status · actions (§3.1)           │
├──────────────────────────────────────────────────────────────────────────────┤
│ TOP SUMMARY CARDS — sticky row (§3.2)                                         │
├──────────────────────────────────────────────────────────────────────────────┤
│ TAB NAV — Overview │ Timeline │ Participants │ … (§3.3)                      │
├──────────────────────────────────────────────────────────────────────────────┤
│ TAB CONTENT AREA                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.0 Wireframe principles

| Principle | Wireframe rule |
|-----------|----------------|
| **Timeline-centric** | Timeline tab always one click away; Timeline rows link to domain tab |
| **Profit Engine** | Summary cards and Overview show **Estimated** and **Realized** side-by-side — never one blended number |
| **Minimum navigation** | Domain work happens **in its tab** (Payments, Invoices, …) — header actions are shortcuts only |
| **Closed vs Settlement** | Locked trade UI on domain tabs; **Settlement** tab visually separated for post-close work |
| **RBAC-visible actions** | Cancel / Close / Settlement write controls **hidden** (not disabled-with-tooltip) when role denied |
| **Existing APIs only** | All panels compose Core MVP reads — **no** new aggregate Detail API in v1 wireframe |

---

### 3.1 Formula Detail Header

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [← Formulas]   FM-2606-00042   ·   대두 (톤)                    [Company: My Co] │
│                trade ● payment ○ invoice ○ logistics ○  (status chips)        │
│                                                                               │
│  [ + 입금 ] [ + 출금 ] [ + Invoice ]     [ 종결 ] [ 취소 Formula ]  (RBAC §3.5.3)  │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Element | Rule |
|---------|------|
| **Formula No** | `formula_no` — primary identifier; copy-friendly |
| **품목명** | Resolved `item` name + optional `unit` / `quantity` hint |
| **현재 상태** | Six domain status fields + `is_closed` / canceled badge — **manual completion** model; not auto-completed |
| **Company Context** | Active global company badge — **not** editable on Detail |
| **주요 액션** | Shortcuts to common flows; **authoritative CRUD** remains on domain tabs (§3.5.4) |

**Header action visibility (wireframe defaults):**

| Button | Target | Minimum role | When shown |
|--------|--------|--------------|------------|
| `+ 입금` / `+ 출금` | Payments tab → record create | `MANAGER`+ | Open Formula; not canceled |
| `+ Invoice` | Invoices tab → create | `MANAGER`+ | Open Formula |
| `종결` | Close confirm flow | `COMPANY_ADMIN`+ | `v_formula_closeable` true; not closed |
| `취소 Formula` | Cancel confirm | `COMPANY_ADMIN`+ | Not closed; not already canceled |

**Hidden when closed:** `종결`, `취소 Formula`, participant/price/version-trigger edits (domain tabs show read-only chrome).

---

### 3.2 Top Summary Cards

**Placement:** Sticky row **below Detail header**, visible on **all tabs** (desktop). Mobile: **first content block** (§3.6).

```
┌────────────┐┌────────────┐┌────────┐┌────────┐┌──────────┐┌──────────┐┌────────────┐
│ 예상 순이익 ││ 실현 순이익 ││ 미수금 ││ 미지급 ││ 계산서   ││ 물류     ││ 종결 가능  │
│  ₩ ……     ││  ₩ ……     ││  ₩ …  ││  ₩ …  ││ ● matched││ ● done   ││ ✓ 가능     │
│ Estimated ││ Realized   ││        ││        ││ invoice  ││ logistics││ closeable  │
└────────────┘└────────────┘└────────┘└────────┘└──────────┘└──────────┘└────────────┘
```

| Card | Metric / source | Label rule |
|------|-----------------|------------|
| **예상 순이익** | `kpi/expected` → expected net profit | **Estimated Net Profit** — never “이익” alone |
| **실현 순이익** | `kpi/confirmed` → confirmed net profit | **Realized Net Profit** — never mixed with Estimated |
| **미수금** | Receivable (scoped participant KPI / existing reads) | Cash expectation — not schedule |
| **미지급금** | Payable | Same |
| **계산서 상태** | `invoice_status` / derived invoice status | Badge + link → **Invoices** tab |
| **물류 상태** | `logistics_status` | Badge + link → **Logistics** tab |
| **종결 가능 여부** | `v_formula_closeable` | `가능` / `불가` + reason hint; link → **Overview** close checklist |

**Interaction:** Card click → relevant **tab** (not a new route). Profit cards do **not** navigate to Dashboard.

---

### 3.3 Main layout — Tab navigation

Nine tabs — normative order per [`NAVIGATION_ARCHITECTURE.md`](./NAVIGATION_ARCHITECTURE.md) §4.1.

```
Overview │ Timeline ★ │ Participants │ Payments │ Invoices │ Logistics │ Shares │ Versions │ Settlement
```

| Tab | Purpose (wireframe) | Primary API areas |
|-----|---------------------|-------------------|
| **Overview** | Formula metadata, 6-status grid, close checklist, KPI echo | `GET /formulas/{id}`, KPI reads |
| **Timeline** ★ | Chronological spine — all domains | Composed logs + child reads |
| **Participants** | A→B→C chain, roles, unit prices | `.../participants` |
| **Payments** | Schedules (planned) + Records (actual) | `.../payment-schedules`, `.../payment-records` |
| **Invoices** | Invoice list, sync, status | `.../invoices`, `.../invoices/status` |
| **Logistics** | Carrier, cost, bearer, status | `.../logistics`, `.../logistics-status` |
| **Shares** | Share rules | `.../shares` |
| **Versions** | Version history, snapshots | `.../versions`, `.../versions/latest` |
| **Settlement** | Post-close issues, append schedule, notes | Settlement routes (DL-033) |

**Default tab:** **Overview** on first open from list/Wizard. Dashboard recent-row drill may optionally land **Timeline** (product choice — document in NAVIGATION §4.2).

### 3.3.1 Tab content sketches (desktop)

#### Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 기본 정보          quantity │ unit │ memo │ created_at                        │
│ Status grid        trade │ payment │ invoice │ logistics │ share │ settlement │
│ Close checklist    invoice complete? · statuses manual-complete? · closeable   │
│ KPI echo           Estimated card │ Realized card (same labels as §3.2)        │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Participants / Payments / Invoices / Logistics / Shares / Versions

Each tab: **list or form primary area** + `[ + 추가 ]` / row actions when RBAC + lifecycle allow. Version-triggering fields route to **Version create** — not silent PATCH (Wizard §5 policy).

#### Settlement (visually distinct)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⚠ Closed Formula — 정산 이슈 처리 영역 (DL-033)                                │
│ Issue list │ [ + schedule append ] │ [ + payment record ] │ settlement notes   │
│ (allowlist actions only — §3.5.2)                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

### 3.4 Timeline tab

**Role:** Single chronological feed — **no** separate Timeline entity. Compose from existing tables/logs.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Timeline — newest first (toggle: oldest first)                    [ Filter ▼ ]│
├──────────────────────────────────────────────────────────────────────────────┤
│ ● 2026-06-20 14:32  Formula 생성          formula_no issued    → Overview     │
│ ● 2026-06-20 14:35  참여자 추가           Supplier · 매입처    → Participants │
│ ● 2026-06-21 09:00  참여자 수정 (Version) v2 snapshot          → Versions     │
│ ● 2026-06-22 11:00  예정 입출금           OUT ₩500,000 선입금   → Payments    │
│ ● 2026-06-23 10:15  실제 입출금           IN  ₩1,200,000       → Payments    │
│ ● 2026-06-23 15:00  Invoice              issued · AMOUNT_…    → Invoices    │
│ ● 2026-06-24 08:00  물류                   carrier assigned    → Logistics    │
│ ● 2026-06-25 16:00  상태 변경              payment → COMPLETED  → Overview    │
│ ● 2026-06-26 17:30  종결                   is_closed = TRUE     → Overview    │
│ ● 2026-06-27 09:00  정산 이슈             schedule append     → Settlement  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.4.1 Event categories (normative)

| Category | Examples | Source (conceptual) |
|----------|----------|---------------------|
| **Formula 생성** | Create, `formula_no` | `formulas.created_at`, audit |
| **참여자 추가/수정** | Participant CRUD, version-trigger | `formula_participants`, `formula_versions` |
| **Invoice** | Create, status sync, amount match | `formula_invoices`, invoice status reads |
| **예정 입출금** | Schedule IN/OUT, split rows | `payment_schedules` |
| **실제 입출금** | Record IN/OUT, cancel | `payment_records` |
| **물류** | Logistics create/update, status | `formula_logistics`, status logs |
| **상태 변경** | Manual status completion | `formula_status_logs` |
| **종결/정산 이슈** | Close, settlement append, notes | Close API, Settlement (DL-033), `audit_logs` |

| Rule | Detail |
|------|--------|
| **Row click** | Navigate to **domain tab** + scroll/highlight relevant row |
| **Profit in Timeline** | Show amounts on payment/share events; **do not** label row “순이익” without Estimated/Realized qualifier |
| **Canceled Formula** | Timeline **still shows** historical events including cash — exclusion is Dashboard/report UI responsibility |
| **Filter** | Optional domain filter chips — client-side on composed feed |

---

### 3.5 Action rules

#### 3.5.1 Closed Formula — original trade locked (DL-033)

When `is_closed = TRUE`, domain tabs show **read-only** for locked fields:

| Domain tab | Wireframe |
|------------|-----------|
| Participants | No add/edit/delete; prices read-only |
| Payments | Existing schedules/records read-only; **new** record/schedule via **Settlement** only |
| Invoices | Existing rows read-only; conditional status sync per DL-033 |
| Logistics / Shares / Versions | No version-triggering edits |
| Overview | Close checklist → “종결됨”; metadata read-only |

**Forbidden on normal tabs when closed:** quantity, unit price, participant CRUD, share CRUD, general Formula PATCH, Cancel.

#### 3.5.2 Settlement — allowed area separation

| Surface | Post-close writes |
|---------|-------------------|
| **Settlement tab** | Append payment schedule, add payment record, settlement notes, issue tracking (DL-033 allowlist) |
| **All other tabs** | Read-only for locked entities; shortcuts hidden in header |

Settlement tab **must** use distinct chrome (banner/icon) so users know they are in **post-close correction**, not original trade edit.

#### 3.5.3 Cancel / Close — RBAC exposure

Per [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md) §5–§7:

| Action | Permission | Roles |
|--------|------------|-------|
| **Cancel Formula** | `cancel:cancel` | `COMPANY_ADMIN`, `SUPER_ADMIN` |
| **Close Formula** | `close:close` | `COMPANY_ADMIN`, `SUPER_ADMIN` |
| **Settlement write** | `settlement:settle` | `COMPANY_ADMIN`, `SUPER_ADMIN` |
| **Payment record cancel** | `payment:cancel` | `COMPANY_ADMIN`, `SUPER_ADMIN` |

| Wireframe rule | Detail |
|----------------|--------|
| **MANAGER** | Sees operational `[ + ]` on Payments/Invoices/Logistics/Share; **never** sees Cancel/Close/Settlement write |
| **VIEWER** | All tabs read-only; no header mutations |
| **Exposure** | Hide controls when denied — do not show disabled Cancel to MANAGER |

#### 3.5.4 Domain ownership — where to manage

| Domain | Authoritative tab | Header shortcut |
|--------|-------------------|-----------------|
| **Share** | **Shares** | None in v1 wireframe |
| **Invoice** | **Invoices** | `+ Invoice` |
| **Payment** (schedule + record) | **Payments** | `+ 입금` / `+ 출금` |
| **Logistics** | **Logistics** | None — use tab |
| **Version-trigger changes** | Respective tab → Version flow | None |
| **Close / Cancel** | Overview checklist + header | `종결` / `취소 Formula` |
| **Post-close settlement** | **Settlement** | Visible when `is_closed` |

Wizard-skipped optional data (Share, Invoice, schedules, logistics) is **completed here** — Detail is the complement surface.

---

### 3.6 Mobile wireframe

**Priority order:** Summary cards → Timeline access → tab content.

```
┌──────────────────┐
│ [←] FM-2606-00042│
│ 대두 · status chip│
│ [Company: My Co] │
├──────────────────┤
│ SUMMARY CARDS    │  ← vertical stack (§3.2), swipe or 2-col grid
│ 예상 │ 실현      │
│ 미수 │ 미지급    │
│ …                │
├──────────────────┤
│ [ Timeline ▼ ]   │  ← prominent: sticky CTA or default 2nd pane
│ or mini feed     │
├──────────────────┤
│ [ Tab ▼ ]        │  ← dropdown: Overview, Timeline, Participants, …
│  current: Timeline│
├──────────────────┤
│ (tab content)    │
└──────────────────┘
```

| Rule | Detail |
|------|--------|
| **Summary cards 우선** | First scroll region after compact header |
| **Timeline 우선** | Sticky `[ Timeline ]` jump or **dropdown default** to Timeline for “what happened?” |
| **탭 navigation** | **Dropdown** (`Tab ▼`) on narrow viewports; optional **horizontal sticky subnav** for top 4 tabs (Overview, Timeline, Payments, Invoices) |
| **Header actions** | Overflow menu `⋯` for `+ 입금`, `종결`, etc. |
| **Settlement tab** | Same distinct banner as desktop when closed |

---

### 3.7 Wireframe forbidden

| Forbidden | Reason |
|-----------|--------|
| React / component specs | Out of scope |
| Visual design tokens | Design phase |
| New Detail aggregate API | Compose existing reads (NAVIGATION §2) |
| Blended profit label | §2.2 — Estimated ≠ Realized |
| Estimated on Dashboard via Detail | Dashboard Realized-only |
| Edit locked fields on closed Formula (normal tabs) | DL-033 |
| Cancel/Close for MANAGER | RBAC §3.5.3 |
| Deal/Order/Project drill-in | Formula First |
| Per-tab company filter | DL-050 global context only |
| Auto-complete status UI | Manual completion policy |
| Reopen / undo close in v1 wireframe | MVP excluded (DL-033) |

---

## 4. Relationship to other specs

| Spec | Relationship |
|------|--------------|
| [`NAVIGATION_ARCHITECTURE.md`](./NAVIGATION_ARCHITECTURE.md) §4 | Tab map and routes — **IA baseline** |
| [`FORMULA_WIZARD_SPEC.md`](./FORMULA_WIZARD_SPEC.md) §15.3 | Post-create lands **Overview**; Detail tabs complete Wizard gaps |
| [`DASHBOARD_V1_SPEC.md`](./DASHBOARD_V1_SPEC.md) §4.3 | List row → Detail; KPI cards stay Dashboard-scoped |
| [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md) | Header/tab action visibility |

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-23 | v1.0.0 — Initial Formula Detail screen wireframe (Header, Summary, Tabs, Timeline, Actions, Mobile) |
