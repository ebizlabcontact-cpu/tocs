# TOCS v0 Final Implementation Brief

| Field | Value |
|-------|--------|
| **Version** | v1.1.0 — Final (+ v0 Working Rules) |
| **Status** | Handoff document for v0 — one-pass implementation |
| **Mode** | Mock preview UI/UX only |
| **Baseline** | `tocs-frontend-design` @ `3733c26` |
| **Audience** | v0 UI implementation agent |

**Authoritative sources (ONLY):**

| # | Document | Role |
|---|----------|------|
| 1 | `docs/implementation/TOCS_UX_IMPROVEMENT_SPEC.md` v1.1.0 | UX improvements P1 + P2 |
| 2 | `docs/implementation/TOCS_STATUS_WORKFLOW_UI_SPEC.md` v2.1.0 | Full status lifecycle (10 domains) |
| 3 | `docs/implementation/TOCS_MASTER_GAP_MATRIX.md` v2.0.0 | Gap honesty G1–G10; scope boundaries |
| 4 | `docs/decisions/DECISION_LOG.md` | DL-012, DL-013, DL-014, DL-015, DL-031, DL-032, DL-033 |
| 5 | `docs/master/TOCS_MASTER_SPEC.md` | Formula First Architecture |

**Do not invent requirements outside these documents.**

---

# 1. Purpose

This brief consolidates all approved design specifications into a **single implementation guide** for v0.

## What v0 implements

- **UI and UX only** — layout, components, modals, copy, RBAC visibility, mock preview mutations.
- **Formula Detail** improvements: lifecycle guide, close guidance, participant KPI explainer, versions tab restructure, full status workflow, mobile nav, mock-preview honesty, header placeholders.

## What v0 does NOT implement

| Forbidden | Reason |
|-----------|--------|
| Backend schema changes | PostgreSQL SQL is source of truth |
| API wiring (`fetch`, HTTP client, repository calls) | Out of scope — mock preview only |
| Changes to `src/**` (actions, services, repositories) | Backend layer frozen |
| Prisma migrate / db push | TOCS core rules |
| New business rules | Follow engine + DECISION_LOG only |
| Close undo / Cancel undo / Reopen | DL-033 V2 — not MVP |
| Payment records auto-completing Cash In/Out | DL-014 |
| Manual `amount_verified` toggle | DL-012 |
| Version creation on status change | DL-032 — status ≠ version |

Backend semantics are **already fixed**. v0 expresses them honestly in preview UI.

---

# 2. Global Rules

## 2.1 Formula First

- Formula is the top-level business unit. All flows start from `formula_id`.
- Never introduce Deal, Order, Project, Pipeline, Transaction, Contract, SalesOrder, PurchaseOrder as top-level entities.
- Company has no fixed role; role is in `formula_participants` only.
- Six statuses gate close (DL-013, DL-015): trade, cash in, cash out, invoice, logistics, delivery.

## 2.2 Mock Preview Only

- All mutations update **local preview state** via `applyPreview` / `formula-preview-mutations.ts`.
- Every mutating modal/surface shows `MockPreviewNote` (full in modals; compact in toolbars per P2-2).
- No `fetch`, no repository imports, no `ApiNotWiredError` throws from new UI.

## 2.3 No Fake Backend

- Do not imply live API persistence where none exists.
- Backend route gaps (G1–G4) show honest strip: `Backend route not shipped (G#). This action updates preview state only.`
- **Do not** use disabled “API missing” buttons for G1–G4 lifecycle actions — enable preview lifecycle (Status Workflow spec v2.1.0 supersedes older stub/disable guidance for these four domains).

## 2.4 No Business Rule Changes

- Use existing `sixStatuses()`, `isCloseable()`, `deriveInvoiceClose()`, `recomputeFormulaPreview()`, `formulaWriteCaps()` — extend only where specs explicitly require (status mutators, `buildTimeline` reason display, `StatusLog` shape).
- Receivable/payable do **not** block close (DL-015).
- Payment records do **not** update `cash_in_status` / `cash_out_status` (DL-014).

## 2.5 RBAC — Hide, Do Not Disable (Unless Specified)

Source: `web/lib/permissions.ts` → `formulaWriteCaps()`.

| Rule | Behavior |
|------|----------|
| Default | **Hide** write controls when `!cap` |
| Read surfaces | Visible to all roles including VIEWER |
| `canWrite` | MANAGER+, not All Companies, not canceled, not closed |
| `canCloseOrCancel` | COMPANY_ADMIN+, not closed, not canceled |
| `canCancelPayment` | COMPANY_ADMIN+, not All Companies, not canceled (works on closed formula for Settlement) |
| `canSettlementAppend` | COMPANY_ADMIN+, **closed only**, not canceled |
| `canCommitVersion` | MANAGER+, open formula only |

Exception: header Close button may show disabled with tooltip when `!closeable` (P1-4) — this is specified.

