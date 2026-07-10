# TOCS P1 Fix Implementation Specification

| Field | Value |
|-------|--------|
| **Version** | v1.0.0 |
| **Status** | Implementation-ready for v0 (one-pass) |
| **Mode** | Mock preview UI/UX only |
| **Baseline** | `tocs-frontend-design` @ `662aeab` |
| **Source** | Final QA Report — P1-01, P1-02, P1-03 only |
| **Audience** | v0 UI implementation agent |

**Scope:** Fix exactly three P1 gaps. Do **not** implement P2 items. Do **not** refactor unrelated code.

**Authority:** `TOCS_UX_IMPROVEMENT_SPEC.md` v1.1.0 (P1-2, P1-1 Close step), `TOCS_STATUS_WORKFLOW_UI_SPEC.md` v2.1.0 (D-04), `TOCS_V0_FINAL_IMPLEMENTATION_BRIEF.md` §10 Working Rules.

---

## Global rules (all P1 fixes)

| Rule | Requirement |
|------|-------------|
| UI/UX only | No `fetch`, no repository, no `src/**` changes |
| No backend changes | No SQL, Prisma, API routes |
| No business rule changes | Close gate, derive rules, RBAC caps unchanged |
| Extend, do not redesign | Modify listed files only |
| Calculations | Do not change `deriveParticipantConfirmedKpi()`, `deriveInvoiceClose()`, `sixStatuses()`, `isCloseable()` |
| Status ≠ Version | Invoice status update must not call `applyVersionTriggerPreview` |
| Invoice verification | `amount_verified` remains derived — no manual toggle |
| Close irreversibility | Copy preserved; no Reopen UI |
| Verify after each fix | `npx tsc --noEmit`, `npm run build`, §10.10 step report |

### Files in scope

| File | P1 items |
|------|----------|
| `web/components/formulas/detail-panels.tsx` | P1-01, P1-03 (export shared hints) |
| `web/components/formulas/formula-detail-view.tsx` | P1-01, P1-03 |
| `web/components/formulas/workflows/batch-2-workflows.tsx` | P1-02 |
| `web/lib/formula-preview-mutations.ts` | P1-02 |
| `web/components/formulas/workflows/workflow-modals.tsx` | P1-03 |

**Do not touch** other files unless required for TypeScript imports of exported symbols.

---

# P1-01 — Participant KPI Explanation

## 1. Purpose

Align the Participants tab KPI panel with `TOCS_UX_IMPROVEMENT_SPEC.md` P1-2: users must understand Confirmed, Scheduled, Receivable, Payable, and the relationship to Settlement **without changing any KPI math**.

## 2. Current UI

- `ParticipantConfirmedKpiPanel` in `detail-panels.tsx` renders a collapsible **`KpiExplainer`** titled **“How these figures are calculated”** — column glossary in a `<dl>` grid.
- Missing: exact UX copy blocks, **“What do these numbers mean?”** label, Settlement relationship block, **View Formula Settlement** link.
- `ParticipantConfirmedKpiPanel` accepts only `{ formula }` — no `onNavigate`.
- Scheduled In/Out table headers are not visually muted.

## 3. Required UI

Replace **`KpiExplainer`** with **`ParticipantKpiExplainer`** matching UX spec P1-2 exactly:

- Collapsible header: **What do these numbers mean?**
- Default: **collapsed**
- Five narrative blocks (not a 2-column term grid)
- Block 5: bordered Settlement relationship + **View Formula Settlement** button
- Optional: muted **Scheduled In** / **Scheduled Out** column headers in desktop table

## 4. Exact screen / tab placement

`/formulas/[id]` → **Participants** tab → inside **`ParticipantConfirmedKpiPanel`**

**Order (top → bottom):**

1. Section header row (title + badges) — unchanged
2. **`ParticipantKpiExplainer`** — **new placement per spec** (below header, **above** existing one-line copy)
3. One-line copy (`v_participant_confirmed_kpi` mirror) — unchanged
4. KPI table / mobile cards — unchanged

## 5. Component(s)

| Action | Component | File |
|--------|-----------|------|
| **Replace** | `KpiExplainer` → `ParticipantKpiExplainer` | `detail-panels.tsx` |
| **Modify** | `ParticipantConfirmedKpiPanel` — add `onNavigate?` prop | `detail-panels.tsx` |
| **Modify** | Wire `onNavigate={setTab}` | `formula-detail-view.tsx` |

## 6. Button / link labels

| Control | Exact label |
|---------|-------------|
| Collapsible header | **What do these numbers mean?** |
| Settlement link | **View Formula Settlement** |

