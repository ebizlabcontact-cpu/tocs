# TOCS UX Improvement Specification

| Field | Value |
|-------|--------|
| **Version** | v1.1.0 — Status Lifecycle Cross-Reference |
| **Status** | Implementation-ready for v0 (one-pass) |
| **Mode** | Mock preview only — no HTTP wiring |
| **Baseline** | `tocs-frontend-design` @ `3733c26` |
| **Audience** | v0 UI implementation agent |
| **Scope** | Approved UX improvements P1 + P2 only |
| **Companion** | `TOCS_STATUS_WORKFLOW_UI_SPEC.md` v2.0.0 (full status lifecycle) |

---

## Global rules (all improvements)

1. Extend existing files; do not replace `formula-detail-view.tsx`, `detail-panels.tsx`, `versions-panel.tsx`, `version-trigger-fields-panel.tsx`, `workflow-modals.tsx`, `header.tsx`, `mock-preview-note.tsx`.
2. Mock preview only — no `fetch`, no repository calls.
3. RBAC: **hide** controls the user cannot perform (match `permissions.ts` + `formulaWriteCaps`).
4. Closed formula: hide write affordances; read-only explanatory copy remains.
5. Canceled formula: hide all write affordances; read-only copy remains.
6. Do not change calculation logic in `formula-math.ts` or `formula-preview-mutations.ts` unless explicitly stated (Participant KPI explainer is copy-only).
7. **Status lifecycle** — Lifecycle Guide and Close Readiness must reflect the **full** status lifecycle (complete, revoke, re-complete, modify) defined in `TOCS_STATUS_WORKFLOW_UI_SPEC.md` v2.0.0 — not “complete only.”

---

# P1-1 — Lifecycle Guide

## Purpose

Guide users through the recommended Formula operating sequence without forcing a wizard. Reduce tab-hopping guesswork and make the next step obvious.

## Current UI

- Formula Detail has 10 horizontal tabs with no prescribed order.
- `SixStatusControls` on Overview shows 6/6 progress but does not map to tab sequence.
- User must infer: Participants → Payments → Invoices → Logistics → Shares → Versions → Settlement → Close.

## Target UI

A **Formula Lifecycle Guide** strip on the **Overview tab only**, positioned **between `SixStatusControls` and `MetadataWorkflowActions`**.

## Screen

`/formulas/[id]` → Overview tab

## Components

| Component | File | Export |
|-----------|------|--------|
| `FormulaLifecycleGuide` | `web/components/formulas/detail-panels.tsx` | New export |
| Wire-in | `web/components/formulas/formula-detail-view.tsx` | Import + render in Overview `TabsContent` |

### Props

```ts
{ formula: Formula; activeTab: string; onNavigate: (tab: string) => void; onRequestClose: () => void }
```

`formula-detail-view.tsx` passes `tab`, `setTab`, and `() => setCloseOpen(true)`.

## Layout

### Container

- `rounded-lg border border-border bg-card p-4`
- Section label: **Recommended Lifecycle** (`text-xs font-semibold uppercase tracking-wide text-muted-foreground`)
- Subcopy (one line): `Follow this sequence to prepare a Formula for close. Each step opens the related tab. Status completion, revocation, and re-completion are managed in Formula Status controls (see Status Workflow spec).`

### Step strip (desktop `sm+`)

Horizontal stepper with 9 steps + Close:

| # | Label | Tab value | Icon (lucide) |
|---|-------|-----------|---------------|
| 1 | Formula | `overview` | `LayoutDashboard` |
| 2 | Participants | `participants` | `Users` |
| 3 | Payments | `payments` | `CalendarClock` |
| 4 | Invoices | `invoices` | `FileText` |
| 5 | Logistics | `logistics` | `Ship` |
| 6 | Shares | `shares` | `PieChart` |
| 7 | Versions | `versions` | `GitCommitVertical` |
| 8 | Settlement | `settlement` | `Scale` |
| 9 | Close | — (header action) | `CheckCircle2` |

