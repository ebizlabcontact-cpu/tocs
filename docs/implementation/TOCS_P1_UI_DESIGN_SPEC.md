# TOCS P1 UI Design Specification

| Field | Value |
|-------|--------|
| **Version** | v1.0.0 |
| **Status** | Implementation-ready UI design for v0 (one-pass) |
| **Mode** | Mock preview only — no HTTP, no repository wiring |
| **Audience** | v0 UI implementation agent |
| **Scope** | P1 items 1–4 only (see §0) |
| **Baseline** | `tocs-frontend-design` working tree; extend existing components only |

---

## 0. Global Constraints (apply to every feature)

1. **Formula First** — all surfaces derive from `formula_id`; never introduce Deal/Order/Project roots.
2. **Mock preview only** — all writes update in-memory preview (`formula-preview-mutations.ts`, `formula-preview-session.ts`, `company-preview-session.ts`). Show `MockPreviewNote` on every mutation surface.
3. **Extend existing files** — do not replace `formula-detail-view.tsx`, `detail-panels.tsx`, `workflow-modals.tsx`, `batch-2-workflows.tsx`, `companies-explorer.tsx` shells; add subcomponents beside or inside them.
4. **Do not wire HTTP** — label future binding points in copy only; never call `fetch` or `repository.ts` methods from UI.
5. **RBAC — hide, do not disable** — use `permissions.ts` + `formula-workflow-context.tsx` caps; omit controls the user cannot perform.
6. **Closed formula (DL-033)** — when `formula.isClosed === true`, all version-trigger editors and participant-KPI-dependent write affordances are **hidden**; read-only surfaces remain.
7. **Canceled formula** — when `formula.canceledAt` is set, hide all write affordances; read-only surfaces remain.
8. **Version triggers** — any field listed in TOCS version policy must open `VersionTriggerModal` (export from `workflow-modals.tsx`) before `applyPreview`.
9. **Design language** — reuse existing tokens: `border-border`, `bg-card`, `bg-secondary/60` table headers, `text-xs uppercase tracking-wide text-muted-foreground` section labels, `rounded-lg border`, `StatusBadge`, `Button variant="outline"|"accent"`, `Modal`, `Field`/`Input`/`Select`.

### Existing files v0 MUST extend

| File | Role |
|------|------|
| `web/components/formulas/formula-detail-view.tsx` | Tab composition |
| `web/components/formulas/detail-panels.tsx` | Panel tables/cards |
| `web/components/formulas/workflows/batch-2-workflows.tsx` | Timeline chrome |
| `web/components/formulas/formula-edit-simulation.tsx` | Version trigger expansion |
| `web/components/formulas/workflows/workflow-modals.tsx` | `VersionTriggerModal`, patterns |
| `web/lib/formula-preview-mutations.ts` | New preview mutators |
| `web/lib/formula-math.ts` | Participant KPI derivation |
| `web/lib/types.ts` | `CompanyContact` alignment |
| `web/lib/company-preview-session.ts` | Contact collection persist |
| `web/components/companies/companies-explorer.tsx` | Contacts UI |
| `web/lib/permissions.ts` | Unchanged caps (use `canCommitVersion`) |

---

# Feature 1 — Participant Confirmed KPI UI

## 1.1 Feature purpose

Display **per-participant confirmed cash KPI** for the current Formula, mirroring `v_participant_confirmed_kpi` / `GET /api/v1/formulas/:formulaId/kpi/participants`. Users see each chain participant’s confirmed in/out, scheduled in/out, receivable, payable, and confirmed net profit in one table.

## 1.2 Backend source

| Item | Source |
|------|--------|
| View | `v_participant_confirmed_kpi` (`db/schema/tocs_supplement.sql`) |
| Route | `GET /api/v1/formulas/:formulaId/kpi/participants` (`dashboard.routes.ts`) |
| Response DTO | `ParticipantConfirmedKpiResponse` (`dashboard.actions.ts` lines 72–89) |
| Fields | `formula_id`, `formula_no`, `participant_id`, `company_id`, `company_name`, `role_group`, `sequence_order`, `total_buy_amount`, `total_sell_amount`, `confirmed_in`, `confirmed_out`, `scheduled_in`, `scheduled_out`, `receivable`, `payable`, `confirmed_net_profit` |

## 1.3 Screen

**Formula Detail → Participants tab** (`/formulas/[id]` → tab value `participants`)

## 1.4 Component hierarchy