## 7. Field labels

No form fields. Collapsible sections use these **exact block titles and body copy**:

**Block 1 — Confirmed (cash actual)**

> **Confirmed In / Out** — Sum of **actual payment records** (bank movements) for this participant's company. Canceled records are excluded. This is cash-based, not planned.

**Block 2 — Scheduled (planned)**

> **Scheduled In / Out** — Sum of **payment schedules** (planned amounts) for this counterparty. Schedules are not confirmed money.

**Block 3 — Receivable / Payable**

> **Receivable** — Money still expected in (scheduled/receipts minus confirmed receipts). **Payable** — Money still owed out. These are outstanding balances, not profit.

**Block 4 — Confirmed Net**

> **Confirmed Net** — Confirmed In minus Confirmed Out for this participant hop. Illustrative per-participant cash result.

**Block 5 — Relationship to Settlement** (container: `rounded-lg border border-border bg-secondary/30 p-3`)

> Formula-level **Settlement** tab rolls up the same cash tiers for the whole Formula (scheduled vs actual, receivable, payable, close readiness). Participant KPI is **per-hop detail**; Settlement is **Formula-level totals and close gate**.

## 8. Validation rules

None — read-only explainer. No submit.

## 9. Empty state

When `deriveParticipantConfirmedKpi(formula)` returns **zero rows**: hide **`ParticipantKpiExplainer`** entirely; keep existing `SectionEmpty` only.

## 10. Closed / canceled formula behavior

| State | Behavior |
|-------|----------|
| Open | Explainer visible (when rows > 0) |
| Closed | Explainer visible; read-only |
| Canceled | Explainer visible when rows > 0; canceled badge unchanged |

## 11. RBAC behavior

All roles (VIEWER+) see explainer and **View Formula Settlement** link. Navigation is read-only tab switch.

## 12. Mock preview behavior

Copy-only. No mutations. Settlement link calls `onNavigate?.('settlement')`.

## 13. Formula First impact

None — explanatory copy only; KPI still derived from Formula + payment records.

## 14. Status Log / Timeline impact

None.

## 15. Version impact

None.

## 16. Acceptance criteria

- [ ] Header reads **What do these numbers mean?** (not “How these figures are calculated”)
- [ ] Five blocks match exact copy above
- [ ] Default collapsed
- [ ] **View Formula Settlement** navigates to Settlement tab
- [ ] Hidden when zero participant rows
- [ ] `deriveParticipantConfirmedKpi` unchanged
- [ ] Scheduled In/Out desktop headers use `text-muted-foreground` (optional but specified in UX spec)

## 17. Definition of Done

`ParticipantKpiExplainer` replaces `KpiExplainer`; `onNavigate` wired from `formula-detail-view.tsx`; typecheck + build pass.

## 18. Instruction to v0

1. Delete or replace `KpiExplainer` with `ParticipantKpiExplainer` using exact UX copy — do not paraphrase.
2. Add `onNavigate?: (tab: string) => void` to `ParticipantConfirmedKpiPanel`.
3. In `formula-detail-view.tsx` Participants tab: `<ParticipantConfirmedKpiPanel formula={formula} onNavigate={setTab} />`.
4. Do not alter KPI table columns, `deriveParticipantConfirmedKpi`, or payment math.
5. Keep existing per-header `KpiHeaderCell` tooltips; add muted styling to Scheduled In/Out headers only.

---

# P1-02 — Invoice Status Reason / Memo

## 1. Purpose

Align `InvoiceStatusModal` with Status Workflow spec D-04 §0.1 and §5: invoice row status changes (especially revoke/re-match) require **Reason** (required) and **Memo** (optional). When formula-level invoice rollup flips, append one canonical StatusLog event for Timeline/History.

## 2. Current UI

- `InvoiceStatusModal` in `batch-2-workflows.tsx`: Status enum `<Select>` only.
- Save calls `updateInvoiceStatusPreview(f, invoice.id, status)` — no reason/memo.
- No formula-level `statusType: "invoice"` log on rollup change.
- `amount_verified` shown read-only — **correct**; preserve.

## 3. Required UI

Extend modal with:

1. Reuse **`ReasonMemoFields`** + **`isReasonValid`** from `status-completion-modal.tsx` (same min 3 chars as six-status modals).
2. **Update (Preview)** disabled until `isReasonValid(reason)`.
3. Read-only derived verification block unchanged.
4. Helper note: `Reason is recorded when the formula-level invoice rollup changes.`

## 4. Exact screen / tab placement