## 2.6 Closed Formula Policy (DL-033)

- `is_closed === true` → all version-trigger editors hidden; six-status cards read-only; normal Payments tab writes hidden.
- Post-close corrections: Settlement tab append-only (schedules, records, notes, payment record cancel).
- Close cannot be undone; versions do not reopen (§0.4 Status Workflow spec).

## 2.7 Canceled Formula Policy (DL-031)

- All six statuses → `CANCELED`; all normal write affordances hidden.
- Cancel cannot be undone in MVP.
- Close and Cancel header actions hidden when canceled.
- Lifecycle Guide and write toolbars not rendered.

## 2.8 Status ≠ Version (DL-032)

Status transitions create **History / Status Log / Timeline only** — never `formula_versions`.

Version triggers (quantity, prices, shares, logistics cost, FX, participant CRUD) are unrelated to status workflow UI.

## 2.9 History / Timeline / Status Log Consistency (§0.2 Status Workflow spec)

- **One canonical event per status transition** → `formula.statusLogs[]` row.
- Timeline **projects** from StatusLog via `buildTimeline()` — id `tl-status-${eventId}`.
- Status Log table displays canonical rows; add **Reason** column (Memo when present).
- Revoke Completion: **Reason required**, Memo optional; reason in History, Status Log, Timeline.
- Formula Cancel: 6 log rows, shared `correlationId`, 6 `eventId`s.

## 2.10 Backend Gaps G1–G10

From `TOCS_IMPLEMENTATION_MASTER_PLAN.md` §10 + `BACKEND_ROUTE_GAPS` + Gap Matrix:

| ID | Gap | v0 UI handling |
|----|-----|----------------|
| **G1** | No `PATCH …/delivery-status` | Preview lifecycle enabled; G1 strip in modals; **(Preview)** buttons |
| **G2** | No trade status route | Same |
| **G3** | No cash-in status route | Same; never derive from payment records |
| **G4** | No cash-out status route | Same |
| **G5** | No logistics vehicle CRUD | Read-only vehicle display; no Add Vehicle |
| **G6** | No payment schedule PATCH | Create-only; no schedule edit UI |
| **G7** | No invoice amount PATCH | Create + status enum only; no amount edit after create |
| **G8** | No Item HTTP API | Mock item catalog unchanged |
| **G9** | No company PATCH/DELETE | Edit/archive remain preview-only with G9 copy (existing) |
| **G10** | Status logs only (no audit_logs for logistics) | Timeline from `statusLogs`; no invented audit entries |

---

# 3. Implementation Order

**Execute in this exact sequence. Do not reorder or parallelize across steps.**

**Mandatory:** Follow §10 v0 Working Rules at every step — incremental delivery, verify before continuing, step completion report required.

```
Step 1  — Preview foundation (types + mutators + timeline)
    ↓
Step 2  — Status Workflow: shared components (cards + modals)
    ↓
Step 3  — Status Workflow: six-status domains D-01–D-06
    ↓
Step 4  — Status Workflow: formula + ledger D-07–D-10
    ↓
Step 5  — P1-1 Lifecycle Guide
    ↓
Step 6  — P1-4 Close Guidance (+ header Close tooltip)
    ↓
Step 7  — P1-2 Participant KPI Explainer
    ↓
Step 8  — P1-3 Versions UX restructure
    ↓
Step 9  — P2-1 Mobile Formula Detail navigation
    ↓
Step 10 — P2-2 MockPreviewNote dedup + compact variant
    ↓
Step 11 — P2-3 Search / Notifications placeholder UX
    ↓
Step 12 — Validation (§8)
```

### Step details

| Step | Work | Spec reference |
|------|------|----------------|
| **1** | Extend `StatusLog` (`reason`, `correlationId`); `StatusActionInput`; unified mutators; `buildTimeline()` Reason in description | Status §0.2, §1.5, Appendix A #10–11 |
| **2** | Create `status-lifecycle-card`, `status-completion-modal`, `status-revocation-modal`, `status-transition-modal` | Status §1.1–1.4 |
| **3** | Refactor `SixStatusControls`; wire D-01–D-06; logistics select → transition modal; invoice checklist | Status D-01–D-06 |
| **4** | Close/Cancel copy; `SettlementLifecycleNote`; payment record cancel reason; close dialog lines | Status D-07–D-10 |
| **5** | `FormulaLifecycleGuide` on Overview | UX P1-1 |
| **6** | `CloseReadinessPanel` + header tooltip | UX P1-4 |
| **7** | `ParticipantKpiExplainer` + `onNavigate` | UX P1-2 |
| **8** | `VersionsTabLayout` + nested disclosures + `hidePreviewNote` | UX P1-3 |
| **9** | `FormulaDetailMobileNav` + tab scroll hints | UX P2-1 |
| **10** | `MockPreviewNote` compact; dedupe per Rule A–C | UX P2-2 |
| **11** | Header search/notifications/AI tooltips | UX P2-3 |
| **12** | Full validation checklist | §8 below |