```
FormulaDetailView
└── TabsContent value="participants"
    ├── ParticipantWorkflowActions          (existing — unchanged)
    ├── ParticipantConfirmedKpiPanel      (NEW)
    └── ParticipantsPanel                 (existing — unchanged)
```

### New component: `ParticipantConfirmedKpiPanel`

**File:** `web/components/formulas/detail-panels.tsx` (export)  
**Props:** `{ formula: Formula }`  
**Internal:** reads `useFormulaWorkflow()` only if needed for live formula state; prefer `formula` prop.

## 1.5 User flow

1. User opens Formula Detail → **Participants** tab.
2. User sees KPI panel **above** the participant chain table.
3. User reads per-row confirmed metrics (read-only).
4. No modal; no write action.

**Entry point:** Participants tab select.  
**Exit point:** User navigates to another tab (stateless read).

## 1.6 Visual layout

### Section structure (top → bottom)

| Order | Block | Spacing |
|-------|--------|---------|
| 1 | Section header row | `mb-2` |
| 2 | Explanatory copy | `mb-3` |
| 3 | KPI table card | `rounded-lg border border-border overflow-hidden` |
| 4 | Gap before chain | `mb-5` (panel wrapper `space-y-5`) |

### Section header row

- **Left:** `text-xs font-semibold uppercase tracking-wide text-muted-foreground` — label: **Confirmed KPI by Participant**
- **Right:** `StatusBadge tone="info"` — text: **Cash-based · Preview**

### Explanatory copy

`text-xs leading-relaxed text-muted-foreground`:

> Confirmed figures derive from actual payment records (cash movements), not schedules. Mirrors `v_participant_confirmed_kpi` — preview computed locally.

### Table columns (exact order, left → right)

| # | Column header | Cell content | Alignment |
|---|---------------|--------------|-----------|
| 1 | Seq | `sequence_order` (1-based display: value + 1 or `sequence_order` as stored) | center |
| 2 | Company | `company_name` | left |
| 3 | Role | `role_group` as `StatusBadge tone="outline"` | left |
| 4 | Confirmed In | `confirmed_in` formatted KRW | right, `font-mono tabular-nums` |
| 5 | Confirmed Out | `confirmed_out` formatted KRW | right, `font-mono tabular-nums` |
| 6 | Scheduled In | `scheduled_in` formatted KRW | right, `font-mono tabular-nums` |
| 7 | Scheduled Out | `scheduled_out` formatted KRW | right, `font-mono tabular-nums` |
| 8 | Receivable | `receivable` formatted KRW | right, `font-mono tabular-nums` |
| 9 | Payable | `payable` formatted KRW | right, `font-mono tabular-nums` |
| 10 | Confirmed Net | `confirmed_net_profit` formatted KRW | right, `font-mono tabular-nums font-semibold`; `text-success` if ≥ 0, `text-danger` if < 0 |

**Desktop:** full table `min-w-[1100px]` inside `overflow-x-auto`.  
**Mobile (`sm:hidden`):** stack one **card per participant** with same fields as label/value pairs (mirror `ParticipantsPanel` mobile cards).

### Primary / secondary actions

None (read-only panel).

## 1.7 Mock preview behavior

**New function:** `deriveParticipantConfirmedKpi(formula: Formula): ParticipantConfirmedKpiRow[]` in `web/lib/formula-math.ts`.

**Row shape (TypeScript):**

```ts
type ParticipantConfirmedKpiRow = {
  formulaId: string
  formulaNo: string
  participantId: string
  companyId: string
  companyName: string
  roleGroup: string
  sequenceOrder: number
  totalBuyAmount: number
  totalSellAmount: number
  confirmedIn: number
  confirmedOut: number
  scheduledIn: number
  scheduledOut: number
  receivable: number
  payable: number
  confirmedNetProfit: number
}
```

**Derivation rules (mock, must match backend semantics):**

- One row per `formula.participants[]` entry, sorted by `sequenceOrder`.
- `confirmedIn` / `confirmedOut`: sum non-canceled `formula.records` where `counterparty` matches participant `company` name (use same counterparty index as `derivePerspectiveMetrics`).
  - Record `type === "receipt"` → adds to **confirmedIn** for that counterparty.
  - Record `type === "payment"` → adds to **confirmedOut**.