`/formulas/[id]` → **Invoices** tab → per-row **Update Status** action → **`InvoiceStatusModal`**

## 5. Component(s)

| Action | File |
|--------|------|
| **Modify** | `batch-2-workflows.tsx` — `InvoiceStatusModal` |
| **Modify** | `formula-preview-mutations.ts` — `updateInvoiceStatusPreview` |

**Import:**

```ts
import { ReasonMemoFields, isReasonValid, type StatusActionInput } from "./status-completion-modal"
```

## 6. Button labels

| Control | Label |
|---------|-------|
| Primary | **Update (Preview)** (unchanged) |
| Cancel | **Cancel** (unchanged) |

## 7. Field labels

| Field | Label | Required |
|-------|-------|----------|
| Status | **Status** | Yes (existing enum) |
| Reason | **Reason** | Yes, min 3 chars |
| Memo | **Memo (optional)** | No |

Use `ReasonMemoFields` defaults — do not rename Reason label.

## 8. Validation rules

| Rule | Behavior |
|------|----------|
| Reason | `reason.trim().length >= 3` (`isReasonValid`) |
| Memo | Optional; trim empty → omit |
| Status unchanged + Save | Still require Reason if user clicks Update (no-op mutator acceptable) |
| `amount_verified` | Never an input — display only |

## 9. Empty state

N/A — modal opens from existing invoice row.

## 10. Closed / canceled formula behavior

| State | Behavior |
|-------|----------|
| Open formula | Modal available when `caps.canWriteInvoices` (existing `InvoiceStatusActions` guard) |
| Closed | Invoice writes hidden by existing caps — unchanged |
| Canceled | Actions hidden — unchanged |

## 11. RBAC behavior

Unchanged — `InvoiceStatusActions` returns null when `!caps.canWriteInvoices`.

## 12. Mock preview behavior

- Full `MockPreviewNote` in modal body (unchanged).
- `updateInvoiceStatusPreview` receives `{ reason, memo? }`.
- Preview only — no HTTP.

## 13. Formula First impact

Invoice rows remain under Formula; rollup derived from `deriveInvoiceClose(f)`.

## 14. Status Log / Timeline impact

**Required mutator behavior** — extend `updateInvoiceStatusPreview`:

```ts
export function updateInvoiceStatusPreview(
  f: Formula,
  invoiceId: string,
  status: InvoiceRecord["statusEnum"],
  input: StatusActionInput,
): Formula
```

**Algorithm:**

1. Compute `beforeLabel = invoiceRollupLabel(f)` using helper below.
2. Apply invoice enum + external amount projection (existing switch logic — unchanged).
3. `next = recomputeFormulaPreview({ ...f, invoices })`.
4. Compute `afterLabel = invoiceRollupLabel(next)`.
5. If `beforeLabel !== afterLabel`, append **one** StatusLog:

```ts
appendStatusLog(f, "invoice", beforeLabel, afterLabel, {
  reason: input.reason,
  memo: input.memo,
})
```

6. Return `{ ...next, statusLogs: [...f.statusLogs, log] }` when log appended; else return `next`.

**Helper** (add to `formula-preview-mutations.ts` or import from `formula-math.ts`):

```ts
function invoiceRollupLabel(f: Formula): string {
  const inv = deriveInvoiceClose(f)
  if (inv.activeCount === 0) return "Missing"
  if (inv.done) return "Matched"
  return `${inv.matchedCount}/${inv.activeCount} Matched`
}
```

**Timeline:** Existing `buildTimeline()` projects StatusLog with `· Reason: {reason}` — no change needed when `reason` is set.

**Per-row change without rollup flip:** No formula-level log (D-04 spec).

## 15. Version impact

**None.** Do not call `applyVersionTriggerPreview` or increment `latestVersionNo`.

## 16. Acceptance criteria

- [ ] Reason required (min 3); Update disabled without it
- [ ] Memo optional
- [ ] `amount_verified` still read-only derived
- [ ] Matching all invoices → rollup log `… → Matched` with Reason in Status Log + Timeline
- [ ] Revoke match (enum `mismatched`/`pending`) → rollup log when gate flips with Reason
- [ ] No version increment on invoice status save
- [ ] `MockPreviewNote` present

## 17. Definition of Done

Modal fields + mutator signature updated; rollup flip logs verified on Timeline tab; build passes.

## 18. Instruction to v0

