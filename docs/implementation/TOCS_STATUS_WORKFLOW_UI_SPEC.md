# TOCS Status Workflow UI Specification

| Field | Value |
|-------|--------|
| **Version** | v2.1.0 — Final Revision |
| **Status** | Final — v0 one-pass implementation |
| **Mode** | Mock preview only |
| **Baseline** | `tocs-frontend-design` @ `3733c26` |
| **Companion** | `TOCS_UX_IMPROVEMENT_SPEC.md` v1.1.0 (Lifecycle Guide + Close Guidance) |
| **Audience** | v0 UI implementation agent |

---

## 0. Global rules (final — non-negotiable)

| Rule | Requirement |
|------|-------------|
| Backend semantics | **Do not change.** UI spec follows existing columns, routes, CHECK constraints, and engine rules. |
| Invented behavior | **Forbidden.** No new status enums, no auto-complete shortcuts, no undo paths not in backend. |
| Lifecycle simplification | **Forbidden.** Every supported domain must expose the full lifecycle where backend allows it. |
| TOCS engine | Payment records ≠ Cash In/Out completion; invoice amount = derived; close = six-status gate; cancel = six CANCELED. |

### 0.1 Revoke Completion field contract

Every domain that supports **Completed → Revoke Completion** (Completed Cancel) **must** collect:

| Field | Required | Maps to (backend) | Maps to (preview `StatusLog`) |
|-------|----------|-------------------|-------------------------------|
| **Reason** | **Yes** — min 3 chars | `formula_status_logs.change_reason` | `reason` (new preview field) **and** primary line in `memo` for backward compat |
| **Memo** | No — optional supplementary note | *No separate DB column* — preview-only until backend adds field | `memo` suffix when present |

**Propagation rule (mandatory):**

1. **History** — `formula.statusLogs[]` retains `reason` on the log row; prior rows immutable.
2. **Status Log table** — displays **Reason** column (primary); **Memo** column when `memo` present.
3. **Timeline** — `buildTimeline()` description **must** include reason: `{prev} → {next} · Reason: {reason}`; append ` · Memo: {memo}` when memo set.

Domains requiring Revoke Completion + Reason:

| Domain | Revoke supported | Reason required on revoke |
|--------|------------------|---------------------------|
| Trade | ✓ | ✓ |
| Cash In | ✓ | ✓ |
| Cash Out | ✓ | ✓ |
| Invoice | Per-row match revoke | ✓ on row status change that revokes match |
| Logistics | ✓ | ✓ |
| Delivery | ✓ | ✓ |
| Formula Close | **No revoke (MVP)** | N/A |
| Formula Cancel | **No undo (MVP)** | N/A (cancel uses its own reason on initial cancel only) |
| Payment Record | **No un-cancel** | N/A (cancel uses cancellation reason, not “revoke completion”) |
| Settlement | **No revoke** | N/A |

**Complete** and **Modify (transition)** actions use the same Reason + optional Memo contract.

### 0.2 Unified status event identity

**Rule:** Every status transition produces **exactly ONE canonical event**. That single event is the source referenced by all three surfaces:

```
StatusLog row (canonical SOURCE)
        ↓ same eventId
Timeline entry (PROJECTED via buildTimeline)
        ↓ same eventId
History / Status Log table (DISPLAY of canonical row)
```

**Do not** create a timeline-only event without a matching `statusLogs` row for six-status domains. **Do not** duplicate one user action into multiple unrelated log rows (except Formula Cancel — see below).

**Event shape (preview `StatusLog` extension):**

```ts
type StatusTransitionEvent = {
  /** Event ID — primary key. Equals StatusLog.id. Timeline uses `tl-status-${eventId}`. */
  eventId: string
  /**
   * Correlation ID — groups related logs from one user action.
   * Default: same as eventId for single-domain transitions.
   * Formula Cancel: one shared correlationId across 6 status log rows.
   */
  correlationId: string
  timestamp: string          // changedAt / created_at
  actor: string              // changedBy / changed_by
  reason: string             // required — maps to change_reason
  memo?: string              // optional — preview supplement
  statusBefore: string | null // previousStatus / prev_status
  statusAfter: string        // newStatus / new_status
  statusType: StatusLogType  // domain
  formulaId: string
}
```

**Mutator contract:** `transitionDomainStatusPreview`, `completeDomainStatusPreview`, and `revokeDomainStatusPreview` each append **one** `StatusTransitionEvent` per value change. Idempotent no-op (same before/after) → **no event**.

**Formula Cancel exception (backend semantics):** One cancel action appends **six** status log rows (one per six-status domain), all sharing one `correlationId`, each with its own `eventId`. Timeline shows six projected entries; History table shows six rows — not one merged row.

**Payment record cancel:** Ledger event only (not a six-status log). Timeline may show payment event; no `statusType` formula log.

### 0.3 Version rule (explicit)

| Action | Creates `formula_versions`? | Creates status history? |
|--------|----------------------------|---------------------------|
| Complete status | **No** | Yes — one StatusLog event |
| Revoke completion | **No** | Yes — one StatusLog event |
| Modify (transition) | **No** | Yes — one StatusLog event |
| Formula Close | **No** | Yes — close log (preview: trade `newStatus: "closed"`) |
| Formula Cancel | **No** | Yes — 6× StatusLog + audit (backend) |
| Payment record cancel | **No** | Ledger/timeline only |
| Settlement append | **No** | Settlement note / payment timeline only |

**Version number remains unchanged** on all status transitions. Version triggers (quantity, prices, shares, logistics cost, etc.) are unrelated to status workflow UI.

### 0.4 Close and cancel rule (explicit)

**Formula Close:**

| Statement | True |
|-----------|------|
| Close can be undone in MVP | **No** |
| Close can be reverted by creating a new Version | **No** — versions do not touch `is_closed` |
| Close can be reopened via UI | **No** |
| Post-close trade data mutation | **Forbidden** (DL-033 CHECK) |
| Post-close correction path | Settlement append-only (D-10) |

**Formula Cancel:**

