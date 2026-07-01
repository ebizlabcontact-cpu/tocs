# TOCS Formula Detail — Screen Wireframe Spec

## Document status

| Field | Value |
|-------|--------|
| **Version** | v1.1.1 (Deferred / V2 — TOCS AI Assistant idea recorded) |
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
│ FORMULA DETAIL HEADER — formula_no · item · status · Quick Actions (§3.1)     │
├──────────────────────────────────────────────────────────────────────────────┤
│ TOP SUMMARY CARDS — sticky row (§3.2)                                         │
├──────────────────────────────────────────────────────────────────────────────┤
│ ATTENTION BANNER — rule-triggered alerts (§3.2.1)                             │
├──────────────────────────────────────────────────────────────────────────────┤
│ NEXT ACTIONS — rule-based checklist (§3.2.2)                                  │
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
| **Rule-based UX only** | Attention Banner and Next Actions use **deterministic rules** on existing reads — **no** AI inference (§3.2.1, §3.2.2) |
| **Existing APIs only** | All panels compose Core MVP reads — **no** new aggregate Detail API in v1 wireframe |

---

### 3.1 Formula Detail Header — Quick Actions

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [← Formulas]   FM-2606-00042   ·   대두 (톤)                    [Company: My Co] │
│                trade ● payment ○ invoice ○ logistics ○  (status chips)        │
│                                                                               │
│  QUICK ACTIONS:                                                               │
│  [ + 입금 ] [ + 출금 ] [ + Invoice ] [ + 물류 ]    [ 종결 ] [ 취소 Formula ]     │
│                                              (lifecycle · RBAC §3.5.3)        │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Element | Rule |
|---------|------|
| **Formula No** | `formula_no` — primary identifier; copy-friendly |
| **품목명** | Resolved `item` name + optional `unit` / `quantity` hint |
| **현재 상태** | Six domain status fields + `is_closed` / canceled badge — **manual completion** model; not auto-completed |
| **Company Context** | Active global company badge — **not** editable on Detail |
| **Quick Actions** | Four operational shortcuts (left group); lifecycle actions separated (right group) |

#### 3.1.1 Quick Actions (normative)

| Button | Target | Minimum role | When shown |
|--------|--------|--------------|------------|
| **`+ 입금`** | Payments tab → record create (direction IN) | `MANAGER`+ | Open Formula; not canceled |
| **`+ 출금`** | Payments tab → record create (direction OUT) | `MANAGER`+ | Open Formula; not canceled |
| **`+ Invoice`** | Invoices tab → create | `MANAGER`+ | Open Formula; not canceled |
| **`+ 물류`** | Logistics tab → create / first row | `MANAGER`+ | Open Formula; not canceled; no logistics row **or** edit existing per tab rules |

**Quick Action behavior:**

| Rule | Detail |
|------|--------|
| **Shortcut only** | Opens domain tab **prefilled context** (`formula_id` known) — authoritative save on domain tab |
| **Closed Formula** | `+ 입금` / `+ 출금` on open Formula only; when closed → payment append via **Settlement** tab (header Quick Actions hidden) |
| **VIEWER** | All Quick Actions **hidden** |
| **Grouping** | Quick Actions (operational) **left**; `종결` / `취소 Formula` (lifecycle) **right** — visual separation |

**Lifecycle header actions (not Quick Actions):**

| Button | Target | Minimum role | When shown |
|--------|--------|--------------|------------|
| `종결` | Close confirm flow | `COMPANY_ADMIN`+ | `v_formula_closeable` true; not closed |
| `취소 Formula` | Cancel confirm | `COMPANY_ADMIN`+ | Not closed; not already canceled |

**Hidden when closed:** all four Quick Actions, `종결`, `취소 Formula`; participant/price/version-trigger edits (domain tabs read-only).

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

#### 3.2.1 Attention Banner