- `scheduledIn` / `scheduledOut`: sum `formula.schedule` remaining amounts for matching counterparty (same mapping as perspective metrics).
- `receivable` / `payable`: same as perspective metrics per participant company.
- `confirmedNetProfit` = `confirmedIn - confirmedOut`.
- `totalBuyAmount` / `totalSellAmount`: participant leg economics (`buyUnit × qty`, `sellUnit × qty`).

**No mutation** — panel re-renders when `formula` updates via workflow context.

## 1.8 RBAC behavior

| Role | Behavior |
|------|----------|
| VIEWER, MANAGER, COMPANY_ADMIN, SUPER_ADMIN | Panel **visible** (read-only for all) |
| `isAllCompanies` | Panel **visible** (read-only) |

## 1.9 Closed / canceled behavior

| State | Behavior |
|-------|----------|
| `formula.isClosed` | Panel **visible**, read-only |
| `formula.canceledAt` | Panel **visible**, read-only; optional `StatusBadge tone="outline"` in header: **Canceled formula** |

## 1.10 States

| State | UI |
|-------|-----|
| **Loading** | Not applicable (sync derive from formula) |
| **Empty** | `participants.length === 0` → `SectionEmpty` label: **No participants — confirmed KPI unavailable.** |
| **Error** | Not applicable in mock |
| **Read-only** | Always read-only |

## 1.11 Related tabs / impact

| Area | Impact |
|------|--------|
| Timeline | No write |
| Status logs | No write |
| Settlement | KPI read complements settlement balances; no auto-sync |
| Formula First | Rows keyed by `participant_id` / chain order |

## 1.12 Acceptance criteria

- [ ] Participants tab shows KPI panel **above** chain table.
- [ ] Table has exactly 10 columns in specified order.
- [ ] One row per participant; sorted by sequence.
- [ ] Confirmed net profit uses cash records only (not schedules).
- [ ] Mobile card layout matches column semantics.
- [ ] No write controls; no `MockPreviewNote` on read-only panel.
- [ ] Visible when formula is closed or canceled.

## 1.13 Definition of done

KPI panel implemented in `detail-panels.tsx`, wired in `formula-detail-view.tsx` Participants tab, `deriveParticipantConfirmedKpi` in `formula-math.ts`, types exported, `tsc` and `build` pass.

---

# Feature 2 — Status Log Viewer

## 2.1 Feature purpose

Provide a **dedicated, authoritative status-log table** for the six canonical status domains (`trade`, `cashIn`, `cashOut`, `invoice`, `logistics`, `delivery`), separate from the mixed activity timeline.

## 2.2 Backend source

| Item | Source |
|------|--------|
| Table | `formula_status_logs` / `StatusLog` model (`prisma/schema.prisma`) |
| Write paths | Cancel formula (×6 logs), logistics status PATCH (`logistics.service.ts`) |
| Read path | Embedded in formula payload today; **no standalone list HTTP route** |
| Frontend type | `StatusLog` (`web/lib/types.ts` lines 406–416) |

## 2.3 Screen

**Formula Detail → Timeline tab** (`/formulas/[id]` → tab value `timeline`)

## 2.4 Component hierarchy

```
FormulaDetailView
└── TabsContent value="timeline"
    └── TimelineWorkflowChrome (batch-2-workflows.tsx) — MODIFY
        ├── StatusLogViewerSection (NEW)
        │   ├── StatusLogTypeFilters (inline chips)
        │   └── StatusLogTable (NEW, in detail-panels.tsx)
        ├── [divider / spacing]
        └── Activity timeline block (existing)
            ├── existing event-type filter chips
            ├── existing deferred-API note
            └── TimelinePanel (existing)
```

### New exports from `detail-panels.tsx`

- `StatusLogTable({ formula, statusTypeFilter }: { formula: Formula; statusTypeFilter: StatusLogType | "all" })`

### Modify `TimelineWorkflowChrome` in `batch-2-workflows.tsx`

Add **second filter state** independent of activity timeline filter:

- `statusLogFilter: StatusLogType | "all"` — default `"all"`

## 2.5 User flow

1. User opens **Timeline** tab.
2. **Section A (top):** Status Logs — user filters by status type chip → table updates.
3. **Section B (below):** Activity Timeline — existing behavior unchanged.
4. Read-only; no modal.

**Entry point:** Timeline tab.  
**Exit point:** Tab change.

## 2.6 Visual layout

### Section A — Status Logs (NEW, appears FIRST)

**Section header:**