---

# 4. Component Checklist

## 4.1 Preview foundation

| Component | Location | Purpose | Action | Reuse | Dependencies | Target files | Expected behavior | Acceptance |
|-----------|----------|---------|--------|-------|--------------|--------------|-------------------|------------|
| `StatusLog` extension | `web/lib/types.ts` | Event identity fields | **Modify** | Existing type | Status §0.2 | `types.ts` | Add `reason`, `correlationId`; keep `memo?` | Typecheck passes |
| `StatusActionInput` | `web/lib/formula-preview-mutations.ts` | Mutator input shape | **Modify** | Existing mutators | `StatusLog` | `formula-preview-mutations.ts` | `{ reason, memo? }` on all domain mutators | One event per transition |
| `buildTimeline` | `web/lib/formula-math.ts` | Project status events | **Modify** | `statusLogs` loop | `StatusLog.reason` | `formula-math.ts` | Description: `· Reason: {reason}` | Timeline shows reason |
| `recomputeFormulaPreview` | `formula-preview-mutations.ts` | Formula consistency | **Reuse** | Existing | — | — | Cash In/Out never from payments | Unchanged rule |

## 4.2 Status Workflow — shared

| Component | Location | Purpose | Action | Reuse | Dependencies | Target files | Expected behavior | Acceptance |
|-----------|----------|---------|--------|-------|--------------|--------------|-------------------|------------|
| `StatusLifecycleCard` | `workflows/status-lifecycle-card.tsx` | Per-domain lifecycle buttons | **Create** | `StatusBadge`, caps | `formulaWriteCaps` | New file | Complete/Revoke/Modify visibility per §1.1 | Hidden when closed/canceled/!canWrite |
| `StatusCompletionModal` | `workflows/status-completion-modal.tsx` | Terminal complete | **Create** | `MockPreviewNote` | `completeDomainStatusPreview` | New file | Reason req, Memo opt, G strip | One event on submit |
| `StatusRevocationModal` | `workflows/status-revocation-modal.tsx` | Completed Cancel | **Create** | `MockPreviewNote` | `revokeDomainStatusPreview` | New file | Reason **required** | Reason in log + timeline |
| `StatusTransitionModal` | `workflows/status-transition-modal.tsx` | Intermediate modify | **Create** | Extension slots | `transitionDomainStatusPreview` | New file | Reason + Memo; attachment/reference hidden | Extensible props per §1.4 |
| `SixStatusControls` | `workflows/workflow-modals.tsx` | Overview six-status UI | **Modify** | `StatusLifecycleCard` | All modals | `workflow-modals.tsx` | Replace disabled API missing | Full lifecycle all domains |

## 4.3 Status Workflow — domain panels

| Component | Location | Purpose | Action | Reuse | Dependencies | Target files | Expected behavior | Acceptance |
|-----------|----------|---------|--------|-------|--------------|--------------|-------------------|------------|
| `InvoiceCompletionChecklist` | `detail-panels.tsx` | Invoice derive guidance | **Create** | `deriveInvoiceClose` | — | `detail-panels.tsx` | No formula-level complete toggle | Checklist when !done |
| `SettlementLifecycleNote` | `detail-panels.tsx` | Closed settlement copy | **Create** | — | D-10 | `detail-panels.tsx` | Append-only message | Visible when closed |
| Status Log Reason column | `detail-panels.tsx` | History display | **Modify** | `StatusLogTable` | `reason`, `memo` | `detail-panels.tsx` | Reason primary column | All transitions visible |
| Logistics select wiring | `batch-2-workflows.tsx` | Transition modal on select | **Modify** | `StatusTransitionModal` | — | `batch-2-workflows.tsx` | Select cannot set delivered without completion modal | No silent complete |
| Formula detail wire | `formula-detail-view.tsx` | Navigation + caps | **Modify** | Existing tabs | `onNavigate`, caps | `formula-detail-view.tsx` | Pass props to panels | All Overview panels wired |

## 4.4 UX P1 components