**Placement:** Below Summary Cards; **above** Next Actions and Tab Nav. Visible on **all tabs** when any rule fires (desktop). Collapsible per session after acknowledge — **reappears** when underlying signal changes.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ⚠ ATTENTION                                                                   │
│ • 미수금 ₩1,200,000 잔존 — [ Payments ]                                      │
│ • 계산서 미매칭 — invoice amount ≠ expected — [ Invoices ]                    │
│ • 종결 가능 — close checklist satisfied — [ Overview · 종결 검토 ]            │
│ • payment status 미완료 — 수동 완료 필요 — [ Overview ]                        │
└──────────────────────────────────────────────────────────────────────────────┘
```

| Signal | Trigger (rule-based) | Banner copy (example) | Link target |
|--------|----------------------|------------------------|-------------|
| **미수금** | Receivable > 0 (scoped KPI / existing read) | `미수금 ₩… 잔존` | **Payments** |
| **계산서 미매칭** | `invoice_status` / derived ≠ matched | `계산서 미매칭` | **Invoices** |
| **종결 가능** | `v_formula_closeable = true` | `종결 가능` | **Overview** close checklist |
| **기타 중요 상태** | See §3.2.1.1 | Domain-specific label | Matching tab |

**§3.2.1.1 기타 중요 상태 (fixed rule set):**

| Condition | Banner |
|-----------|--------|
| Payable > 0 | `미지급금 ₩… 잔존` → **Payments** |
| Any of 6 statuses ≠ COMPLETED / AMOUNT_MATCHED (and not CANCELED) | `{domain} status 미완료` → **Overview** |
| Unmatched payment record signal (formula-scoped) | `미매칭 입출금` → **Payments** |
| Closed + open settlement issue flag | `정산 이슈` → **Settlement** |
| Canceled Formula | `취소된 Formula` (informational) — mutations hidden |

| Rule | Detail |
|------|--------|
| **No ranking** | All firing rules listed — **fixed evaluation order** (table top → bottom); **no** “most important” AI pick |
| **Zero / clear** | Banner row **removed** when signal clears after refetch |
| **RBAC** | Banner links respect read-only (VIEWER sees banner, links are view-only tabs) |
| **Closed Formula** | `종결 가능` hidden; Settlement/issue banners may remain |

#### 3.2.2 Next Actions (rule-based only)

**Placement:** Below Attention Banner (or below Summary Cards if no attention); **above** Tab Nav. Primary surface: **Overview** tab echo; **compact strip** visible on all tabs (optional collapse on non-Overview).

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ NEXT ACTIONS (eligible items only — no AI)                                    │
│ ○ 입금 등록 가능          [ + 입금 ]                                          │
│ ○ Invoice 등록 가능       [ + Invoice ]                                       │
│ ○ 물류 등록 가능          [ + 물류 ]                                          │
│ ○ 참여자 단가 수정 가능    [ Participants ]   (version-trigger)                │
│ ○ 종결 검토 가능          [ Overview · checklist ]  (COMPANY_ADMIN+ only)       │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Allowed action types (only these three labels):**

| Type | Meaning | Example rule |
|------|---------|--------------|
| **등록 가능** | Entity/tab allows **create** per RBAC + lifecycle | No logistics row → `물류 등록 가능`; no invoice → `Invoice 등록 가능`; schedule optional → `입금 등록 가능` |
| **수정 가능** | Existing row editable via domain tab (incl. version-trigger path) | Participant prices present + open Formula → `참여자 단가 수정 가능`; logistics exists → `물류 수정 가능` |
| **종결 검토 가능** | `v_formula_closeable` + not closed + `COMPANY_ADMIN`+ | Single item linking Overview checklist + header `종결` |

**Evaluation rules:**

| Rule | Detail |
|------|--------|
| **Deterministic** | Each line = boolean predicate on **existing API fields** — same inputs → same list |
| **Fixed order** | Evaluate in table order: 등록 (Payments → Invoice → Logistics → Share*) → 수정 (Participants → …) → 종결 검토 |
| **RBAC filter** | Omit lines user cannot execute (`MANAGER` never sees `종결 검토 가능`) |
| **Closed / Canceled** | 등록/수정 for locked domains omitted; Settlement allowlist items may appear as `등록 가능` on **Settlement** tab only — not duplicated in strip when closed |
| **Link = same as Quick Action** | `[ + 입금 ]` in Next Actions mirrors header Quick Action — no second flow |

**Forbidden (Next Actions):**

| Forbidden | Reason |
|-----------|--------|
| **AI 추천** | No ML / LLM suggested tasks |
| **우선순위 자동 결정** | No “do this first” scoring or sorted urgency |
| **업무 추론** | No inferred business intent (e.g. “거래처에 연락하세요”) |
| **Estimated profit advice** | Profit Engine display only — not an action recommendation |

*Share `등록 가능` when no share rows — only if product approves Share in Detail v1; otherwise omit (Wizard §12 A Pending).

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
│ Attention echo     (§3.2.1 — if any)                                          │
│ Next Actions       (§3.2.2 — full list)                                       │
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
│ Timeline — newest first (toggle: oldest first)                                 │
│ FILTER:  [ 전체 ] [ 입출금 ] [ 인보이스 ] [ 물류 ] [ 정산 ]   ← single-select chips │
├──────────────────────────────────────────────────────────────────────────────┤
│ ● 2026-06-20 14:32  Formula 생성          formula_no issued    → Overview     │
│ ● 2026-06-20 14:35  참여자 추가           Supplier · 매입처    → Participants │
│ … (rows filtered by active chip — §3.4.2)                                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### 3.4.2 Timeline filter (normative)

**Control:** Horizontal **single-select** chips — default **`전체`**. Client-side filter on composed feed; **no** new API.

| Chip | Includes event categories | Excludes |
|------|---------------------------|----------|
| **전체** | All §3.4.1 categories | — |
| **입출금** | 예정 입출금, 실제 입출금, payment-related **상태 변경** | Invoice-only, logistics-only, pure participant/version, 정산-only |
| **인보이스** | Invoice create/update/sync, invoice **상태 변경** | Payment rows, logistics, settlement |
| **물류** | 물류 create/update, logistics **상태 변경** | Payment, invoice, settlement |
| **정산** | 종결, 정산 이슈, settlement schedule append, settlement notes | Pre-close operational rows unless also tagged 정산 |

| Rule | Detail |
|------|--------|
| **Formula 생성 / 참여자 / Version** | Visible under **`전체`** only |
| **Empty state** | Chip with zero rows → “해당 이벤트 없음” |
| **Row click** | Unchanged — navigate to domain tab regardless of active filter |
| **Persistence** | Filter resets on leave Detail **or** optional session remember — implementation choice |

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
| **Filter** | Five chips §3.4.2 — client-side on composed feed |

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

| Domain | Authoritative tab | Header Quick Action |
|--------|-------------------|---------------------|
| **Share** | **Shares** | None in v1 wireframe |
| **Invoice** | **Invoices** | `+ Invoice` |
| **Payment** (schedule + record) | **Payments** | `+ 입금` / `+ 출금` |
| **Logistics** | **Logistics** | `+ 물류` |
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
│ [+입금][+출금]…  │  ← Quick Actions or ⋯ overflow
├──────────────────┤
│ SUMMARY CARDS    │  ← vertical stack (§3.2)
│ ATTENTION (if any)│  ← §3.2.1 compact
│ NEXT ACTIONS (n) │  ← §3.2.2 max 3 visible + “더보기”
├──────────────────┤
│ [ Timeline ▼ ]   │  ← filter chips inside Timeline tab
│ or mini feed     │
├──────────────────┤
│ [ Tab ▼ ]        │
│  current: Timeline│
├──────────────────┤
│ (tab content)    │
└──────────────────┘
```