| Statement | True |
|-----------|------|
| Cancel undo in MVP | **No** (DL-033 V2) |
| Re-cancel same formula | **Error** — backend rejects |
| Cancel when `is_closed` | **Forbidden** (DL-031 CHECK) |
| Effect on six statuses | All set to `CANCELED`; history preserved |
| Hidden undo affordance | **Forbidden** — no Reopen, no Restore, no idempotent re-cancel |

**Distinction:** Revoking a **single domain completion** is NOT Formula cancel and NOT close undo. Only domain-level terminal states revert per §1.5 revoke targets.

---

## 0. Universal status lifecycle model

Every **six-status domain** (Trade, Cash In, Cash Out, Invoice, Logistics, Delivery) follows this preview lifecycle:

```
Pending / Current State
        ↓  [Modify] (intermediate transitions only — where allowed)
        ↓  [Complete] (manual — reason required, memo optional)
   Completed / Matched (terminal for close gate)
        ↓  [Revoke Completion] (explicit — reason required, memo optional — NOT undo-close)
        ↓  returns to defined revoke target state
        ↓  [Complete Again] (same modal as first complete — new StatusLog event + timeline projection)
One event per transition → History (statusLogs) · Timeline (projected) · Status Log table
Formula consistency via recomputeFormulaPreview (never auto-complete Cash In/Out from payments)
Version unchanged on every status transition (§0.3)
```

**Formula-level lifecycle** (Close, Cancel) and **ledger lifecycle** (Payment Record, Settlement append) follow domain-specific rules in §D-07–D-10.

### Critical rules (non-negotiable)

| Rule | Source |
|------|--------|
| Payment records do **not** auto-complete Cash In / Cash Out | DL-014, engine, `recomputeFormulaPreview` |
| Invoice `amount_verified` is system-derived — **no manual toggle** | DL-012 |
| Receivable / payable do **not** block Close | DL-015, Close dialog copy |
| Close requires six-status readiness + manual COMPANY_ADMIN approval | DL-015 |
| Cancel sets six statuses to CANCELED; blocks normal writes | `cancelFormulaPreview` |
| Close undo / Cancel undo / Reopen — **not MVP** | DL-033 V2 |
| Closed formula: six statuses frozen; trade mutations forbidden | DL-033 CHECK |
| Status changes do **not** create `formula_versions` | TOCS version policy (§0.3) |
| Every status transition = **one** canonical event (§0.2) | StatusLog source → Timeline projection |
| Revoke Completion requires **Reason**; **Memo** optional (§0.1) | `change_reason` + preview display |
| Every status transition appends `formula.statusLogs` when value changes | Backend `formula_status_logs` pattern |

### Backend gap honesty (G1–G4)

Preview UI **must** implement the full lifecycle locally. Modals for G1–G4 domains include:

> `Backend route not shipped (G#). This action updates preview state only.`

Do **not** disable lifecycle actions with a dead “API missing” button.

---

## 1. Shared UI components

### 1.1 `StatusLifecycleCard` (replaces per-domain ad-hoc buttons)

**File:** `web/components/formulas/workflows/status-lifecycle-card.tsx` (new)

**Used inside:** `SixStatusControls` (Overview) and domain toolbars where noted.

**Props:**

```ts
{
  domain: StatusLogType | "invoice"
  label: string
  currentValue: string
  isDone: boolean
  isDerived?: boolean          // invoice only
  backendGapId?: "G1"|"G2"|"G3"|"G4"
  canWrite: boolean
  onNavigate?: (tab: string) => void
  onComplete: () => void
  onRevoke?: () => void
  onModify?: () => void
  modifyLabel?: string
}
```

**Button visibility matrix (open formula, `canWrite`, not canceled):**

| Card state | Primary | Secondary |
|------------|---------|-----------|
| Not done, not derived | **Complete (Preview)** or **Complete** | **Modify…** (if domain allows intermediate) |
| Done | `StatusBadge` **Complete** | **Revoke Completion (Preview)** |
| Derived (invoice) | **Review Invoices** → navigate | — |

Hide all action buttons when `!canWrite`, `isClosed` (six domains), or `canceledAt`.

### 1.2 `StatusCompletionModal`

**File:** `web/components/formulas/workflows/status-completion-modal.tsx`

| Field | Rule |
|-------|------|
| Title | `Complete {Domain} Status` |
| MockPreviewNote | Full |
| Backend gap strip | When `backendGapId` set |
| Read-only | Current → Target (terminal complete state) |
| **Reason** | Required, min 3 chars — maps to `change_reason` |
| **Memo** | Optional — supplementary note; preview-only display suffix |
| Confirm copy | `I confirm this status is manually completed per business review.` |
| Primary button | **Mark Complete (Preview)** or **Mark Complete** (logistics only — route exists; still mock) |
| On submit | Creates one `StatusTransitionEvent` (§0.2) via `completeDomainStatusPreview` |

### 1.3 `StatusRevocationModal` (Completed Cancel / Revoke Completion)

**File:** `web/components/formulas/workflows/status-revocation-modal.tsx`

Applies to every domain with Revoke Completion in §2 (Trade, Cash In, Cash Out, Logistics, Delivery; Invoice per-row).

| Field | Rule |
|-------|------|
| Title | `Revoke {Domain} Completion` |
| Warning | `This reverses a completed status. History is preserved in Status Logs. This is not Formula cancel or close undo.` |
| MockPreviewNote | Full |
| Backend gap strip | When `backendGapId` set |
| Read-only | Completed value → Revoke target (per domain table §2) |
| **Reason** | **Required**, min 3 chars — stored in StatusLog + displayed in Timeline |
| **Memo** | Optional — appended to Timeline/Status Log table when present |
| Confirm copy | `I confirm revoking this completion. The status will return to {target}.` |
| Primary button | **Revoke Completion (Preview)** |
| On submit | Creates one `StatusTransitionEvent` (§0.2) via `revokeDomainStatusPreview` |

**Reason propagation (mandatory):** History row, Status Log table **Reason** column, and Timeline description all show the reason string. Memo shown as secondary when provided.

### 1.4 `StatusTransitionModal` (Modify — intermediate only)

**File:** `web/components/formulas/workflows/status-transition-modal.tsx`

For non-terminal transitions (e.g. logistics `not_started` → `in_transit`, trade `draft` → `confirmed`).