| Component | Location | Purpose | Action | Reuse | Dependencies | Target files | Expected behavior | Acceptance |
|-----------|----------|---------|--------|-------|--------------|--------------|-------------------|------------|
| `FormulaLifecycleGuide` | `detail-panels.tsx` | Operating sequence | **Create** | `sixStatuses` | P1-1 | `detail-panels.tsx` | 9 steps + Close; per-step chips | Overview only; hidden if canceled |
| `CloseReadinessPanel` | `detail-panels.tsx` | Close blocking explanation | **Create** | `sixStatuses`, G1–G4 | P1-4, Status cards | `detail-panels.tsx` | Lifecycle action hints per status | All four card states |
| Close header tooltip | `formula-detail-view.tsx` | Disabled Close explain | **Modify** | `Tooltip` | `sixStatuses` count | `formula-detail-view.tsx` | Tooltip when !closeable | Admin only visibility |
| `ParticipantKpiExplainer` | `detail-panels.tsx` | KPI glossary | **Create** | Collapsible | P1-2 | `detail-panels.tsx` | 5 blocks; default collapsed | No KPI math changes |
| `VersionsTabLayout` | `versions-tab-layout.tsx` | Versions hierarchy | **Create** | `CollapsibleSection` | P1-3 | New file | 3 sections; history open | Snapshot side panel unchanged |
| `VersionTriggerFieldsPanel` | `version-trigger-fields-panel.tsx` | Nested disclosures | **Modify** | — | P1-3 | `version-trigger-fields-panel.tsx` | 4 nested subsections | Single MockPreviewNote in header |
| `FormulaEditSimulation` | `formula-edit-simulation.tsx` | hidePreviewNote prop | **Modify** | — | P1-3 | `formula-edit-simulation.tsx` | Omit note when prop true | Deduped in Versions tab |

## 4.5 UX P2 components

| Component | Location | Purpose | Action | Reuse | Dependencies | Target files | Expected behavior | Acceptance |
|-----------|----------|---------|--------|-------|--------------|--------------|-------------------|------------|
| `FormulaDetailMobileNav` | `formula-detail-mobile-nav.tsx` | Mobile tab jump | **Create** | `Select` | P2-1 | New file | `lg:hidden` dropdown | All 10 tabs |
| Tab scroll hints | `ui/tabs.tsx` | Overflow affordance | **Modify** | `TabsList` ref | P2-1 | `tabs.tsx` | Gradient edges when scrollable | Desktop strip unchanged |
| `MockPreviewNote` compact | `mock-preview-note.tsx` | Toolbar dedup | **Modify** | — | P2-2 | `mock-preview-note.tsx` | `compact` prop | Toolbars compact; modals full |
| Header placeholders | `shell/header.tsx` | Non-functional honesty | **Modify** | `Tooltip` | P2-3 | `header.tsx` | Search/notifications/AI tooltips | No navigation on click |

---

# 5. Status Workflow Checklist

## 5.1 Summary matrix

| Domain | Complete | Revoke (Reason req.) | Re-complete | Modify | Gap | Version |
|--------|----------|---------------------|-------------|--------|-----|---------|
| D-01 Trade | ✓ | ✓ → confirmed | ✓ | draft→confirmed | G2 | None |
| D-02 Cash In | ✓ | ✓ → pending | ✓ | pending↔partial | G3 | None |
| D-03 Cash Out | ✓ | ✓ → pending | ✓ | pending↔partial | G4 | None |
| D-04 Invoice | derived | per-row revoke | re-match | status enum | — | None |
| D-05 Logistics | ✓ | ✓ → in_transit | ✓ | not_started↔in_transit | — (mock) | None |
| D-06 Delivery | ✓ | ✓ → in_transit | ✓ | pending↔in_transit | G1 | None |
| D-07 Close | ✓ once | **No MVP** | **No** | **No** | — | None |
| D-08 Cancel | ✓ once | **No undo** | **No** | **No** | — | None |
| D-09 Pay Record | register | cancel (409 re-cancel) | new record | **No** | — | None |
| D-10 Settlement | append | **No** | new record | append-only | — | None |

## 5.2 Per-domain detail

### D-01 Trade

| Item | Specification |
|------|---------------|
| **Buttons** | Complete (Preview), Revoke Completion (Preview), Modify (draft→confirmed) |
| **Dialogs** | `StatusCompletionModal`, `StatusRevocationModal`, `StatusTransitionModal` |
| **Lifecycle** | draft → confirmed → completed → revoke → re-complete |
| **Reason** | Required on Complete, Revoke, Modify |
| **Memo** | Optional on all three |
| **History** | Immutable `statusLogs`; one event per transition |
| **Timeline** | Projected; Reason in description |
| **Status Log** | `statusType: "trade"`; Reason column |
| **Version** | Unchanged |
| **RBAC** | MANAGER+ (`canWrite`); VIEWER read-only |
| **Backend gap** | G2 strip in modals |
| **Target files** | `status-lifecycle-card.tsx`, modals, `workflow-modals.tsx`, `formula-preview-mutations.ts` |
| **Acceptance** | Full cycle with logs; closeable updates; hidden when closed/canceled |

### D-02 Cash In

| Item | Specification |
|------|---------------|
| **Buttons** | Complete (Preview), Revoke Completion (Preview), Set Partial / Return to Pending |
| **Dialogs** | Same three modals |
| **Lifecycle** | pending ↔ partial → completed → revoke → re-complete |
| **Reason / Memo** | Required / optional |
| **Critical copy** | `Registering payment records does not complete Cash In.` |
| **History / Timeline / Log** | Same event model; `statusType: "cashIn"` |
| **Version** | Unchanged |
| **RBAC** | MANAGER+ |
| **Backend gap** | G3 |
| **Acceptance** | Payment record registration never sets `cashInStatus: completed` |