1. Add `reason` / `memo` state to `InvoiceStatusModal`; reset on open via `useEffect` (same pattern as status modals).
2. Import and render `ReasonMemoFields` below the verification `<dl>`.
3. Change `save()` to pass `{ reason: reason.trim(), memo: memo.trim() || undefined }`.
4. Extend `updateInvoiceStatusPreview` per §14 — **only** append log on rollup label change.
5. Do not add manual verification checkbox or PATCH `invoice_status` on formula header.
6. Export nothing new from batch-2 unless needed.

---

# P1-03 — Close Guidance (Lifecycle Guide → Close Dialog)

## 1. Purpose

Fix P1-03 from Final QA: Lifecycle Guide **Close** step must open **`CloseFormulaDialog`** even when `!formula.closeable`. Dialog must explain blocking statuses, remaining work, and resolution actions (matching `CloseReadinessPanel`). Primary close execution stays disabled until closeable.

## 2. Current UI

- `formula-detail-view.tsx` line ~220:

```ts
onRequestClose={() => (caps.canCloseOrCancel && formula.closeable ? setCloseOpen(true) : undefined)}
```

Close step click does **nothing** when formula is not closeable.

- `CloseFormulaDialog` shows six-status grid (Ready / value) but **no** per-status lifecycle action hints or navigation when blocked.
- `CloseReadinessPanel` on Overview already has full blocking list + G1–G4 hints — **not duplicated in dialog**.

## 3. Required UI

### A. Lifecycle Guide — Close step click

Always open dialog when user clicks Close step:

```ts
onRequestClose={() => setCloseOpen(true)}
```

No `formula.closeable` gate on open.

**RBAC note:** Close step remains visible to all roles (UX P1-1). Non-admin users may open the dialog read-only; see §11.

### B. CloseFormulaDialog — when `!formula.closeable && !formula.isClosed`

Insert **blocking guidance section** below six-status grid, **reusing the same copy** as `CloseReadinessPanel`:

- Title: **Not ready to close**
- Subtitle: `All six Formula statuses must be manually completed before close (DL-015).`
- List each `sixStatuses(formula)` where `!done`:
  - Status label + current value
  - Lifecycle action hint (G1–G4 honest copy)
  - **Go** button: **Fix on Overview** or **Open {tab}**
- Footer note: `Receivable, payable, and unmatched payment records are review only — they do not block close.`

When `formula.closeable`: show existing green-ready context in dialog (optional compact line): `All six statuses are complete.`

When `formula.isClosed`: dialog should not submit (button already disabled); existing behavior OK.

### C. Primary close button (unchanged rule)

```tsx
disabled={!formula.closeable || formula.isClosed || !caps.canCloseOrCancel}
```

Label: **Close Formula (Preview)** — only executable when closeable **and** COMPANY_ADMIN+.

## 4. Exact screen / tab placement

| Surface | Location |
|---------|----------|
| Lifecycle Guide Close step | Overview tab — step 9 |
| Enhanced dialog | Global — `CloseFormulaDialog` in `workflow-modals.tsx` |
| Wire fix | `formula-detail-view.tsx` |

## 5. Component(s)

| Action | File |
|--------|------|
| **Modify** | `formula-detail-view.tsx` — `onRequestClose` |
| **Modify** | `workflow-modals.tsx` — `CloseFormulaDialog` |
| **Modify** | `detail-panels.tsx` — **export** shared hints constant |

**DRY requirement:** Export `CLOSE_LIFECYCLE_HINTS` from `detail-panels.tsx`:

```ts
export const CLOSE_LIFECYCLE_HINTS: Record<string, { notDone: string; tab: string }> = { ... }
```

Import in `workflow-modals.tsx` for dialog blocking list — **single source of truth** with `CloseReadinessPanel`.

Add prop to dialog:

```ts
export function CloseFormulaDialog({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean
  onClose: () => void
  onNavigate?: (tab: string) => void
})
```

Wire from `formula-detail-view.tsx`: `onNavigate={(t) => { setTab(t); onClose(); }}` or close dialog after navigate — **close dialog when Go clicked**.

## 6. Button / link labels

Reuse `CloseReadinessPanel` labels exactly:

| Blocking status | Lifecycle hint (not done) | Go button |
|-----------------|---------------------------|-----------|
| trade | **Complete (Preview) in Formula Status — G2** | **Fix on Overview** |
| cashIn | **Complete (Preview) — G3; records do not auto-complete** | **Fix on Overview** |
| cashOut | **Complete (Preview) — G4; records do not auto-complete** | **Fix on Overview** |
| invoice | **Review Invoices — derive match via row status/amounts** | **Open invoices** |
| logistics | **Mark Delivered with reason** | **Open logistics** |
| delivery | **Complete (Preview) — G1** | **Fix on Overview** |