- Label: **Status Logs** (`text-xs font-semibold uppercase tracking-wide text-muted-foreground`)
- Subcopy (`text-xs text-muted-foreground`, one line below):
  > Canonical status change history from `formula.statusLogs`. Six domains: trade, cash in, cash out, invoice, logistics, delivery.

**Filter chips row** (`flex flex-wrap gap-2`, `mb-3`):

| Chip label | Filter value |
|------------|--------------|
| All | `all` |
| Trade | `trade` |
| Cash In | `cashIn` |
| Cash Out | `cashOut` |
| Invoice | `invoice` |
| Logistics | `logistics` |
| Delivery | `delivery` |

Active chip: `border-accent bg-accent-soft text-accent` (same as timeline event chips).

**Table** (`rounded-lg border border-border overflow-hidden`):

| # | Column | Content | Width |
|---|--------|---------|-------|
| 1 | Domain | `statusType` human label (Trade, Cash In, Cash Out, Invoice, Logistics, Delivery) | 100px |
| 2 | Previous | `previousStatus` or em dash | 120px |
| 3 | New | `newStatus` as `StatusBadge` using existing status config when possible | 120px |
| 4 | Changed | `formatDate(changedAt)` + time `toLocaleTimeString` | 140px |
| 5 | By | `changedBy` | 120px |
| 6 | Memo | `memo` or em dash; truncate with `title` tooltip if long | flex |

**Sort:** `changedAt` descending (newest first).

**Mobile:** Card per log entry with same fields stacked.

### Section divider

`mt-6 mb-4 border-t border-border pt-6`

### Section B — Activity Timeline (EXISTING)

- Keep label: **Activity Timeline** as new `text-xs font-semibold uppercase` header above existing filter row.
- Keep existing `TimelinePanel` + event filters + Group C note unchanged below header.

### Primary / secondary actions

None.

## 2.7 Mock preview behavior

- Data source: `formula.statusLogs` array only.
- **Do not** synthesize logs from timeline events.
- When cancel/logistics mutations append logs via `formula-preview-mutations.ts`, table updates automatically through workflow context.

## 2.8 RBAC behavior

All roles: **visible**, read-only.

## 2.9 Closed / canceled behavior

| State | Behavior |
|-------|----------|
| Closed | Show all logs including transition to closed-related statuses |
| Canceled | Show logs; canceled-domain entries visible with `StatusBadge tone="outline"` |

## 2.10 States

| State | UI |
|-------|-----|
| **Empty** | `formula.statusLogs.length === 0` OR filter yields 0 → `SectionEmpty`: **No status log entries for this filter.** |
| **Loading** | N/A |
| **Read-only** | Always |

## 2.11 Timeline impact

- Status Log Viewer **does not** replace `TimelinePanel`.
- `buildTimeline()` may still project status logs into timeline events; both can coexist.
- Cancel formula continues to append 6 status logs (existing mutation).

## 2.12 Acceptance criteria

- [ ] Timeline tab shows Status Logs section **above** Activity Timeline.
- [ ] Table columns match §2.6 exactly.
- [ ] Filter chips filter `statusType` independently from activity timeline filter.
- [ ] Sorted newest-first.
- [ ] Empty state when no logs match filter.
- [ ] No write UI in this section.

## 2.13 Definition of done

`StatusLogTable` in `detail-panels.tsx`; `TimelineWorkflowChrome` updated; `formula-detail-view.tsx` unchanged (already uses `TimelineWorkflowChrome`); build passes.

---

# Feature 3 — Version Trigger UI Expansion

## 3.1 Feature purpose

Expose **all Formula Detail version-triggering fields** (per TOCS version policy) in the Versions tab, not only quantity + sell unit price. Each edit requires version confirmation and preview mutation.

## 3.2 Backend source

| Item | Source |
|------|--------|
| Version policy | `.cursor/rules/tocs-core.mdc` §3; `DECISION_LOG.md` |
| Triggering fields | `formulas.quantity`, `formulas.contract_exchange_rate`, `formulas.adjusted_exchange_rate`, `formula_participants` create/delete, `formula_participants.quantity`, `formula_participants.buy_unit_price`, `formula_participants.sell_unit_price`, `formula_logistics.total_logistics_cost`, `formula_shares.share_amount`, `formula_shares.share_rate` |
| Version create | `POST /api/v1/formulas/:formulaId/versions` (`version.routes.ts`) |
| Existing UI | `FormulaEditSimulation` — qty + sell unit only |
| Existing modal | `VersionTriggerModal` in `workflow-modals.tsx` |