### D-03 Cash Out

| Item | Specification |
|------|---------------|
| **Buttons** | Mirror D-02 |
| **Dialogs** | Mirror D-02 |
| **Lifecycle** | Mirror D-02; `cashOut` / G4 |
| **Critical copy** | `Payment records do not complete Cash Out.` |
| **Target files** | Same as D-02 pattern |
| **Acceptance** | Mirror D-02 acceptance |

### D-04 Invoice

| Item | Specification |
|------|---------------|
| **Buttons** | **Review Invoices** (navigate); per-row status actions (existing) |
| **Dialogs** | `AddInvoiceModal`, `InvoiceStatusModal` — extend with Reason on enum change |
| **Lifecycle** | Derived match via rows; revoke match per row; re-match |
| **Reason** | Required on row status change that revokes match |
| **Memo** | Optional |
| **Forbidden** | Formula-level complete toggle; manual `amount_verified` |
| **History** | Rollup event when `deriveInvoiceClose` flips |
| **Timeline** | Reason on rollup flip |
| **Version** | Unchanged |
| **RBAC** | MANAGER+ on Invoices tab |
| **Backend gap** | None (per-invoice status route exists; mock) |
| **Target files** | `detail-panels.tsx` (`InvoiceCompletionChecklist`), invoice modals |
| **Acceptance** | Checklist guides to Invoices tab; no PATCH `invoice_status` in preview |

### D-05 Logistics

| Item | Specification |
|------|---------------|
| **Buttons** | Mark Delivered, Revoke Completion, Modify via select |
| **Dialogs** | All three modals |
| **Lifecycle** | not_started ↔ in_transit → delivered → revoke → re-complete |
| **Reason / Memo** | Required / optional |
| **History / Timeline / Log** | `statusType: "logistics"` |
| **Version** | Unchanged |
| **RBAC** | MANAGER+ |
| **Backend gap** | Route exists; still mock until wired |
| **Target files** | `workflow-modals.tsx`, `batch-2-workflows.tsx` |
| **Acceptance** | No silent one-click complete; select → transition modal |

### D-06 Delivery

| Item | Specification |
|------|---------------|
| **Buttons** | Complete (Preview), Revoke Completion (Preview), Modify |
| **Dialogs** | All three modals |
| **Lifecycle** | pending ↔ in_transit → delivered → revoke → re-complete |
| **Copy** | `Delivery is final hand-off, not logistics transport.` (DL-013) |
| **Reason / Memo** | Required / optional on Revoke |
| **Backend gap** | G1 |
| **Target files** | Same as D-01 + Logistics tab footer link |
| **Acceptance** | Distinct from logistics card; full lifecycle |

### D-07 Formula Close

| Item | Specification |
|------|---------------|
| **Buttons** | Header **Close Formula** (COMPANY_ADMIN+, `closeable`) |
| **Dialogs** | Existing `CloseFormulaDialog` |
| **Lifecycle** | Close once; **no undo, no reopen, no version revert** |
| **Reason / Memo** | N/A on close dialog |
| **History** | One close event (preview: trade `newStatus: "closed"`) |
| **Version** | Unchanged |
| **RBAC** | `canCloseOrCancel` |
| **Copy** | `Close cannot be undone. Versions do not reopen a closed Formula.` |
| **Target files** | `workflow-modals.tsx`, `CloseReadinessPanel` |
| **Acceptance** | No close when !closeable; no reopen UI; Settlement unlocks |

### D-08 Formula Cancel

| Item | Specification |
|------|---------------|
| **Buttons** | Header **Cancel Formula** |
| **Dialogs** | `CancelFormulaDialog` — reason required |
| **Lifecycle** | Cancel once; **no undo** |
| **History** | 6 logs, shared `correlationId` |
| **Version** | Unchanged |
| **RBAC** | `canCloseOrCancel` |
| **Forbidden** | Cancel when closed; re-cancel |
| **Target files** | `workflow-modals.tsx` |
| **Acceptance** | Reason required; no undo UI |

### D-09 Payment Record Cancel

| Item | Specification |
|------|---------------|
| **Buttons** | Cancel Record (Preview); Register Record (Preview) for re-complete |
| **Dialogs** | `CancelRecordModal` — cancellation reason required |
| **Lifecycle** | Cancel → new record (not un-cancel) |
| **History** | Ledger/timeline only; no six-status log |
| **Version** | Unchanged |
| **RBAC** | `canCancelPayment` (COMPANY_ADMIN+) |
| **Critical** | Does not change Cash In/Out statuses |
| **Acceptance** | 409 on re-cancel; Settlement cancel when closed |

### D-10 Settlement Append / Cancel