## 7. Field labels

No new form fields in dialog. Existing six-status grid labels unchanged.

## 8. Validation rules

| Rule | Behavior |
|------|----------|
| Close execution | Only when `formula.closeable && !formula.isClosed && caps.canCloseOrCancel` |
| Open dialog | Allowed regardless of closeable |
| DL-015 | Six statuses must be done — no new gates |

## 9. Empty state

When all six statuses done (`formula.closeable`): blocking section hidden; show readiness confirmation copy.

## 10. Closed / canceled formula behavior

| State | Lifecycle Close step | Dialog |
|-------|---------------------|--------|
| Closed | Read-only strip (existing) | Open shows closed state; submit disabled |
| Canceled | Guide hidden (existing) | N/A |

## 11. RBAC behavior

| Role | Close step click | Close Formula button in dialog |
|------|------------------|--------------------------------|
| VIEWER / MANAGER | Opens dialog (read-only guidance) | Hidden or disabled — use `!caps.canCloseOrCancel` |
| COMPANY_ADMIN+ | Opens dialog | Enabled only when `formula.closeable` |

Header Cancel/Close buttons remain admin-only (`caps.canCloseOrCancel`) — unchanged.

## 12. Mock preview behavior

`MockPreviewNote` + irreversibility copy preserved:

- `Close cannot be undone. Versions do not reopen a closed Formula.`
- No POST /close implied

## 13. Formula First impact

None — guidance only; close still uses `closeFormulaPreview` when allowed.

## 14. Status Log / Timeline impact

None from dialog open. Close submit unchanged (one close log on execute).

## 15. Version impact

None.

## 16. Acceptance criteria

- [ ] Click **Close** on Lifecycle Guide when `!closeable` → dialog opens
- [ ] Dialog lists all blocking statuses with G1–G4 hints
- [ ] **Go** buttons navigate to correct tab and close dialog
- [ ] **Close Formula (Preview)** disabled when `!closeable`
- [ ] No close executed when not closeable
- [ ] ADMIN-only execute when closeable
- [ ] `CLOSE_LIFECYCLE_HINTS` not duplicated (exported + imported)
- [ ] Close irreversibility copy still present

## 17. Definition of Done

Lifecycle + dialog behavior matches spec; shared hints exported; typecheck + build pass.

## 18. Instruction to v0

1. Change `onRequestClose` to `() => setCloseOpen(true)` — remove closeable gate.
2. Export `CLOSE_LIFECYCLE_HINTS` from `detail-panels.tsx`; import in `workflow-modals.tsx`.
3. Add blocking list UI to `CloseFormulaDialog` when `!formula.closeable && !formula.isClosed` — mirror `CloseReadinessPanel` list markup (extract shared `CloseBlockingList` subcomponent in `detail-panels.tsx` if needed; **optional** — duplicate markup acceptable if hints import is shared).
4. Pass `onNavigate` into `CloseFormulaDialog`; on Go click: `onNavigate?.(tab); onClose()`.
5. Add `!caps.canCloseOrCancel` to Close button disabled condition.
6. Do not change `closeFormulaPreview`, `isCloseable`, or receivable/payable non-gate rules.

---

# Implementation order

Execute in sequence (§10 Working Rules):

```
Step 1 — P1-01 Participant KPI explainer
Step 2 — P1-02 Invoice reason/memo + rollup log
Step 3 — P1-03 Close dialog + lifecycle wire
```

After each step: typecheck, build, §10.10 report.

---

# Validation checklist (all P1 fixes)

- [ ] `npx tsc --noEmit` pass
- [ ] `npm run build` pass
- [ ] P1-01: Settlement link works; exact copy
- [ ] P1-02: Invoice modal Reason required; rollup log on match flip
- [ ] P1-03: Close step opens dialog when blocked; submit still gated
- [ ] No P2 files touched (Versions dedup, etc.)
- [ ] No API/repository/backend files touched

---

# Appendix — QA traceability

| QA ID | Spec section | Primary file |
|-------|--------------|--------------|
| P1-01 | P1-01 above | `detail-panels.tsx`, `formula-detail-view.tsx` |
| P1-02 | P1-02 above | `batch-2-workflows.tsx`, `formula-preview-mutations.ts` |
| P1-03 | P1-03 above | `formula-detail-view.tsx`, `workflow-modals.tsx`, `detail-panels.tsx` |

---

**Handoff:** v0 implements Steps 1–3 only. Stop after validation checklist. Return §10.10 report per `TOCS_V0_FINAL_IMPLEMENTATION_BRIEF.md`.