**Design goal:** Extensible form shell — v0 implements Reason + Memo only; future fields are structural slots, not features.

**Props (extension surface):**

```ts
type StatusTransitionModalProps = {
  domain: StatusLogType
  fromStatus: string
  toStatus: string
  backendGapId?: "G1" | "G2" | "G3" | "G4"
  /** v0 — implemented */
  fields: StatusTransitionFormFields
  onSubmit: (payload: StatusTransitionSubmitPayload) => void
}

/** v0 field set */
type StatusTransitionFormFields = {
  reason: { visible: true; required: true; minLength: 3; label: "Reason" }
  memo: { visible: true; required: false; label: "Memo (optional)" }
  /** V2+ — extension slots (design only; do NOT implement in v0) */
  attachment: { visible: false; slot: "file-upload"; label: "Attachment" }
  reference: { visible: false; slot: "text-reference"; label: "Reference" }
}

type StatusTransitionSubmitPayload = {
  reason: string
  memo?: string
  // attachment?: FileRef   // future
  // reference?: string     // future
}
```

**Extension points (document for v0 implementer):**

| Slot | v0 behavior | Future behavior |
|------|-------------|-----------------|
| `reason` | Render `<Textarea required>` | Unchanged — maps to `change_reason` |
| `memo` | Render `<Textarea optional>` | Unchanged — preview supplement |
| `attachment` | **Do not render** — reserve footer zone below memo | File upload linked to event |
| `reference` | **Do not render** — reserve row below reason | External doc/ticket ID |

Modal layout order: Title → MockPreviewNote → gap strip → From→To read-only → **Reason** → **Memo** → `[attachment slot hidden]` → `[reference slot hidden]` → Confirm checkbox → Primary.

| Field | Rule |
|-------|------|
| **Reason** | Required, min 3 chars |
| **Memo** | Optional |
| Primary button | **Apply Transition (Preview)** |
| On submit | One `StatusTransitionEvent` via `transitionDomainStatusPreview` |

### 1.5 Preview mutator catalog (`formula-preview-mutations.ts`)

**Input shape (all domain mutators):**

```ts
type StatusActionInput = {
  reason: string   // required
  memo?: string    // optional
}
```

| Function | Purpose |
|----------|---------|
| `transitionDomainStatusPreview(f, domain, newStatus, input)` | Non-terminal change + one event |
| `completeDomainStatusPreview(f, domain, input)` | Terminal complete + one event |
| `revokeDomainStatusPreview(f, domain, input)` | Revert terminal → revoke target + one event |

Each mutator:

1. Compares before/after; no-op if equal (no event).
2. Updates formula status column.
3. Appends one `StatusLog` with `eventId`, `correlationId`, `reason`, optional `memo`, `previousStatus`, `newStatus`.
4. Calls `recomputeFormulaPreview(f)` for formula consistency (Cash In/Out never from payments).

**Timeline:** Consumers call `buildTimeline(f)` — no separate timeline write. Description format:

`{prevLabel} → {nextLabel} · Reason: {reason}` plus ` · Memo: {memo}` when memo set.

**Terminal complete values (UI):**

| Domain | Complete value | `sixStatuses().done` when |
|--------|----------------|---------------------------|
| trade | `completed` | `tradeStatus === "completed"` |
| cashIn | `completed` | `cashInStatus === "completed"` |
| cashOut | `completed` | `cashOutStatus === "completed"` |
| logistics | `delivered` | `logisticsStatus === "delivered"` |
| delivery | `delivered` | `deliveryStatus === "delivered"` |
| invoice | derived | `deriveInvoiceClose(f).done` |

**Revoke targets (fixed — do not parameterize):**

| Domain | Revoke target |
|--------|---------------|
| trade | `confirmed` |
| cashIn | `pending` |
| cashOut | `pending` |
| logistics | `in_transit` |
| delivery | `in_transit` |
| invoice | *No direct revoke* — see §D-04 |

Extend existing `updateTradeStatusPreview`, `updateLogisticsStatusPreview` to accept `StatusActionInput`. Implement cash in/out/delivery via unified helpers above.

**Idempotency:** Re-cancel payment record returns 409 message in UI (existing). Re-revoke to same state: no-op, no duplicate event.

---

## 2. Per-domain lifecycle coverage summary

| Domain | Complete | Revoke Completion (Reason req.) | Re-complete | Modify | Forbidden after Close | Forbidden after Cancel |
|--------|----------|--------------------------------|-------------|--------|----------------------|------------------------|
| Trade | ✓ | ✓ | ✓ | ✓ draft→confirmed | All write | All write |
| Cash In | ✓ | ✓ | ✓ | ✓ pending↔partial | All write | All write |
| Cash Out | ✓ | ✓ | ✓ | ✓ pending↔partial | All write | All write |
| Invoice | derived | via row actions | via re-match | row/status enum | Formula status frozen; row sync only | All write |
| Logistics | ✓ | ✓ | ✓ | ✓ not_started↔in_transit | All write | All write |
| Delivery | ✓ | ✓ | ✓ | ✓ pending↔in_transit | All write | All write |
| Formula Close | ✓ | **MVP: No** | **MVP: No** | **No** | N/A | N/A |
| Formula Cancel | ✓ | **MVP: No** | **MVP: No** | **No** | **Yes** | N/A |
| Payment Record Cancel | ✓ (cancel) | **No** (409) | ✓ new record | **No** edit amount | Cancel on Settlement only | **No** |
| Settlement Append | ✓ | **No** | ✓ | append-only | N/A (allowed) | **No** |

---

# D-01 — Trade Status

## 1. Current backend semantics

- Column: `formulas.trade_status` (`TradeStatus`: DRAFT, CONFIRMED, COMPLETED, CANCELED, …)
- Close gate: `COMPLETED` (DL-015)
- Manual completion only (DL-014)
- **No HTTP mutation route** — G2 (`BACKEND_ROUTE_GAPS.trade`)
- Cancel formula sets `CANCELED`
- Status log target: `TRADE_STATUS` on backend; preview `statusType: "trade"`
- No version on status change

## 2. Current UI state

- `SixStatusControls`: disabled **API missing** button
- `updateTradeStatusPreview` exists but no revoke/modify UI