**Visual connector:** `→` or thin line between steps (`hidden on last`).

Each step is a **button** (`type="button"`):

- **Completed** (`stepDone(step)`): `border-success/30 bg-success-soft text-success`; check icon left of label.
- **Current** (matches `activeTab` or Close pending): `border-accent bg-accent-soft text-accent`.
- **Pending**: `border-border bg-secondary/40 text-muted-foreground`.
- **Blocked** (Close only when `!formula.closeable`): `border-warning/30 bg-warning-soft text-warning`.

### Per-step status chip (new — ties to full lifecycle)

Below each step label (desktop) or beside status chip (mobile), show micro status from `sixStatuses()` / invoice derive:

| Step | Chip source |
|------|-------------|
| Formula (overview) | `{done}/6 statuses ready` from `sixStatuses` count |
| Participants | `{n} participants` |
| Payments | `{schedule} schedules · {records} records` |
| Invoices | `deriveInvoiceClose`: **Matched** / **Incomplete** |
| Logistics | `logisticsStatus` label; **Complete** if done |
| Shares | `{n} shares` |
| Versions | `v{latestVersionNo}` |
| Settlement | **Reviewed** if `records.length > 0` else **Pending** |
| Close | **Closed** / **Ready** / **Blocked ({n} statuses)** |

Tooltip on Formula step chip: `Complete, revoke, and re-complete individual statuses in Formula Status below.`

Click behavior:

- Steps 1–8: `onNavigate(tabValue)`.
- Step Close: `onRequestClose()` (opens existing `CloseFormulaDialog`).

### Step completion rules (mock, deterministic)

| Step | `stepDone` when |
|------|-----------------|
| Formula | Always `true` (user is on detail) |
| Participants | `formula.participants.length >= 2` |
| Payments | `formula.schedule.length >= 1` |
| Invoices | `formula.invoices.length >= 1` |
| Logistics | `formula.logistics.length >= 1` |
| Shares | `(formula.shares ?? []).length >= 1` |
| Versions | `formula.latestVersionNo >= 1` (always true after create) |
| Settlement | User visited settlement tab once **OR** `formula.records.length >= 1` (use records length only — simpler) |
| Close | `formula.isClosed` |

### Mobile (`< sm`)

Replace horizontal strip with **vertical accordion list** (same 9 steps):

- Each row: icon + label + status chip (`Done` / `Next` / `Pending` / `Blocked`).
- Tap navigates same as desktop.
- Close row at bottom with same blocked logic.

## Interactions

- Hover on pending step: `hover:border-accent/40`.
- Close step when `!formula.closeable && !formula.isClosed`: show inline hint below strip: `Complete all six Formula statuses before close. Incomplete statuses can be completed or re-completed in Formula Status — revoke completion if marked done in error. See Close Readiness below.`
- When `formula.isClosed`: all steps show completed; Close shows `Closed` chip; strip is read-only (buttons become non-interactive `span` styling).
- When `formula.canceledAt`: hide entire `FormulaLifecycleGuide`.

## States

| State | UI |
|-------|-----|
| Open formula | Interactive strip |
| Closed | Read-only, all steps done styling |
| Canceled | Component not rendered |
| All Companies scope | Render read-only strip (navigation still works) |

## RBAC

- Visible to all roles (VIEWER included).
- Close step button visible to all; actual Close header action remains `caps.canCloseOrCancel` only.

## Mobile

Vertical list layout as specified.

## Acceptance Criteria

- [ ] Guide appears on Overview only, between Six Status and Metadata edit.
- [ ] Nine steps + Close in specified order with icons.
- [ ] Clicking a step switches Formula Detail tab.
- [ ] Close step opens existing Close dialog.
- [ ] Completed/pending/current/blocked visuals match rules.
- [ ] Hidden when formula is canceled.
- [ ] Desktop horizontal + mobile vertical layouts.

## Definition of Done