| Item | Specification |
|------|---------------|
| **Buttons** | Add schedule (Closed), Register record (Closed), Settlement note |
| **Dialogs** | Existing settlement modals |
| **Lifecycle** | Append-only; cancel via D-09 |
| **Copy** | `SettlementLifecycleNote` — append-only; no close undo |
| **RBAC** | `canSettlementAppend`, `canCancelPayment` |
| **Version** | Unchanged |
| **Target files** | `detail-panels.tsx`, settlement components |
| **Acceptance** | Visible when closed + admin; no reopen implied |

---

# 6. UX Checklist

## P1 — Required before P2

### P1-1 Lifecycle Guide

| Item | Requirement |
|------|-------------|
| Location | Overview tab; between `SixStatusControls` and `MetadataWorkflowActions` |
| Steps | 9 + Close; icons; per-step status chips from `sixStatuses()` |
| Desktop | Horizontal stepper |
| Mobile | Vertical accordion list |
| Close step | Opens `CloseFormulaDialog`; blocked when !closeable |
| Canceled | Component not rendered |
| Closed | Read-only; all steps done styling |
| Acceptance | All P1-1 criteria in UX spec §Acceptance |

### P1-2 Participant KPI Explainer

| Item | Requirement |
|------|-------------|
| Location | Inside `ParticipantConfirmedKpiPanel` |
| Content | 5 collapsible blocks; Settlement link |
| Constraint | **No** changes to `deriveParticipantConfirmedKpi()` |
| Acceptance | Default collapsed; muted Scheduled headers |

### P1-3 Versions UX

| Item | Requirement |
|------|-------------|
| Structure | `VersionsTabLayout` — 3 collapsible sections |
| Section 1 | Version History — default open |
| Section 2 | Snapshot Viewer helper — default closed |
| Section 3 | Version-Triggering Edits — default closed; hidden if !canCommitVersion |
| Dedup | Single `MockPreviewNote` in Section 3 header |
| Acceptance | Snapshot SidePanel unchanged; no commit logic change |

### P1-4 Close Guidance

| Item | Requirement |
|------|-------------|
| Location | Overview; below Lifecycle Guide |
| States | Ready / Not ready / Closed / Canceled cards |
| Blocking list | `sixStatuses` where !done; lifecycle action hints + G1–G4 |
| Header | Tooltip on disabled Close when !closeable |
| Footer | Receivable/payable do not block close |
| Acceptance | All P1-4 criteria in UX spec |

## P2 — After P1 complete

### P2-1 Mobile Navigation

| Item | Requirement |
|------|-------------|
| Component | `FormulaDetailMobileNav` — `lg:hidden` |
| Tabs | Jump dropdown; scroll hints on `TabsList` |
| Acceptance | Desktop unchanged |

### P2-2 MockPreview Dedup

| Item | Requirement |
|------|-------------|
| Rule A | One note per surface |
| Rule B | Remove nested duplicates |
| Rule C | `compact` variant for toolbars |
| Acceptance | Versions tab has single note in Section 3 |

### P2-3 Search / Notifications

| Item | Requirement |
|------|-------------|
| Search | `aria-disabled`, tooltip, gray ⌘K |
| Notifications | Remove red dot or Preview badge |
| AI | Tooltip shell only |
| Acceptance | No navigation on click |

---

# 7. File Checklist

## 7.1 New files

| File | Step |
|------|------|
| `web/components/formulas/workflows/status-lifecycle-card.tsx` | 2 |
| `web/components/formulas/workflows/status-completion-modal.tsx` | 2 |
| `web/components/formulas/workflows/status-revocation-modal.tsx` | 2 |
| `web/components/formulas/workflows/status-transition-modal.tsx` | 2 |
| `web/components/formulas/versions-tab-layout.tsx` | 8 |
| `web/components/formulas/formula-detail-mobile-nav.tsx` | 9 |

## 7.2 Modified files

| File | Steps | Changes |
|------|-------|---------|
| `web/lib/types.ts` | 1 | `StatusLog.reason`, `correlationId` |
| `web/lib/formula-preview-mutations.ts` | 1, 3, 4 | Unified mutators, `StatusActionInput`, cancel correlationId |
| `web/lib/formula-math.ts` | 1 | `buildTimeline()` Reason in description |
| `web/components/formulas/workflows/workflow-modals.tsx` | 2–4 | `SixStatusControls`, close/cancel copy |
| `web/components/formulas/workflows/batch-2-workflows.tsx` | 3, 10 | Logistics transition modal; compact note |
| `web/components/formulas/detail-panels.tsx` | 3–7 | Lifecycle Guide, Close Readiness, KPI explainer, Invoice checklist, Settlement note, Status Log Reason column |
| `web/components/formulas/formula-detail-view.tsx` | 3–7, 9 | Wire panels, `onNavigate`, caps, Close tooltip, mobile nav |
| `web/components/formulas/version-trigger-fields-panel.tsx` | 8 | Nested disclosures |
| `web/components/formulas/versions-panel.tsx` | 8 | Minor — history export only |
| `web/components/formulas/formula-edit-simulation.tsx` | 8 | `hidePreviewNote` prop |
| `web/components/formulas/workflows/mock-preview-note.tsx` | 10 | `compact` variant |
| `web/components/ui/tabs.tsx` | 9 | Optional scroll hints |
| `web/components/shell/header.tsx` | 11 | Placeholder UX |