**Note:** Share and participant add/delete already trigger versions elsewhere. This feature adds **detail editors** for remaining triggers not editable on detail today.

## 3.3 Screen

**Formula Detail → Versions tab** (`/formulas/[id]` → tab value `versions`)

## 3.4 Component hierarchy

```
FormulaDetailView
└── TabsContent value="versions"
    ├── VersionsPanel (existing — history list, unchanged position: top or left per current layout)
    └── VersionTriggerFieldsPanel (NEW — below or beside VersionsPanel per current grid)
        ├── MockPreviewNote (full width)
        ├── Section: Formula Quantity & Sell Price
        │   └── FormulaEditSimulation (existing — keep, do not duplicate)
        ├── Section: Exchange Rates (NEW, conditional)
        │   └── FxVersionTriggerSection
        ├── Section: Logistics Cost (NEW)
        │   └── LogisticsCostVersionTriggerSection
        └── Section: Participant Unit Economics (NEW)
            └── ParticipantEconomicsVersionTriggerSection
                └── ParticipantEconomicsEditModal (per row)
```

**Layout in Versions tab (vertical stack, `space-y-6`):**

1. `VersionsPanel` (existing version history + snapshot — keep first)
2. `VersionTriggerFieldsPanel` (new — second)

Do **not** move `FormulaEditSimulation` out of `VersionsPanel` if currently nested there; if nested, lift so single `FormulaEditSimulation` instance lives inside `VersionTriggerFieldsPanel` § Formula Quantity.

## 3.5 User flow — Exchange rates

1. User on Versions tab → **Exchange Rates** section (visible only if `formula.transactionCurrency !== formula.baseCurrency`).
2. User edits Contract Exchange Rate and/or Adjusted Exchange Rate inputs.
3. User clicks **Preview Version Change** (secondary) → opens `VersionTriggerModal`.
4. User confirms → `applyPreview` with `patchFormulaFxPreview`.
5. Panel shows before/after FX values; `latestVersionNo` increments; version history appends entry.

## 3.6 User flow — Logistics cost

1. User edits **Total Logistics Cost (KRW)** numeric input (maps to `formula.cost` / logistics rollup).
2. User clicks **Preview Version Change** → `VersionTriggerModal` → `patchLogisticsCostPreview`.
3. Expected profit recalculates in preview.

## 3.7 User flow — Participant unit economics

1. User sees read-only table of participants (seq, company, qty, buy unit, sell unit) with **Edit economics** button per row.
2. Click → `ParticipantEconomicsEditModal` with fields: quantity, buy unit price, sell unit price (version-triggering).
3. User saves → `VersionTriggerModal` → `patchParticipantEconomicsPreview(participantId, { quantity, buyUnitPrice, sellUnitPrice })`.
4. Participant row + formula totals update; version bumps.

**Entry point:** Versions tab.  
**Exit point:** Modal close or successful preview apply.

## 3.8 Visual layout — VersionTriggerFieldsPanel

**Container:** `rounded-xl border border-border bg-card p-4`

**Panel title row:**

- Icon: `GitCommitVertical` `size-4 text-accent`
- Title: **Version-Triggering Fields** (`text-sm font-semibold`)
- Subcopy: `text-xs text-muted-foreground` — *Changes here create formula_versions + calculation_snapshots + audit_logs on the backend.*

**MockPreviewNote:** full width, top of panel body.

### Subsection order (mandatory)

| # | Section title | Visibility | Primary action button |
|---|---------------|------------|------------------------|
| 1 | Formula Quantity & Sell Price | Always (if `canCommitVersion`) | Existing **Commit Version (Preview)** inside `FormulaEditSimulation` |
| 2 | Exchange Rates | Only if `transactionCurrency !== baseCurrency` | **Apply FX Change (Preview)** |
| 3 | Logistics Cost | Always (if `canCommitVersion`) | **Apply Logistics Cost (Preview)** |
| 4 | Participant Unit Economics | Always (if `canCommitVersion`) | Per-row **Edit economics** → modal **Save (Preview)** |

Each subsection: `border-t border-border pt-4 mt-4` except first.

### Exchange Rates fields (order)

| Field label | Input | Default |
|-------------|-------|---------|
| Contract Exchange Rate | `Input type="number"` step 0.01 | `formula.contractExchangeRate` |
| Adjusted Exchange Rate | `Input type="number"` step 0.01 | `formula.adjustedExchangeRate` |