`FormulaLifecycleGuide` implemented, wired in `formula-detail-view.tsx`, `tsc` + `build` pass.

## Instruction to v0

Implement exactly as specified. Do not add backend calls. Do not add new routes. Reuse existing tab values and Close dialog.

---

# P1-2 — Participant KPI Explanation

## Purpose

Help users understand Confirmed, Scheduled, Receivable, Payable, and relationship to Settlement **without changing** `deriveParticipantConfirmedKpi()` or any calculations.

## Current UI

- `ParticipantConfirmedKpiPanel` has one-line copy referencing `v_participant_confirmed_kpi`.
- Ten-column table with no field glossary.
- No link to Settlement tab.

## Target UI

Add **`ParticipantKpiExplainer`** collapsible block **inside** `ParticipantConfirmedKpiPanel`, **below section header row, above existing one-line copy**.

## Screen

`/formulas/[id]` → Participants tab → KPI panel

## Components

| Component | Location |
|-----------|----------|
| `ParticipantKpiExplainer` | New function in `detail-panels.tsx`, used inside `ParticipantConfirmedKpiPanel` |

## Layout

### Collapsible header button

- Full width, `flex justify-between`, label: **What do these numbers mean?**
- Chevron rotates when open.
- Default state: **collapsed** on desktop; **expanded** on mobile (`sm:hidden` force open optional — use collapsed default everywhere for consistency).

### Expanded content (`text-xs leading-relaxed text-muted-foreground`, `space-y-3`)

**Block 1 — Confirmed (cash actual)**

> **Confirmed In / Out** — Sum of **actual payment records** (bank movements) for this participant’s company. Canceled records are excluded. This is cash-based, not planned.

**Block 2 — Scheduled (planned)**

> **Scheduled In / Out** — Sum of **payment schedules** (planned amounts) for this counterparty. Schedules are not confirmed money.

**Block 3 — Receivable / Payable**

> **Receivable** — Money still expected in (scheduled/receipts minus confirmed receipts). **Payable** — Money still owed out. These are outstanding balances, not profit.

**Block 4 — Confirmed Net**

> **Confirmed Net** — Confirmed In minus Confirmed Out for this participant hop. Illustrative per-participant cash result.

**Block 5 — Relationship to Settlement** (`rounded-lg border border-border bg-secondary/30 p-3`)

> Formula-level **Settlement** tab rolls up the same cash tiers for the whole Formula (scheduled vs actual, receivable, payable, close readiness). Participant KPI is **per-hop detail**; Settlement is **Formula-level totals and close gate**.

Include text link button: **View Formula Settlement** → calls `onNavigate?.('settlement')` — pass `onNavigate` prop from `formula-detail-view.tsx` through `ParticipantConfirmedKpiPanel`.

### Visual grouping hint (optional, no calc change)

Below explainer, add compact legend row:

| Badge | Meaning |
|-------|---------|
| `StatusBadge tone="info"` **Cash-based** | Existing header badge |
| Muted column headers Scheduled* | `text-muted-foreground` on Scheduled In/Out columns in table header only |

## Interactions

- Toggle explainer open/close.
- Settlement link switches tab to `settlement`.

## States

| State | UI |
|-------|-----|
| Empty participants | Explainer hidden; existing empty state only |
| Canceled | Explainer visible; existing canceled badge remains |
| Closed | Read-only; explainer visible |

## RBAC

All roles see explainer (read-only).

## Mobile

Explainer content stacks; table already uses cards on `sm:hidden`.

## Acceptance Criteria

- [ ] Collapsible explainer with all five blocks.
- [ ] No changes to `deriveParticipantConfirmedKpi`.
- [ ] Settlement link navigates to Settlement tab.
- [ ] Scheduled column headers visually muted.
- [ ] Default collapsed.

## Definition of Done

Explainer in `ParticipantConfirmedKpiPanel`; `onNavigate` prop wired from `formula-detail-view.tsx`; build passes.

## Instruction to v0