## 7.3 Reuse (extend in place, do not replace)

| File | Rule |
|------|------|
| `formula-detail-view.tsx` | Extend only — do not replace |
| `detail-panels.tsx` | Extend only |
| `versions-panel.tsx` | Extend only |
| `version-trigger-fields-panel.tsx` | Extend only |
| `workflow-modals.tsx` | Extend only |
| `mock-preview-note.tsx` | Extend only |
| `header.tsx` | Extend only |
| `permissions.ts` | Reuse `formulaWriteCaps` — no changes unless spec requires |

## 7.4 No-touch files (do not modify)

| Path | Reason |
|------|--------|
| `src/**` | Backend frozen |
| `db/**` | Schema source of truth |
| `prisma/**` | ORM mapping only |
| `docs/**` (except this brief) | Specs are authoritative inputs — do not edit during v0 |
| Repository / API client files | No API wiring |
| `formula-math.ts` calculation derivations | Copy-only KPI explainer exception: timeline description only |
| Existing DECISION_LOG, MASTER_SPEC | Read-only reference |

---

# 8. Validation Checklist

v0 must verify **all** before marking work complete:

## Build

- [ ] `pnpm exec tsc --noEmit` (or project typecheck command) passes
- [ ] `pnpm build` (web) passes

## Preview behavior

- [ ] Fresh formula: user can complete all six statuses in preview (no disabled API missing)
- [ ] Revoke Completion requires Reason; blocked without min 3 chars
- [ ] Re-complete after revoke creates **new** Status Log row + Timeline entry
- [ ] `formula.closeable` becomes true when all six done
- [ ] Close dialog works in preview; `isClosed` locks writes
- [ ] Cancel sets six CANCELED; all writes hidden
- [ ] Payment record register does **not** auto-complete Cash In/Out

## RBAC

- [ ] VIEWER: no write buttons visible (read surfaces remain)
- [ ] MANAGER: status complete/revoke visible on open formula
- [ ] COMPANY_ADMIN: Close/Cancel visible when allowed
- [ ] Closed: Settlement append visible; Payments tab writes hidden
- [ ] Canceled: all write hidden

## History / Timeline / Status Log

- [ ] One event per status transition (`eventId` = log id = timeline prefix)
- [ ] Status Log table shows Reason column
- [ ] Timeline description includes `Reason: …`
- [ ] Formula Cancel: 6 rows, shared correlationId
- [ ] No timeline-only fabricated status events

## Lifecycle (per domain)

- [ ] D-01–D-06: Pending → Modify (where allowed) → Complete → Revoke → Re-complete
- [ ] D-04: derived invoice; no manual amount_verified
- [ ] D-07: no reopen / undo close
- [ ] D-08: no cancel undo
- [ ] D-09: 409 message on re-cancel payment record
- [ ] D-10: Settlement note visible on closed formula

## UX P1/P2

- [ ] Lifecycle Guide on Overview with 9 steps + chips
- [ ] Close Readiness panel with G1–G4 hints
- [ ] Participant KPI explainer collapsible
- [ ] Versions tab 3-section layout
- [ ] Mobile nav dropdown `< lg`
- [ ] MockPreview compact in toolbars; full in modals
- [ ] Header search/notifications clearly non-functional

## Prohibited (must be false)

- [ ] No `fetch` / HTTP calls added
- [ ] No `src/actions` or repository imports from new UI
- [ ] No backend SQL or Prisma schema changes
- [ ] No `formula_versions` created by status actions
- [ ] No close undo / cancel undo UI

---

# 9. Final Acceptance Criteria

Work is **complete** when all of the following are true:

1. **Implementation order** (§3) executed Steps 1–12 in sequence.
2. **All components** in §4 exist and behave per spec.
3. **All 10 status domains** (§5) pass lifecycle acceptance criteria.
4. **All UX items** P1-1 through P2-3 (§6) pass acceptance criteria.
5. **All files** in §7.1–7.2 modified; §7.4 files untouched.
6. **Validation checklist** (§8) — every box checked.
7. **Global rules** (§2) — no violations: Formula First, mock only, G1–G4 preview lifecycle enabled, Status ≠ Version, History/Timeline/Status Log unified, closed/canceled policies enforced.
8. **Backend semantics unchanged** — UI reflects DL-012, DL-014, DL-015, DL-031, DL-033 without invention.
9. **No open questions** — v0 does not need product clarification to ship this scope.
10. **§10 Working Rules** — incremental delivery; step completion report for every Step; no invented behavior on contradictions.