## 3. Required UI state

- `StatusLifecycleCard` with Complete / Revoke / Modify (draft→confirmed) per lifecycle model
- All actions through modals with reason

## 4. Complete action

- Button: **Complete (Preview)**
- Modal: `StatusCompletionModal` — target **Completed**
- Mutator: `completeDomainStatusPreview(f, "trade", { reason, memo? })`

## 5. Complete cancel action (Revoke Completion)

- Button: **Revoke Completion (Preview)** when done
- Modal: `StatusRevocationModal` — `completed` → `confirmed`
- **Reason required; Memo optional** (§0.1)
- Mutator: `revokeDomainStatusPreview(f, "trade", { reason, memo? })`

## 6. Re-complete action

- Same as §4 after revoke; **new** `StatusTransitionEvent` required (§0.2)

## 7. Modify action

- **Advance to Confirmed** when `tradeStatus === "draft"` only
- Modal: `StatusTransitionModal` — draft → confirmed; Reason required, Memo optional
- No modify when `completed` or `canceled` (use revoke first)

## 8. Forbidden after close

Hide card actions; show read-only value. DL-033: trade status frozen.

## 9. Forbidden after cancel

Hide all actions; show CANCELED value.

## 10. Required modal/dialog

`StatusCompletionModal`, `StatusRevocationModal`, `StatusTransitionModal` (conditional)

## 11–12. Required fields

| Action | Reason | Memo |
|--------|--------|------|
| Complete | Required | Optional |
| Revoke Completion | **Required** | Optional |
| Modify (transition) | Required | Optional |

## 13. Required confirmation copy

- Complete: `I confirm trade status is manually completed.`
- Revoke: `I confirm revoking trade completion. Status returns to Confirmed.`

## 14. Status Log behavior

One event per transition (§0.2):

```ts
{
  eventId: uuid,
  correlationId: eventId,
  statusType: "trade",
  previousStatus, newStatus,
  reason,           // required — also written to change_reason mapping
  memo?,            // optional
  changedAt, changedBy: "Preview User"
}
```

## 15. Timeline behavior

Projected from StatusLog: `tl-status-${eventId}`; description includes **Reason** (§0.1)

## 16. History behavior

All prior events immutable; revoke does not delete rows

## 17. Version impact

**None** — `formula_versions` unchanged (§0.3)

## 18. Settlement impact

None direct

## 19. Formula header impact

`closeable` recalculates via `sixStatuses`; status badge unchanged (lifecycle badge separate)

## 20. RBAC behavior

MANAGER+ (`caps.canWrite`); VIEWER read-only card

## 21. Mock preview behavior

All mutations via `applyPreview`; G2 strip in modals

## 22. Backend gap handling

G2 honest strip; label **(Preview)** on buttons

## 23. Acceptance criteria

- [ ] Full lifecycle: draft→confirmed→completed→revoke→re-complete
- [ ] Each transition = one event; Reason in Status Log table + Timeline
- [ ] Revoke blocked without Reason (min 3 chars)
- [ ] Close gate updates when completed/revoked
- [ ] Version unchanged after status transitions
- [ ] Hidden when closed/canceled

## 24. Definition of Done

Trade card + three modals + mutators wired; build passes

## 25. Instruction to v0

Implement D-01 exactly. Do not add HTTP. Do not auto-complete from other domains.

---

# D-02 — Cash In Status

## 1. Current backend semantics

- Column: `formulas.cash_in_status` (`PaymentStatus`)
- Close gate: `COMPLETED`
- **Payment records do not update this column** (engine rule)
- **No HTTP route** — G3
- Status log: `CASH_IN_STATUS` / preview `cashIn`

## 2. Current UI state

Disabled API missing; no lifecycle actions

## 3. Required UI state

`StatusLifecycleCard` with Complete / Revoke / Modify (pending↔partial)

## 4. Complete action

- **Complete (Preview)** → `cashInStatus: "completed"`
- Modal body MUST include: `Registering payment records does not complete Cash In. Confirm receipts separately.`

## 5. Revoke Completion

- `completed` → `pending`
- Modal warns: `Receivable KPI may change; cash status is independent of payment records.`

## 6. Re-complete

Same as §4; new log row

## 7. Modify action

- **Set Partial** when `pending` (optional): `pending` → `partial`
- **Return to Pending** when `partial`: `partial` → `pending`
- Use `StatusTransitionModal`

## 8–9. Forbidden after close / cancel

Same as D-01

## 10. Modals

Completion, Revocation, Transition

## 11–12. Fields

| Action | Reason | Memo |
|--------|--------|------|
| Complete | Required | Optional |
| Revoke Completion | **Required** | Optional |
| Modify (pending↔partial) | Required | Optional |

## 13. Confirmation copy

- Complete: `I confirm cash-in status is manually completed.`
- Revoke: `I confirm revoking cash-in completion.`

## 14–16. Logs / Timeline / History

Same event pattern as D-01 (`statusType: "cashIn"`); Reason in Timeline (§0.1)

## 17. Version impact

**None** (§0.3)

## 18. Settlement impact

None; KPI panels refresh from `recomputeFormulaPreview` only

## 19. Header impact

`closeable` updates; metric pills (receivable) may change from payments but not from cash-in status alone

## 20. RBAC

MANAGER+

## 21. Mock preview

G3 strip on all modals

## 22. Backend gap

G3

## 23. Acceptance criteria

- [ ] Payment record registration never sets `cashInStatus` to completed
- [ ] Revoke and re-complete work with logs
- [ ] Partial transition optional but implemented

## 24. Definition of Done

Cash In lifecycle complete in preview

## 25. Instruction to v0

Never derive cash-in completion from `formula.records`. G3 on every modal.

---

# D-03 — Cash Out Status

Mirror **D-02** with these substitutions:

| Item | Cash Out value |
|------|----------------|
| Column | `cash_out_status` |
| Domain key | `cashOut` |
| Backend gap | **G4** |
| Modal body | `Payment records do not complete Cash Out. Confirm disbursements separately.` |
| Complete target | `completed` |
| Revoke target | `pending` |
| statusType | `cashOut` |