Copy-only improvement. Do not alter KPI math or table column set.

---

# P1-3 — Versions UX

## Purpose

Reduce scroll fatigue and cognitive load on Versions tab by grouping History, Snapshot, Version Trigger, Simulation, and Participant Economics into a clear hierarchy.

## Current UI

- `VersionsPanel` (history list + side panel snapshot) stacked above full `VersionTriggerFieldsPanel`.
- `VersionTriggerFieldsPanel` contains `MockPreviewNote`, `FormulaEditSimulation`, FX, Logistics Cost, Participant Economics — all expanded.
- `FormulaEditSimulation` has its own commit modal and preview note patterns.

## Target UI

Restructure **Versions tab only** into **three collapsible sections** with persistent snapshot behavior.

## Screen

`/formulas/[id]` → Versions tab

## Components

| Component | File | Change |
|-----------|------|--------|
| `VersionsTabLayout` | `web/components/formulas/versions-tab-layout.tsx` | **New file** |
| `VersionsPanel` | `versions-panel.tsx` | Remove outer `space-y-5` wrapper concerns; export history + side panel only |
| `VersionTriggerFieldsPanel` | `version-trigger-fields-panel.tsx` | Accept `defaultCollapsed` sections |
| `formula-detail-view.tsx` | Wire `VersionsTabLayout` instead of raw stack |

### `VersionsTabLayout` structure (top → bottom)

```
VersionsTabLayout
├── Section 1: Version History (CollapsibleSection, defaultOpen=true)
│   └── VersionsPanel (history list only; snapshot SidePanel unchanged)
├── Section 2: Version Snapshots (CollapsibleSection, defaultOpen=false)
│   └── Inline helper card explaining "Click a version row to open snapshot"
│   └── (SidePanel remains triggered from history rows — no duplicate list)
└── Section 3: Version-Triggering Edits (CollapsibleSection, defaultOpen=false)
    └── VersionTriggerFieldsPanel (restructured internals)
```

### `CollapsibleSection` (implement in same new file)

- Header row: title + chevron + optional `StatusBadge` (`N versions` / `Edits available`).
- `border rounded-lg bg-card` wrapper.
- Props: `title`, `description?`, `defaultOpen`, `children`.

### Section titles (exact)

| # | Title | Description (subtitle) | Default |
|---|-------|------------------------|---------|
| 1 | **Version History** | Chronological list of formula versions. | Open |
| 2 | **Snapshot Viewer** | Frozen calculation state at each version. Open any row in History. | Closed |
| 3 | **Version-Triggering Edits** | Changes that create a new version and snapshot. | Closed |

### `VersionTriggerFieldsPanel` internal grouping

Keep four subsections but wrap each in **nested collapsible** (simple disclosure, not full CollapsibleSection):

| Subsection | Title | Default |
|------------|-------|---------|
| A | **Simulation — Quantity & Sell Price** | Open |
| B | **Exchange Rates** (cross-border only) | Closed |
| C | **Logistics Cost Rollup** | Closed |
| D | **Participant Unit Economics** | Closed |

Move panel-level `MockPreviewNote` to **Section 3 header only** (once). Remove duplicate `MockPreviewNote` from inside `FormulaEditSimulation` when rendered inside this panel (add prop `hidePreviewNote?: boolean` to `FormulaEditSimulation`).

### Simulation placement rule

`FormulaEditSimulation` lives only inside subsection A. Do not duplicate elsewhere.

## Layout

- Section 1 min height: history list as today.
- Section 2: static info card only (no second list).
- Section 3: `VersionTriggerFieldsPanel` with nested disclosures.

## Interactions

- Collapse/expand sections independent.
- History row click still opens `SidePanel` snapshot (unchanged).
- All version-trigger edits unchanged functionally.

## States

| State | UI |
|-------|-----|
| `!caps.canCommitVersion` | Section 3 hidden entirely (existing rule) |
| Closed / canceled | Section 3 hidden; Sections 1–2 read-only |
| No versions | History shows existing empty handling |