## Definition of Done (one sentence)

A user on a fresh preview Formula can complete the full six-status lifecycle (including revoke and re-complete), see honest G1–G4 preview actions, read Lifecycle Guide and Close Readiness, understand Participant KPIs, use the restructured Versions tab, and operate on mobile — with TypeScript and production build green, zero API wiring, and zero backend file changes — **and** every step completed per §10 (incremental verify + step report).

---

# 10. v0 Working Rules (Mandatory)

These rules are **mandatory**. They take precedence over implementation convenience.

## 10.1 Implement incrementally

- Do **not** redesign the whole screen at once.
- Complete **one feature** (one Step in §3, or one clearly bounded sub-feature within a Step).
- **Verify** (§10.8).
- Then continue to the next item.

## 10.2 Reuse existing components

- Reuse existing components whenever possible.
- Avoid creating duplicate UI.
- Prefer **extension over replacement** (see §7.3 Reuse list).
- New files in §7.1 are allowed only where the brief explicitly requires them.

## 10.3 Never change backend semantics

- Backend semantics are fixed (§1, §2).
- If UI appears inconsistent with backend, **change the UI** — not the business rule.
- Do not add enums, gates, auto-complete shortcuts, or undo paths not in DECISION_LOG / engine.

## 10.4 Do not improve unrelated UI

- Only touch components and files listed in §4 and §7.
- Avoid cosmetic refactoring, drive-by formatting, or architecture cleanup.
- No new dependencies without explicit approval (not in this brief scope).

## 10.5 Preserve on every completed feature

Each finished feature must preserve:

| Preserve | Requirement |
|----------|-------------|
| Typecheck | `tsc --noEmit` passes |
| Build | `pnpm build` passes |
| Existing workflows | Wizard, detail tabs, version commit preview, payment preview — no regression |
| RBAC | `formulaWriteCaps` hide rules unchanged in intent |
| Mock Preview | `MockPreviewNote` honesty on mutating surfaces |

## 10.6 Stop on contradiction

- If implementation reveals a **contradiction** between specs, code, and backend rules: **STOP**.
- Do **not** invent behavior to resolve it.
- Document the contradiction (file, spec section, observed conflict) and wait for clarification.
- Do not proceed past the blocking step.

## 10.7 Surface backend limits honestly

- If a backend rule cannot be fully represented in live UI yet, surface it honestly (G1–G10 strips, preview labels, tooltips).
- **Never fake functionality** — no implied persistence, no disabled buttons where preview lifecycle is specified (G1–G4).

## 10.8 Verify before next step

Every completed implementation step must finish with:

1. **Typecheck**
2. **Build**
3. **Visual QA** — UI renders; RBAC hide/show correct; no layout break on Overview / Versions / mobile
4. **Workflow QA** — feature-specific path from §5 or §6 acceptance criteria exercised in preview

Only then move to the next Step in §3.

## 10.9 No architecture refactoring

- This phase is **UI implementation only**.
- No repository layer, no service layer, no API client, no folder restructure, no global state redesign.

## 10.10 Step completion report (required)

After **each** Step (or sub-feature if Step is large), return this report before considering the step complete:

| Field | Content |
|-------|---------|
| **Changed files** | List every file touched |
| **Implemented features** | What was completed (map to §3 Step / §4 component / §5 domain / §6 UX item) |
| **Skipped items** | Anything deferred within scope — must be empty unless §10.6 stop |
| **Known limitations** | Preview-only, G# gaps, mock-only behavior |
| **Typecheck** | Pass / fail (+ errors if fail) |
| **Build** | Pass / fail (+ errors if fail) |
| **Manual QA** | What was clicked/tested; pass / fail notes |

A Step is **not complete** without this report and §10.8 verification green.

---

# Appendix — Source cross-reference

| Topic | Primary doc | Section |
|-------|-------------|---------|
| Lifecycle Guide | UX spec | P1-1 |
| Close Readiness | UX spec | P1-4 |
| Status lifecycle global rules | Status spec | §0 |
| Status modals | Status spec | §1 |
| Domain D-01–D-10 | Status spec | D-01–D-10 |
| G1–G10 | Gap Matrix + Master Plan §10 | §2.10 above |
| DL-014 manual status | DECISION_LOG | DL-014 |
| DL-015 close gate | DECISION_LOG | DL-015 |
| DL-031 cancel | DECISION_LOG | DL-031 |
| DL-032 version triggers | DECISION_LOG | DL-032 |
| DL-033 closed settlement | DECISION_LOG | DL-033 |
| Formula First | MASTER_SPEC | §1 |

---

**Handoff:** This brief is the single entry point for v0. Read **§10 Working Rules** and **§3 order** first, then implement incrementally. Refer to source specs for field-level detail. Do not expand scope beyond P1 + P2 + Status Workflow D-01–D-10. Return §10.10 report after each Step.