**Field contract:** Reason required + Memo optional on Complete, Revoke Completion, and Modify (§0.1). One event per transition (§0.2). Version unchanged (§0.3).

All other lifecycle rules identical to D-02.

## 25. Instruction to v0

Mirror D-02 implementation for `cashOut`. G4 on every modal.

---

# D-04 — Invoice Status (Formula-level, derived)

## 1. Current backend semantics

- `formulas.invoice_status` synced from `v_formula_invoice_status` (API layer)
- Close gate: `AMOUNT_MATCHED` at formula level (DL-015)
- Per-invoice: `PATCH /invoices/:id/status` (enum only)
- `amount_verified` DB-derived — **never user input** (DL-012)
- No direct “complete formula invoice status” toggle

## 2. Current UI state

Overview card: **Derived** label; Invoices tab: add + status enum modal

## 3. Required UI state

- `StatusLifecycleCard` `isDerived=true`: **Review Invoices** navigates to `invoices` tab
- `InvoiceCompletionChecklist` on Overview when `!deriveInvoiceClose(f).done`
- Per-invoice row actions (existing) constitute the lifecycle

## 4. Complete action (formula gate)

**Not a button.** Completion occurs when:

1. User adds invoice(s) on Invoices tab
2. External amount matches expected (or status enum `matched` sets projected external)
3. `deriveInvoiceClose(f).done === true` → `sixStatuses` invoice done

## 5. Complete cancel action (Revoke Completion)

**Not formula-level.** User revokes match per invoice:

- **Update Status (Preview)** → enum `mismatched` or `pending` OR add invoice with mismatched external
- **Reason required** on status enum change; Memo optional (existing modal extended)
- Each change: one invoice rollup flip event when `deriveInvoiceClose` changes (§0.2)
- **No** `amount_verified` toggle

## 6. Re-complete action

Re-match invoice (enum `matched` or external = expected) with Reason → formula gate can become done again; new event when rollup flips

## 7. Modify action

- Edit expected/external via Add Invoice flow or status enum (existing modals)
- **Forbidden:** manual `amount_verified` checkbox

## 8. Forbidden after close

- No add invoice on normal paths (existing caps)
- Invoice status sync on closed formula only when derived = AMOUNT_MATCHED (DL-033) — show read-only note

## 9. Forbidden after cancel

All invoice writes hidden

## 10. Modals

Existing `AddInvoiceModal`, `InvoiceStatusModal` — no new formula-level modal

## 11–12. Fields

Existing invoice modals unchanged; status enum required

## 13. Confirmation copy

Checklist header: `Invoice status is derived when every active invoice is amount-matched. You cannot toggle verification manually.`

## 14. Status Log behavior

When `deriveInvoiceClose` done state changes, append one rollup event:

`{ statusType: "invoice", previousStatus, newStatus, reason: userReason, memo?, eventId, correlationId }`

Per-invoice enum changes without rollup flip: no formula-level status log (row activity only).

## 15–16. Timeline / History

Rollup flip → Timeline projects from StatusLog with Reason. Invoice row changes visible in Invoices tab history.

## 17. Version impact

**None** (§0.3)

## 18. Settlement impact

None

## 19. Header impact

`closeable` when all six done

## 20. RBAC

MANAGER+ on Invoices tab; all see checklist

## 21. Mock preview

Existing `updateInvoiceStatusPreview`

## 22. Backend gap

None for per-invoice status; formula rollup is sync semantics

## 23. Acceptance criteria

- [ ] No formula-level complete toggle
- [ ] Checklist guides user to Invoices tab
- [ ] Revoke match via per-invoice actions clears formula gate
- [ ] amount_verified never manual

## 24. Definition of Done

Invoice card + checklist + rollup log on derive flip

## 25. Instruction to v0

Do not add `formulas.invoice_status` PATCH in preview. Derive only.

---

# D-05 — Logistics Status

## 1. Current backend semantics

- `PATCH /api/v1/formulas/:formulaId/logistics-status` — **shipped**
- Body: `status`, `changed_by`, `change_reason`
- Writes `formula_status_logs` (`LOGISTICS_STATUS`)
- Close gate: `COMPLETED` (UI: `delivered`)
- No version

## 2. Current UI state

Logistics tab `<Select>` without reason; Overview one-click Mark done

## 3. Required UI state

Full lifecycle card + modals for terminal complete and revoke; transition modal for select changes

## 4. Complete action

- **Mark Delivered** opens `StatusCompletionModal` (no G strip; still mock)
- Target: `delivered`
- Reason required

## 5. Revoke Completion

- **Revoke Completion (Preview)** when delivered
- Target: `in_transit`
- Reason required

## 6. Re-complete

Mark Delivered again after revoke; new log

## 7. Modify action

- Logistics tab `<Select>`: `not_started` ↔ `in_transit` only (not to `delivered` without completion modal)
- Each select change opens `StatusTransitionModal` with reason

## 8–9. Forbidden after close / cancel

All write hidden

## 10. Modals

Completion, Revocation, Transition

## 11–12. Fields

| Action | Reason | Memo |
|--------|--------|------|
| Complete (Mark Delivered) | Required | Optional |
| Revoke Completion | **Required** | Optional |
| Modify (select transition) | Required | Optional |

## 13. Confirmation copy

- Complete: `I confirm logistics transport is complete (delivered).`
- Revoke: `I confirm revoking logistics completion. Returns to In Transit.`

## 14–16. Logs / Timeline / History

One event per transition; `statusType: "logistics"`; Reason in Timeline (§0.1)

## 17. Version impact

**None** (§0.3)

## 18. Settlement impact

None

## 19. Header impact

`closeable` updates

## 20. RBAC

MANAGER+

## 21. Mock preview

Modal copy notes future `PATCH …/logistics-status`

## 22. Backend gap

None (route exists); mock until wired

## 23. Acceptance criteria

- [ ] No silent one-click complete
- [ ] Select cannot set delivered without modal
- [ ] Revoke → re-complete cycle works

## 24. Definition of Done

Logistics lifecycle on Overview + Logistics tab

## 25. Instruction to v0

Remove silent `Mark done` onClick. Unify through modals.

---

# D-06 — Delivery Status