## RBAC

Section 3 hidden when `!caps.canCommitVersion`.

## Mobile

Collapsible sections stack vertically; nested disclosures full width.

## Acceptance Criteria

- [ ] Three top-level collapsible sections on Versions tab.
- [ ] History default open; Snapshot helper + Edits default closed.
- [ ] Single `MockPreviewNote` in Section 3 header.
- [ ] `FormulaEditSimulation` accepts `hidePreviewNote`.
- [ ] Snapshot SidePanel behavior unchanged.
- [ ] No functional regression on version commit flows.

## Definition of Done

`versions-tab-layout.tsx` created; Versions tab wired; panel restructured; build passes.

## Instruction to v0

Layout-only restructure. Do not change preview mutation logic or `VersionTriggerModal` behavior.

---

# P1-4 — Close Guidance

## Purpose

When a Formula cannot be closed, explain **WHY**, **WHAT REMAINS**, and **WHICH STATUS** blocks closing. For each blocking status, show the **lifecycle action** available (Complete, Revoke if wrongly marked done, Modify, or Navigate). Show backend gaps honestly without implying live API exists.

## Current UI

- Header Close button disabled with label `Not Closeable` when `!formula.closeable`.
- `CloseFormulaDialog` lists six statuses Ready/not but only when dialog opened.
- `SixStatusControls` shows disabled `API missing` for four domains.
- No unified close-readiness explanation before user clicks Close.

## Target UI

**`CloseReadinessPanel`** on Overview tab, **below `FormulaLifecycleGuide`** (or below `SixStatusControls` if lifecycle not yet merged — order: Six Status → Lifecycle Guide → Close Readiness → Metadata).

Also enhance **header Close button** with tooltip when disabled.

## Screen

`/formulas/[id]` → Overview tab + Formula Detail header

## Components

| Component | File |
|-----------|------|
| `CloseReadinessPanel` | `web/components/formulas/detail-panels.tsx` |
| Header tooltip | `web/components/formulas/formula-detail-view.tsx` |

## Layout — `CloseReadinessPanel`

### When `formula.isClosed`

- Compact success card: **Formula closed** — `Closed at {date}. Trade data is locked; use Settlement for append-only corrections.`
- No blocking list.

### When `formula.canceledAt`

- Danger card: **Formula canceled** — `Close is not available. All six statuses are CANCELED.`

### When open and `!formula.closeable`

Card `border-warning/30 bg-warning-soft`:

**Title:** **Not ready to close**

**Subtitle:** `All six Formula statuses must be manually completed before close (DL-015).`

**Blocking list** — render from `sixStatuses(formula)` where `!done`:

| Column | Content |
|--------|---------|
| Status | Label (Trade, Cash In, …) |
| Current value | `s.value` |
| Lifecycle action | See table below |
| Go | Link button **Open {tab}** or **Fix on Overview** |

**Lifecycle action hints (exact copy):**

| Status key | If not done | If wrongly done (edge case) | Go |
|------------|-------------|----------------------------|-----|
| trade | **Complete (Preview)** in Formula Status — G2 | **Revoke Completion (Preview)** then fix | `overview` |
| cashIn | **Complete (Preview)** — G3; records do not auto-complete | **Revoke Completion (Preview)** | `overview` |
| cashOut | **Complete (Preview)** — G4; records do not auto-complete | **Revoke Completion (Preview)** | `overview` |
| invoice | **Review Invoices** — derive match via row status/amounts | Revoke match per invoice (status enum) | `invoices` |
| logistics | **Mark Delivered** with reason | **Revoke Completion** → in transit → re-complete | `logistics` |
| delivery | **Complete (Preview)** — G1 | **Revoke Completion (Preview)** | `overview` |

**Completed-status wrong-close prevention note** (when `closeable` false but all show done — should not happen; if `isCloseable` desync):

> If a status was marked complete in error, use **Revoke Completion** on that domain card before closing.