| Rule | Detail |
|------|--------|
| **Summary cards 우선** | First scroll region after compact header |
| **Attention / Next Actions** | After summary; Next Actions capped at **3 lines** + expand — same rules as desktop, **no** priority sort |
| **Timeline 우선** | Sticky `[ Timeline ]` jump; filter chips **입출금 · 인보이스 · …** inside Timeline view |
| **탭 navigation** | **Dropdown** (`Tab ▼`) on narrow viewports; optional **horizontal sticky subnav** for top 4 tabs (Overview, Timeline, Payments, Invoices) |
| **Header Quick Actions** | `[ + 입금 ]` `[ + 출금 ]` `[ + Invoice ]` `[ + 물류 ]` in row or **`⋯` overflow** |
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
| AI / ML Next Action suggestions | §3.2.2 — rule-based only; **TOCS AI Assistant** is **Deferred V2+** (§5) — not V1 substitute |
| Auto-priority / “do first” ordering | §3.2.1, §3.2.2 — fixed rule order only |
| Business inference copy in Attention | Signal must map 1:1 to existing field/read |

---

## 4. Relationship to other specs

| Spec | Relationship |
|------|--------------|
| [`NAVIGATION_ARCHITECTURE.md`](./NAVIGATION_ARCHITECTURE.md) §4 | Tab map and routes — **IA baseline** |
| [`FORMULA_WIZARD_SPEC.md`](./FORMULA_WIZARD_SPEC.md) §15.3 | Post-create lands **Overview**; Detail tabs complete Wizard gaps |
| [`DASHBOARD_V1_SPEC.md`](./DASHBOARD_V1_SPEC.md) §4.3 | List row → Detail; KPI cards stay Dashboard-scoped |
| [`RBAC_PERMISSION_MATRIX.md`](./RBAC_PERMISSION_MATRIX.md) | Header/tab action visibility |