Below inputs: read-only line — `Base: {baseCurrency} · Transaction: {transactionCurrency}`

### Logistics Cost fields

| Field label | Input | Default |
|-------------|-------|---------|
| Total Logistics Cost (KRW) | `Input type="number"` min 0 | `formula.cost` |

Helper: `text-xs text-muted-foreground` — *Rollup of logistics legs; version-triggering per TOCS policy.*

### Participant economics table

| Column | Content |
|--------|---------|
| Seq | sequence order |
| Company | name |
| Quantity | formatted |
| Buy Unit | formatted |
| Sell Unit | formatted |
| Action | `Button variant="outline" size="sm"` — **Edit economics** |

### ParticipantEconomicsEditModal

**Title:** Edit Participant Economics  
**Description:** Version-triggering fields for this participant hop.  
**Fields (order):**

1. Quantity (`number`, min 1)
2. Buy Unit Price (KRW)
3. Sell Unit Price (KRW)

**Footer:**

- Secondary: **Cancel** (`variant="outline"`)
- Primary: **Continue** → opens `VersionTriggerModal` → on confirm runs mutation

### Version trigger indicator

When any subsection has dirty inputs, show accent banner (same pattern as `FormulaEditSimulation` lines 172–184):

> This change would create a new Version + Snapshot after backend integration.

List triggered field labels explicitly.

## 3.9 New preview mutations (`formula-preview-mutations.ts`)

| Function | Trigger |
|----------|---------|
| `patchFormulaFxPreview(f, { contractExchangeRate?, adjustedExchangeRate? })` | FX change |
| `patchLogisticsCostPreview(f, totalLogisticsCost: number)` | Updates `f.cost` and syncs `f.logistics[].cost` rollup display via `recomputeFormulaPreview` |
| `patchParticipantEconomicsPreview(f, participantId, { quantity, buyUnitPrice?, sellUnitPrice? })` | Participant version trigger |

Each must call `applyVersionTriggerPreview` after recompute with summary string.

## 3.10 RBAC behavior

| Cap | Behavior |
|-----|----------|
| `caps.canCommitVersion === false` | Hide entire `VersionTriggerFieldsPanel`; `VersionsPanel` history remains visible (read-only) |
| VIEWER | History only |
| MANAGER+ | Editors visible when open formula |
| COMPANY_ADMIN+ | Same as MANAGER for this feature |

## 3.11 Closed / canceled behavior

| State | Behavior |
|-------|----------|
| `formula.isClosed` | Hide `VersionTriggerFieldsPanel` entirely |
| `formula.canceledAt` | Hide `VersionTriggerFieldsPanel` entirely |
| History panel | Always visible |

## 3.12 States

| State | UI |
|-------|-----|
| **Validation** | FX rates must be > 0 when transaction currency differs; logistics cost ≥ 0; participant quantity ≥ 1 |
| **Warning** | `!after.endpointsResolved` warning from `FormulaEditSimulation` remains for qty section only |
| **Error** | Modal confirm disabled until required numeric fields valid |
| **Empty participants** | Participant economics table → `SectionEmpty`: **No participants to edit.** |

## 3.13 Related components

- Reuse `VersionTriggerModal` — do not fork.
- `appendVersion` + `applyPreview` from `useFormulaWorkflow()`.
- Shares: **do not duplicate** share editor (already in Shares tab).

## 3.14 Impact

| Area | Impact |
|------|--------|
| Timeline | New version entries appear via `versionHistory` |
| Status logs | No automatic new status logs from version (unless product adds) |
| Settlement | Recalculated expected/realized via `recomputeFormulaPreview` |
| Formula First | All edits scoped to current `formula_id` |

## 3.15 Acceptance criteria

- [ ] Versions tab shows version history + expanded trigger panel.
- [ ] FX section hidden for domestic (same currency) formulas.
- [ ] Logistics cost editable with version confirm.
- [ ] Each participant row has economics edit modal with version confirm.
- [ ] All three new mutators in `formula-preview-mutations.ts`.
- [ ] Closed/canceled formulas hide editors, show history only.
- [ ] `MockPreviewNote` on panel.

## 3.16 Definition of done

`VersionTriggerFieldsPanel` + subsections implemented; `formula-edit-simulation.tsx` integrated; mutations added; Versions tab wired; `tsc` + `build` pass.

---

# Feature 4 — Company Contacts UI

## 4.1 Feature purpose