**Footer note:**

> Receivable, payable, and unmatched payment records are **review only** — they do not block close.

### When open and `formula.closeable`

Success card: **Ready to close** — `All six statuses are complete. COMPANY_ADMIN can close from the header. Close cannot be undone in MVP. After close, use Settlement for append-only corrections.`

## Header Close button enhancement

When `!formula.closeable && !formula.isClosed && caps.canCloseOrCancel`:

- Wrap button in `Tooltip` with content: `Not closeable — {n} status(es) incomplete. See Close Readiness on Overview.`
- `n` = count of `sixStatuses` where `!done`.

When `!caps.canCloseOrCancel`: keep hidden (unchanged).

## Interactions

- **Open {tab}** buttons call `onNavigate(tab)`.
- Panel updates live when formula preview state changes.

## States

| State | Panel |
|-------|-------|
| Closeable | Green ready card |
| Not closeable | Warning card + list |
| Closed | Success closed card |
| Canceled | Danger canceled card |

## RBAC

- Panel visible to all roles (read-only).
- Close action remains admin-only in header.

## Mobile

Blocking list becomes stacked cards per status.

## Acceptance Criteria

- [ ] Panel shows on Overview for all non-canceled formulas.
- [ ] Blocking statuses listed with hints and G1–G4 honesty.
- [ ] Invoice/logistics hints point to correct tabs.
- [ ] Header tooltip when Close disabled.
- [ ] Ready/closed/canceled states each have distinct card.

## Definition of Done

`CloseReadinessPanel` + header tooltip implemented; wired with `onNavigate`; build passes.

## Instruction to v0

Use existing `sixStatuses()` only. Do not invent new close rules. Backend gap labels must match `BACKEND_ROUTE_GAPS` IDs G1–G4. Lifecycle actions on each row must match `TOCS_STATUS_WORKFLOW_UI_SPEC.md` v2.0.0 button labels.

---

# P2-1 — Mobile Formula Detail Navigation

## Purpose

Make 10-tab Formula Detail usable on small screens without losing context.

## Current UI

- `TabsList` has `overflow-x-auto` but no scroll affordance.
- User may not notice additional tabs off-screen.

## Target UI

Add **mobile-only lifecycle quick nav** below `TabsList`.

## Screen

`/formulas/[id]` — all tabs

## Components

| Component | File |
|-----------|------|
| `FormulaDetailMobileNav` | `web/components/formulas/formula-detail-mobile-nav.tsx` (new) |

## Layout

- Visible only `lg:hidden`.
- Position: immediately below `TabsList`, `mb-3`.
- `Select` dropdown (use existing `Field` + `Select`):
  - Label: **Jump to section**
  - Options: all 10 tab labels with current tab selected.
  - On change: `setTab(value)`.

Additionally, add **fade edge indicators** on `TabsList` when scrollable:

- Left/right gradient `pointer-events-none` overlays when `scrollLeft > 0` or not at end.
- Implement with `ref` + scroll listener on `TabsList` — modify `web/components/ui/tabs.tsx` optional prop `showScrollHints?: boolean` on `TabsList`.

## Interactions

- Dropdown mirrors tab change.
- Tab strip scroll unchanged.

## States

Standard.

## RBAC

N/A

## Mobile

Primary target.

## Acceptance Criteria

- [ ] Dropdown visible below tabs on `< lg`.
- [ ] All 10 tabs in dropdown.
- [ ] Scroll hints on tab strip when content overflows.
- [ ] Desktop unchanged (dropdown hidden).

## Definition of Done

Mobile nav + scroll hints implemented; build passes.

## Instruction to v0

Do not add new tabs. Match existing `TabsTrigger` values exactly.

---

# P2-2 — Reduce Duplicated MockPreviewNote

## Purpose

Reduce visual noise from repeated mock-preview banners while keeping honesty on every **mutating** surface.

## Current UI