## 1. Current backend semantics

- Column: `formulas.delivery_status`
- Close gate: `COMPLETED` (UI: `delivered`)
- **No HTTP route** — G1
- Separate from logistics transport (DL-013)

## 2. Current UI state

Disabled API missing

## 3. Required UI state

Same lifecycle card pattern as D-01 with G1 strip

## 4. Complete action

**Complete (Preview)** → `deliveryStatus: "delivered"`

## 5. Revoke Completion (Completed Cancel)

- Button: **Revoke Completion (Preview)** when `deliveryStatus === "delivered"`
- Modal: `StatusRevocationModal` — `delivered` → `in_transit`
- **Reason required; Memo optional** (§0.1)
- Mutator: `revokeDomainStatusPreview(f, "delivery", { reason, memo? })`

## 6. Re-complete action

Same as §4; new `StatusTransitionEvent` (§0.2)

## 7. Modify action

`pending` ↔ `in_transit` via `StatusTransitionModal`; Reason required, Memo optional

## 8. Forbidden after close

Hide card actions; read-only value. DL-033: delivery status frozen.

## 9. Forbidden after cancel

Hide all actions; show CANCELED value.

## 10. Required modal/dialog

`StatusCompletionModal`, `StatusRevocationModal`, `StatusTransitionModal`

## 11–12. Required fields

| Action | Reason | Memo |
|--------|--------|------|
| Complete | Required | Optional |
| Revoke Completion | **Required** | Optional |
| Modify | Required | Optional |

## 13. Required confirmation copy

- Complete: `I confirm delivery (final hand-off) is complete.`
- Revoke: `I confirm revoking delivery completion. Returns to In Transit.`
- Note: `Delivery is final hand-off, not logistics transport.` (DL-013)

## 14. Status Log behavior

One event per transition; `statusType: "delivery"`; Reason preserved (§0.1–0.2)

## 15. Timeline behavior

Projected from StatusLog with Reason in description

## 16. History behavior

Immutable log chain; revoke does not delete

## 17. Version impact

**None** (§0.3)

## 18. Settlement impact

None direct

## 19. Formula header impact

`closeable` recalculates via `sixStatuses`

## 20. RBAC behavior

MANAGER+ (`caps.canWrite`)

## 21. Mock preview behavior

G1 strip on all modals; full lifecycle in preview

## 22. Backend gap handling

G1 honest strip; **(Preview)** on buttons

## 23. Acceptance criteria

- [ ] Distinct copy from logistics card
- [ ] Full lifecycle: pending→in_transit→delivered→revoke→re-complete
- [ ] Revoke requires Reason; Timeline shows Reason
- [ ] Version unchanged after transitions

## 24. Definition of Done

Delivery card + three modals + mutators; build passes

## 25. Instruction to v0

Implement parallel to D-01. Entry from Logistics tab footer **Delivery status →** navigates Overview card. G1 on every modal.

---

# D-07 — Formula Close

## 1. Current backend semantics

- `POST /api/v1/formulas/:formulaId/close` (COMPANY_ADMIN+)
- Requires `v_formula_closeable.can_close === true` (six statuses done)
- Sets `is_closed = TRUE`, `closed_at`
- **Close undo / Reopen: MVP excluded** (DL-033 V2)
- **Close cannot be reverted by Version** — `is_closed` is not a version-trigger field
- Receivable/payable not gate (DL-015)
- Status log: preview adds trade log with `newStatus: "closed"` (existing)
- Does **not** create `formula_versions`

## 2. Current UI state

Header Close button; `CloseFormulaDialog` with six-status grid

## 3. Required UI state

- Close button + dialog unchanged functionally
- `CloseReadinessPanel` (UX spec P1-4) lists blocking domains
- **No** Revoke Close, **No** Reopen, **No** Version-based reopen UI (§0.4)
- When closed, show immutable banner: close cannot be undone

## 4. Complete action

- Header **Close Formula** (COMPANY_ADMIN+, `formula.closeable`)
- `CloseFormulaDialog` → **Close Formula (Preview)**
- `closeFormulaPreview(f)` — one close event (preview trade log)

## 5. Complete cancel action

**Not available (MVP).** §0.4 applies. Show read-only in `CloseReadinessPanel` when closed:

> `Formula close cannot be reversed in MVP. Creating a new Version does not reopen this Formula.`

**Forbidden UI:** Reopen, Undo Close, Restore, any hidden undo affordance.

## 6. Re-complete action

**Not available (MVP).** Closed formula cannot be closed again; no reopen path.

## 7. Modify action

**Forbidden** — closed formula immutable for trade fields (DL-033)

## 8. Forbidden after close

Close action hidden (button shows Closed disabled); six-status cards read-only

## 9. Forbidden after cancel

Close hidden; `closeable` false

## 10. Modal

Existing `CloseFormulaDialog` only

## 11–12. Fields

No new fields; close uses existing dialog (no Reason field on close — backend close route has no change_reason on six-status)

## 13. Confirmation copy

Dialog subtitle unchanged; add lines:

- `Close requires all six statuses complete. Receivable and payable are review-only.`
- `Close cannot be undone. Versions do not reopen a closed Formula.`

## 14. Status Log behavior

One close event (preview): trade domain `newStatus: "closed"` — correlated with close action

## 15. Timeline

Close event projected in activity timeline

## 16. History

`isClosed` persists permanently in MVP; no reopen

## 17. Version impact

**None** — close does not increment `version_no` (§0.3–0.4)

## 18. Settlement impact

Enables Settlement append-only mode (DL-033)

## 19. Header impact

`StatusBadge` closed; Cancel/Close hidden; version editors hidden

## 20. RBAC

`caps.canCloseOrCancel` — COMPANY_ADMIN+

## 21. Mock preview

`MockPreviewNote` in dialog

## 22. Backend gap

None for close route (mock)

## 23. Acceptance criteria

- [ ] No close when `!closeable`
- [ ] No reopen / undo / version-reopen UI anywhere
- [ ] Copy states close irreversibility explicitly
- [ ] Settlement tab unlocks append actions after close

## 24. Definition of Done

Close path + §0.4 copy + no hidden undo

## 25. Instruction to v0