Represent the backend **`company_contacts` collection** in Company Master UI: multiple contacts per company with primary flag, active flag, and schema-aligned fields.

## 4.2 Backend source

| Item | Source |
|------|--------|
| Table | `company_contacts` (`db/schema/tocs_base_schema.sql` lines 105–118) |
| Prisma | `CompanyContact` model (`schema.prisma` lines 186–204) |
| Company routes | `POST/GET /api/v1/companies` only — **no contact CRUD HTTP (G9)** |
| Frontend type | `CompanyContact` (`web/lib/types.ts`) — **must align to schema** |

### Schema field mapping (mandatory)

| DB column | UI label | Type | Required |
|-----------|----------|------|----------|
| `contact_name` | Contact Name | text | yes |
| `title` | Title | text | no |
| `phone` | Phone | text | no |
| `email` | Email | email | no |
| `branch_address` | Branch Address | textarea or text | no |
| `is_primary` | Primary contact | checkbox | no (max one true) |
| `is_active` | Active | checkbox | default true |
| `memo` | Memo | text | no |

**Deprecate in contacts collection (keep on company for legacy display only):** single `contactPerson`, `department`, `position` on `RegisteredCompany` — do not remove fields; **Contacts collection is authoritative** for new edits.

## 4.3 Screen

**Companies page** (`/companies`)

## 4.4 Component hierarchy

```
CompaniesExplorer
├── Company list/cards (existing)
├── SidePanel CompanyDetail (MODIFY)
│   ├── existing meta sections
│   └── CompanyContactsReadOnlyTable (NEW)
├── CompanyFormModal (MODIFY)
│   ├── existing sections Basic, Registration, Address, Additional
│   ├── Contact section (REPLACE single-field block)
│   │   └── CompanyContactsEditor (NEW)
│   └── MockPreviewNote (edit mode + G9 — existing)
└── Create flow — same modal with CompanyContactsEditor
```

### New components (in `companies-explorer.tsx` or `web/components/companies/company-contacts.tsx`)

- `CompanyContactsEditor` — editable list in modal
- `CompanyContactsReadOnlyTable` — detail drawer read view

## 4.5 User flow — View contacts

1. User opens `/companies` → clicks company card.
2. Side panel shows **Contacts** section with table of `company.contacts[]`.
3. If empty → empty state.

## 4.6 User flow — Edit contacts (COMPANY_ADMIN+)

1. User clicks **Edit** (existing, admin only).
2. Modal opens with **Contacts** section showing editable rows.
3. User clicks **Add contact** → new blank row appended.
4. User sets one **Primary** checkbox → UI clears other primaries.
5. User clicks **Save Changes** → updates preview session via `registerCreatedCompany` / list state (existing pattern).
6. Primary contact sync: copy primary contact's `contact_name` to `RegisteredCompany.contactPerson` for backward compatibility.

## 4.7 User flow — Create company with contacts

1. **New Company** → modal includes empty `CompanyContactsEditor` with one default blank row.
2. On create, persist `contacts` array in preview company object.

**Entry points:** Company detail Edit, New Company.  
**Exit points:** Modal cancel/save, panel close.

## 4.8 Visual layout — CompanyContactsEditor (modal)

**Section title:** Contacts (`FormSection title="Contacts"`)

**Top row:**

- Left: helper `text-xs text-muted-foreground` — *Mirrors `company_contacts` collection. Backend contact CRUD not shipped (G9) — preview only.*
- Right: `Button variant="outline" size="sm"` **Add contact** with `Plus` icon

**Contact row card** (`rounded-lg border border-border p-3 mb-3`, repeat per contact):

| Row field order (grid `sm:grid-cols-2 gap-3`) |
|-----------------------------------------------|
| 1. Contact Name (full width `sm:col-span-2`) |
| 2. Title |
| 3. Phone |
| 4. Email (full width `sm:col-span-2`) |
| 5. Branch Address (full width `sm:col-span-2`) |
| 6. Memo (full width `sm:col-span-2`) |
| 7. Checkboxes row: **Primary contact** · **Active** |
| 8. Row action right-aligned: `Button variant="ghost" size="sm" text-danger` **Remove** (disabled if only one row) |

**Validation:**

- Contact Name required per row with any other field filled.
- At most one `isPrimary === true` (enforce on checkbox change).
- Email: basic `@` check if non-empty.

**Remove:** deletes row from draft array (confirm not required — modal cancel discards).

### CompanyContactsReadOnlyTable (side panel)