`MockPreviewNote` appears in: workflow toolbars (full width), many modals, `VersionTriggerFieldsPanel`, `SettlementRecordCancelSection`, company edit modal, `FormulaEditSimulation`, etc.

## Target UI

### Rule A — One note per **surface**

| Surface | Max notes |
|---------|-----------|
| Workflow toolbar | 1 (keep) |
| Modal | 1 in body top (keep) |
| Versions Section 3 | 1 in section header (after P1-3) |
| Settlement record cancel block | 1 (keep) |
| Company edit modal | 1 (keep) |

### Rule B — Remove duplicates

- `WorkflowToolbar` in `batch-2-workflows.tsx`: keep note.
- Individual modals opened **from** toolbar: keep modal note; do not also show toolbar note behind modal (unchanged).
- `FormulaEditSimulation`: when `hidePreviewNote={true}`, omit note (P1-3).
- `VersionTriggerFieldsPanel` subsections: no nested notes.

### Rule C — Compact variant

Add optional prop to `MockPreviewNote`:

```ts
{ compact?: boolean; className?: string }
```

**Compact** renders single line:

> **Preview only** — local state, no persistence.

Use **compact** in workflow toolbars; keep **full** in modals and first-time edit surfaces.

## Components

- `web/components/formulas/workflows/mock-preview-note.tsx`

## Acceptance Criteria

- [ ] `compact` variant added.
- [ ] Toolbars use compact note.
- [ ] Modals keep full note.
- [ ] No duplicate notes visible on Versions tab after P1-3.
- [ ] `FormulaEditSimulation` respects `hidePreviewNote`.

## Definition of Done

MockPreviewNote updated; call sites adjusted per rules A–C; build passes.

## Instruction to v0

Do not remove mock honesty from modals. Only dedupe and compact.

---

# P2-3 — Search / Notifications Placeholder UX

## Purpose

Prevent users from treating non-functional header controls as broken.

## Current UI

- Search button looks active; ⌘K badge implies shortcut.
- Notifications bell has red dot; looks like unread count.
- No feedback on click.

## Target UI

### Search button (`header.tsx`)

- Add `aria-disabled="true"`.
- Add `cursor-not-allowed opacity-70`.
- Remove or gray out ⌘K badge (`hidden` or `opacity-40`).
- Wrap in `Tooltip`: **Search — coming in a future release (preview UI).**
- `onClick`: prevent default; optional `toast` not required — tooltip sufficient.

### Notifications button

- Remove red dot **or** replace with small `Preview` text badge (`text-[9px] uppercase`).
- `Tooltip`: **Notifications — not available in preview.**
- `onClick`: no-op.

### AI sparkles button

- `Tooltip`: **AI Assistant — preview shell only.**

## Components

- `web/components/shell/header.tsx`

## Acceptance Criteria

- [ ] Search clearly non-functional but styled consistently.
- [ ] Notifications dot removed or labeled Preview.
- [ ] Tooltips on all three header utility buttons.
- [ ] No navigation on click.

## Definition of Done

Header updated; build passes.

## Instruction to v0

Visual/ARIA only. Do not implement search or notifications backend.

---

# Appendix — File checklist for v0

| # | File |
|---|------|
| 1 | `detail-panels.tsx` — Lifecycle Guide, KPI Explainer, Close Readiness |
| 2 | `formula-detail-view.tsx` — wire all Overview + header tooltip + props |
| 3 | `versions-tab-layout.tsx` — new |
| 4 | `versions-panel.tsx` — minor |
| 5 | `version-trigger-fields-panel.tsx` — nested disclosures |
| 6 | `formula-edit-simulation.tsx` — `hidePreviewNote` |
| 7 | `formula-detail-mobile-nav.tsx` — new |
| 8 | `tabs.tsx` — scroll hints optional |
| 9 | `mock-preview-note.tsx` — compact variant |
| 10 | `header.tsx` — placeholder UX |

---

**Handoff:** Implement P1 items first, then P2. One pass from this document.