---

## 5. Deferred / V2 Ideas

**Scope:** Product ideas **documented only** — **no** V1 wireframe, **no** implementation, **no** API/DB work until explicit approval.

### 5.1 TOCS AI Assistant

| Field | Value |
|-------|--------|
| **Feature** | TOCS AI Assistant |
| **Status** | **Deferred / V2+** |
| **V1** | **Forbidden** — not in Productization V1 UI, Detail wireframe, or Next Actions |

#### Purpose

User asks questions in **chat**; the assistant returns answers from **TOCS data** the caller is allowed to see — Formula, KPI, Payment, Invoice, Logistics, Settlement — within **Company Context** and **RBAC**.

#### Example prompts (non-exhaustive)

| Example | Data domain |
|---------|-------------|
| 이번 달 손실 난 Formula 보여줘 | Formula list + `kpi/confirmed` (scoped) |
| 지오웍스 미수금 얼마야? | Company-scoped receivable / participant KPI |
| 종결 가능한 Formula 뭐야? | `v_formula_closeable` + scoped formula list |
| 실현 순이익이 예상 순이익보다 낮은 Formula 찾아줘 | `kpi/expected` vs `kpi/confirmed` per formula |
| 계산서 미매칭 거래 요약해줘 | Invoice status / mismatch signals (scoped) |

#### Policy (normative)

| Rule | Detail |
|------|--------|
| **V1 구현 금지** | No chat UI, no LLM routes, no agent in MVP shell |
| **AI 직접 DB 수정 금지** | Read-only — mutations stay human + existing Action → Service → Repository |
| **AI 임의 계산 금지** | No model-invented KPI; **Estimated** vs **Realized** labels mandatory (§2.2) |
| **Existing API / KPI / View only** | Responses grounded in Core MVP reads and DB Views — same as Dashboard roll-ups |
| **Company Context 필수** | Every tool call carries `X-Company-Id` / scope rules (DL-050) |
| **RBAC 필수** | Tool whitelist per `RBAC_PERMISSION_MATRIX` — deny by default |
| **Audit / query log** | `audit_logs` and/or dedicated **query log** — **review required** before ship |
| **No training on production data** | Customer/source data **must not** feed model training directly |
| **Architecture options (V2 review)** | **RAG**, **Tool Calling**, **Query Agent** — compare at design phase |

#### Relationship to V1 Detail UX

| V1 surface | Rule |
|------------|------|
| **Next Actions (§3.2.2)** | Deterministic rules only — **not** AI Assistant |
| **Attention Banner (§3.2.1)** | Fixed signals — **not** chat interpretation |
| **Future placement (idea)** | Global shell panel or `/app/assistant` — **not** decided; Detail wireframe unchanged in V1 |

#### Implementation later (checklist — not started)

| Item | Notes |
|------|-------|
| Open-source vs hosted LLM | Cost, latency, data residency — compare before build |
| **Tool whitelist** | Explicit allowed HTTP/read tools; no arbitrary SQL |
| **Read-only query layer** | Agent calls existing APIs or approved View queries only |
| **Sensitive data redaction** | PII / bank refs in prompts and logs |
| **Hallucination prevention** | Cite tool result IDs; refuse when data missing |

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-23 | v1.0.0 — Initial Formula Detail screen wireframe (Header, Summary, Tabs, Timeline, Actions, Mobile) |
| 2026-06-23 | v1.1.0 — Quick Actions (+ 물류), Timeline filter chips, Attention Banner, Next Actions (rule-based) |
| 2026-06-23 | v1.1.1 — **§5 Deferred / V2** — TOCS AI Assistant (idea only; V1 forbidden) |