Do not implement close undo, reopen, or version-based reopen. Pair with `CloseReadinessPanel`.

---

# D-08 — Formula Cancel

## 1. Current backend semantics

- `POST /api/v1/formulas/:formulaId/cancel` (COMPANY_ADMIN+)
- Sets all six statuses to `CANCELED`; 6× `formula_status_logs` + `audit_logs`
- **Cancel undo: MVP excluded** (DL-033 V2)
- Blocked when `is_closed` (DL-031 CHECK)
- Re-cancel returns error — not idempotent
- Does **not** create `formula_versions`
- No hidden undo path in backend

## 2. Current UI state

`CancelFormulaDialog` with reason

## 3. Required UI state

Unchanged dialog + post-cancel read-only six-status display on Overview
**No** undo, restore, or re-cancel affordance (§0.4)

## 4. Complete action

Header **Cancel Formula** → **Reason required** → `cancelFormulaPreview(f, reason)`
Produces 6 events sharing one `correlationId` (§0.2 exception)

## 5–6. Cancel completion / Re-complete

**Not available (MVP).** Dialog footer note:

> `Formula cancellation cannot be undone in MVP. Payment and status history are preserved.`

## 7. Modify action

**Forbidden** after cancel

## 8. Forbidden after close

Cancel hidden (already)

## 9. Forbidden after cancel

All normal writes hidden; re-cancel must show backend error message (not silent)

## 10. Modal

`CancelFormulaDialog`

## 11–12. Cancellation reason required

Reason maps to cancel audit / log context; no separate Memo required (optional Memo allowed in dialog if already present)

## 13. Confirmation copy

`This sets all six statuses to CANCELED. Payment and status history are preserved. This cannot be undone.`

## 14. Status Log behavior

6 rows appended — each with own `eventId`, shared `correlationId`, `reason` on each row

## 15. Timeline

Six projected cancel events (or grouped display acceptable if each maps to a log row)

## 16. History

`canceledAt` set; statuses remain visible as CANCELED; immutable

## 17. Version impact

**None** (§0.3)

## 18. Settlement impact

Settlement writes forbidden after formula cancel

## 19. Header

Canceled badge; Close/Cancel hidden

## 20. RBAC

COMPANY_ADMIN+

## 21–22. Mock / gap

Mock only; route exists on backend

## 23. Acceptance criteria

- [ ] Reason required
- [ ] No undo / restore UI
- [ ] Cannot cancel when already canceled or when closed
- [ ] 6 status log rows with shared correlationId

## 24. Definition of Done

Cancel dialog + §0.4 copy + 6-event pattern

## 25. Instruction to v0

Do not add cancel undo or idempotent re-cancel.

---

# D-09 — Payment Record Cancel

## 1. Current backend semantics

- `POST /api/v1/payment-records/:id/cancel`
- Sets `is_canceled = TRUE`; separate from formula cancel
- **Re-cancel → 409** (`PaymentRecordAlreadyCanceledError`)
- **Un-cancel forbidden**
- Allowed on **closed** formula via settlement allowlist (DL-033)
- Does not change `cash_in_status` / `cash_out_status`

## 2. Current UI state

Payments tab cancel modal; Settlement tab cancel section when closed

## 3. Required UI state

- Open formula: cancel on Payments tab (existing)
- Closed formula: cancel on Settlement tab only (existing)
- After cancel: row shows **Canceled** badge; exclude from totals (existing)
- **Register new record** = re-complete cash movement (append new row)

## 4. Complete action

**Register Record (Preview)** — registers non-canceled record

## 5. Complete cancel action

**Cancel Record (Preview)** with cancellation reason (required)

## 6. Re-complete action

**Register Record (Preview)** again (new row) — not un-cancel

## 7. Modify action

**Forbidden** — no edit amount/date after create (DL-033)

## 8. Forbidden after close

Register/cancel on Payments tab; allowed on Settlement tab only

## 9. Forbidden after cancel (formula)

All payment writes hidden

## 10. Modal

`CancelRecordModal` (existing)

## 11–12. Cancellation reason required

## 13. Confirmation copy

`Canceled records remain visible but are excluded from confirmed KPI totals.`

## 14. Status Log behavior

No formula `statusType` log for payment record cancel (ledger event only); activity timeline may show payment event

## 15. Timeline

Payment record events in activity feed

## 16. History

`is_canceled` preserved; 409 on re-cancel with user-visible message (existing Settlement note)

## 17. Version impact

**None** (§0.3)

## 18. Settlement impact

Totals/rec KPI refresh via `recomputeFormulaPreview`

## 19. Header impact

Metric pills update

## 20. RBAC

Open: `canWritePayments`; Cancel: `canCancelPayment` (COMPANY_ADMIN+)

## 21. Mock preview

`cancelPaymentRecord(f, id, { reason, memo? })` — ledger event, not six-status log

## 22. Backend gap

None (mock)

## 23. Acceptance criteria

- [ ] Cancellation reason required
- [ ] 409 message on re-cancel
- [ ] New record after cancel allowed on Settlement when closed
- [ ] Cash In/Out statuses unchanged by record cancel
- [ ] No version created

## 24. Definition of Done

Cancel modal reason required; re-register = new record only

## 25. Instruction to v0

Do not un-cancel records. Re-complete = new record only. No six-status StatusLog for payment cancel.

---

# D-10 — Settlement Append / Cancel

## 1. Current backend semantics

- Settlement routes: append schedule, append record, notes (DL-033)
- Only when `is_closed === TRUE` for append paths in UI caps (`canSettlementAppend`)
- Payment record cancel allowed on closed (D-09)
- No undo of close; append is additive

## 2. Current UI state

`SettlementWorkflowActions` when closed; `ClosedSettlementBanner`

## 3. Required UI state

- Banner: original trade locked (existing)
- Three append actions + settlement notes list (existing)
- `SettlementRecordCancelSection` (existing)
- **Lifecycle copy** panel at top of Settlement tab (new `SettlementLifecycleNote`):

> `Closed Formula settlement mode: append-only corrections. You may add schedules, register new records, cancel existing records, and append notes. You cannot modify original trade data or reverse Formula close.`

## 4. Complete action (append)