**Section header:** Contacts (`text-xs font-semibold uppercase`)

**Table columns:** Name · Title · Phone · Email · Primary · Active

| Primary | `StatusBadge tone="accent"` **Primary** or empty |
| Active | `StatusBadge tone="success"` Active / `tone="neutral"` Inactive |

**Empty:** *No contacts registered — add via Edit.*

## 4.9 Mock preview behavior

**Extend `web/lib/company-preview-session.ts`:**

- Persist `contacts: CompanyContact[]` on company create/edit.
- Generate `id` with `contact-${Date.now()}-${seq}` for new rows.

**Update `web/lib/types.ts` `CompanyContact`:**

```ts
export type CompanyContact = {
  id: string
  name: string           // maps contact_name
  title?: string
  phone?: string
  email?: string
  branchAddress?: string // maps branch_address
  isPrimary?: boolean
  isActive?: boolean     // default true
  memo?: string
}
```

**Seed data:** Add `contacts[]` to at least 2 entries in `registeredCompanies` (`mock-data.ts`) for demo.

## 4.10 RBAC behavior

| Role | View contacts | Edit contacts |
|------|---------------|---------------|
| VIEWER | Read-only table in side panel | No Edit button (existing) |
| MANAGER | Read-only | No Edit (existing) |
| COMPANY_ADMIN+ | Read-only | Full editor in modal |
| SUPER_ADMIN | Read-only | Full editor |

**New Company button:** unchanged (P2 RBAC out of scope) — contacts editor appears in create modal for all roles that can create.

## 4.11 Backend gap surfacing

- Edit modal: existing `MockPreviewNote` + description **Preview only — no company update API (backend gap G9).**
- Contacts section helper references G9 explicitly.
- **Do not** imply contacts persist to backend.

## 4.12 States

| State | UI |
|-------|-----|
| **Loading** | N/A |
| **Empty** | Side panel + editor with zero rows → show one empty row in editor only |
| **Error** | Inline under Contact Name if validation fails on save |
| **Read-only** | Side panel for non-admin |

## 4.13 Formula First impact

None — Company Master is horizontal; contacts do not create Formula roots.

## 4.14 Acceptance criteria

- [ ] `CompanyContact` type matches schema fields.
- [ ] Modal replaces single Contact Person block with multi-row editor.
- [ ] Side panel shows contacts table.
- [ ] Primary checkbox enforces single primary.
- [ ] Save updates preview session with `contacts[]`.
- [ ] Primary syncs to `contactPerson` on company.
- [ ] G9 copy visible on edit.
- [ ] Seed companies include sample `contacts`.

## 4.15 Definition of done

Contacts editor + read table implemented; types aligned; preview session persists contacts; companies explorer wired; `tsc` + `build` pass.

---

# Appendix A — Wire-up checklist for v0

| # | File change | Feature |
|---|-------------|---------|
| 1 | `detail-panels.tsx` — add `ParticipantConfirmedKpiPanel`, `StatusLogTable` | 1, 2 |
| 2 | `formula-detail-view.tsx` — insert KPI panel in participants tab | 1 |
| 3 | `batch-2-workflows.tsx` — extend `TimelineWorkflowChrome` | 2 |
| 4 | `formula-math.ts` — `deriveParticipantConfirmedKpi` | 1 |
| 5 | `formula-preview-mutations.ts` — FX, logistics, participant economics | 3 |
| 6 | New `version-trigger-fields-panel.tsx` OR section in `formula-edit-simulation.tsx` | 3 |
| 7 | `formula-detail-view.tsx` — Versions tab compose | 3 |
| 8 | `types.ts` — `CompanyContact` alignment | 4 |
| 9 | `company-preview-session.ts` + `mock-data.ts` seeds | 4 |
| 10 | `companies-explorer.tsx` or `company-contacts.tsx` | 4 |

---

# Appendix B — Global acceptance (all four features)

- [ ] No new top-level routes.
- [ ] No HTTP/repository calls from UI.
- [ ] `MockPreviewNote` on every write surface (not on read-only KPI/status log tables).
- [ ] RBAC hide pattern respected.
- [ ] Closed/canceled rules respected per feature.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run build` passes.
- [ ] Formula First preserved.

---

**Handoff:** Implement all four features in one pass from this document. Do not reinterpret scope. Do not add Portfolio Unmatched Payments, payment/invoice DTO expansion, search, notifications, settings, or calendar changes.