- **Add schedule (Closed)**, **Register record (Closed)**, **Settlement note** — existing modals

## 5. Complete cancel action

Payment record cancel (D-09) — not formula-status revoke

## 6. Re-complete action

Register new record after cancel (append)

## 7. Modify action

**Forbidden** on existing schedules/records amounts (DL-033)

## 8. Forbidden after close

Normal Payments tab writes (existing)

## 9. Forbidden after cancel (formula)

Entire Settlement write toolbar hidden

## 10. Modals

Existing settlement modals + cancel record modal

## 11–12. Note text required for settlement note; reason for cancel

## 13. Confirmation copy

Append modals: `Append-only correction on closed Formula (DL-033).`

## 14–16. Logs / Timeline / History

Settlement notes listed on tab; payment events in timeline

## 17. Version impact

**None** (§0.3)

## 18. Settlement impact

Self — KPI refresh

## 19. Header

Unchanged

## 20. RBAC

COMPANY_ADMIN+ (`canSettlementAppend`, `canCancelPayment`)

## 21. Mock preview

Existing preview mutators

## 22. Backend gap

None (mock)

## 23. Acceptance criteria

- [ ] Append only visible when closed + admin
- [ ] Lifecycle note visible on Settlement tab
- [ ] Cancel + re-register pattern documented in UI
- [ ] No close undo implied by Settlement actions

## 24. Definition of Done

`SettlementLifecycleNote` + existing modals; §0.4 copy present

## 25. Instruction to v0

Add `SettlementLifecycleNote` only; keep existing modals. Settlement does not reopen Formula.

---

# Appendix A — File checklist for v0

| # | File |
|---|------|
| 1 | `status-lifecycle-card.tsx` |
| 2 | `status-completion-modal.tsx` |
| 3 | `status-revocation-modal.tsx` |
| 4 | `status-transition-modal.tsx` |
| 5 | `formula-preview-mutations.ts` — unified domain mutators + `StatusActionInput` + event identity |
| 6 | `workflow-modals.tsx` — `SixStatusControls` refactor |
| 7 | `detail-panels.tsx` — `InvoiceCompletionChecklist`, `SettlementLifecycleNote`, Status Log **Reason** column |
| 8 | `formula-detail-view.tsx` — wire `onNavigate`, pass caps |
| 9 | `batch-2-workflows.tsx` — logistics select → transition modal |
| 10 | `formula-math.ts` — `buildTimeline()` description includes `Reason:` per §0.1 |
| 11 | `types.ts` — extend `StatusLog` with `reason`, `correlationId` (preview mapping only) |

---

# Appendix B — Cross-reference to UX spec

| UX spec item | Status spec dependency |
|--------------|------------------------|
| P1-1 Lifecycle Guide | Uses `sixStatuses().done` per step; Close step uses `closeable`; references full lifecycle §0 |
| P1-4 Close Readiness | Links to `StatusLifecycleCard` actions + G1–G4 copy + §0.4 close irreversibility |

---

# Appendix C — Per-domain lifecycle validation (final)

Validation matrix — each column must be **PASS** for v0 handoff.

| Domain | Pending | Modify | Complete | Revoke (Reason req.) | Re-complete | History | Status Log | Timeline | Version | Formula consistency |
|--------|---------|--------|----------|----------------------|-------------|---------|------------|----------|---------|---------------------|
| D-01 Trade | draft/confirmed | draft→confirmed | →completed | completed→confirmed ✓ | ✓ | ✓ immutable | 1 event/transition | Reason in desc | unchanged | `sixStatuses` + `closeable` |
| D-02 Cash In | pending/partial | pending↔partial | →completed | →pending ✓ | ✓ | ✓ | 1 event | Reason in desc | unchanged | payments ≠ auto-complete |
| D-03 Cash Out | pending/partial | pending↔partial | →completed | →pending ✓ | ✓ | ✓ | 1 event | Reason in desc | unchanged | same as D-02 |
| D-04 Invoice | row pending | row enum | derived match | row revoke ✓ | re-match ✓ | ✓ | rollup event on flip | Reason on flip | unchanged | derive only |
| D-05 Logistics | not_started | ↔in_transit | →delivered | →in_transit ✓ | ✓ | ✓ | 1 event | Reason in desc | unchanged | `sixStatuses` |
| D-06 Delivery | pending | ↔in_transit | →delivered | →in_transit ✓ | ✓ | ✓ | 1 event | Reason in desc | unchanged | distinct from logistics |
| D-07 Close | N/A | **No** | close once | **No (MVP)** | **No** | ✓ | 1 close event | projected | unchanged | `isClosed` lock |
| D-08 Cancel | N/A | **No** | cancel once | **No undo** | **No** | ✓ 6 rows | 6 events / 1 correlation | projected | unchanged | all CANCELED |
| D-09 Pay Record | active | **No** | register | cancel (not revoke) | new record | ✓ ledger | no six-status log | payment event | unchanged | cash status untouched |
| D-10 Settlement | N/A | append-only | append | **No** | new record | ✓ notes | payment events | projected | unchanged | closed only |

**Validation result:** All 10 domains **PASS** under v2.1.0 rules.

---

# Appendix D — v0 implementation readiness

| Check | Status |
|-------|--------|
| Full lifecycle specified (not complete-only) | ✓ |
| Revoke Completion Reason required + Memo optional | ✓ §0.1 |
| Unified event identity (History / Timeline / Status Log) | ✓ §0.2 |
| StatusTransitionModal extension points documented | ✓ §1.4 |
| Version rule explicit | ✓ §0.3 |
| Close/Cancel irreversibility explicit | ✓ §0.4 |
| Backend semantics unchanged | ✓ |
| G1–G4 honest preview | ✓ |
| Per-domain v0 instructions | ✓ D-01–D-10 |
| File checklist | ✓ Appendix A |

**Remaining ambiguity for v0:** None that block implementation. Preview `StatusLog.reason` is a UI-layer field mapping to backend `change_reason`; optional `memo` is preview-only until backend adds a column.

---

**Handoff:** Implement D-01 through D-10 in one pass. Mock preview only. Full lifecycle per §0. Final spec v2.1.0 — no further clarification required before v0 start.
