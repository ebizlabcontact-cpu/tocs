"use client"

import { useMemo, useState } from "react"
import { Pencil, FileText, MessageSquare, Plus, Filter, History, Lock } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Field, Input, Select } from "@/components/ui/field"
import { Tooltip } from "@/components/ui/tooltip"
import { formatCurrency, cn } from "@/lib/utils"
import {
  addSettlementNotePreview,
  addPaymentSchedule,
  addPaymentRecord,
  patchFormulaMetadataPreview,
  updateInvoiceStatusPreview,
} from "@/lib/formula-preview-mutations"
import { deriveInvoiceVerification } from "@/lib/formula-math"
import { useFormulaWorkflow } from "./formula-workflow-context"
import { MockPreviewNote } from "./mock-preview-note"
import type { InvoiceRecord } from "@/lib/types"

function WorkflowToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border bg-secondary/20 px-3 py-3">
      <MockPreviewNote className="w-full" />
      {children}
    </div>
  )
}

/* ---- Metadata PATCH (B-02) ---- */

export function MetadataWorkflowActions() {
  const { caps, applyPreview, formula } = useFormulaWorkflow()
  const [open, setOpen] = useState(false)

  if (!caps.canEditMetadata) {
    return (
      <Tooltip content="Requires MANAGER+ role and an open formula.">
        <span className="mb-4 inline-block text-xs text-muted-foreground opacity-60">Metadata edit unavailable</span>
      </Tooltip>
    )
  }

  return (
    <>
      <Button variant="outline" size="sm" className="mb-4 gap-1.5" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" />
        Edit metadata (Preview)
      </Button>
      <MetadataModal open={open} onClose={() => setOpen(false)} formula={formula} applyPreview={applyPreview} />
    </>
  )
}

function MetadataModal({
  open,
  onClose,
  formula,
  applyPreview,
}: {
  open: boolean
  onClose: () => void
  formula: ReturnType<typeof useFormulaWorkflow>["formula"]
  applyPreview: ReturnType<typeof useFormulaWorkflow>["applyPreview"]
}) {
  const [unit, setUnit] = useState(formula.unit)
  const [specMemo, setSpecMemo] = useState(formula.specMemo)
  const [note, setNote] = useState(formula.note ?? "")

  function save() {
    applyPreview((f) => patchFormulaMetadataPreview(f, { unit, specMemo, note }))
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Formula Metadata"
      description="PATCH /formulas/:id — non-version fields only (mock preview)."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={save}>
            Save (Preview)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <MockPreviewNote />
        <Field label="Unit">
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
        </Field>
        <Field label="Spec / Quality memo (content)">
          <Input value={specMemo} onChange={(e) => setSpecMemo(e.target.value)} />
        </Field>
        <Field label="Internal note">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

/* ---- Invoice status update (B-11) ---- */

export function InvoiceStatusActions({ invoice }: { invoice: InvoiceRecord }) {
  const { caps, applyPreview } = useFormulaWorkflow()
  const [open, setOpen] = useState(false)
  if (invoice.canceled || !caps.canWriteInvoices) return null

  return (
    <>
      <Button variant="outline" size="sm" className="mt-2 gap-1 text-xs" onClick={() => setOpen(true)}>
        <FileText className="size-3" />
        Update Status (Preview)
      </Button>
      <InvoiceStatusModal open={open} onClose={() => setOpen(false)} invoice={invoice} applyPreview={applyPreview} />
    </>
  )
}

const INVOICE_STATUS_OPTIONS: { value: NonNullable<InvoiceRecord["statusEnum"]>; label: string }[] = [
  { value: "pending", label: "PENDING" },
  { value: "issued", label: "ISSUED" },
  { value: "received", label: "RECEIVED" },
  { value: "matched", label: "MATCHED" },
  { value: "mismatched", label: "MISMATCHED" },
  { value: "canceled", label: "CANCELED" },
]

/** Preview the external amount the backend would reconcile for a chosen status enum. */
function projectedExternal(invoice: InvoiceRecord, status: NonNullable<InvoiceRecord["statusEnum"]>): number | null {
  switch (status) {
    case "matched":
      return invoice.expectedAmount
    case "mismatched":
      return invoice.expectedAmount + Math.round(invoice.expectedAmount * 0.05)
    case "received":
      return invoice.externalAmount
    default:
      return null
  }
}

function InvoiceStatusModal({
  open,
  onClose,
  invoice,
  applyPreview,
}: {
  open: boolean
  onClose: () => void
  invoice: InvoiceRecord
  applyPreview: ReturnType<typeof useFormulaWorkflow>["applyPreview"]
}) {
  const initial: NonNullable<InvoiceRecord["statusEnum"]> =
    invoice.statusEnum ??
    (invoice.externalAmount == null
      ? "pending"
      : invoice.externalAmount === invoice.expectedAmount
        ? "matched"
        : "mismatched")
  const [status, setStatus] = useState<NonNullable<InvoiceRecord["statusEnum"]>>(initial)

  // amount_verified is DB-derived — we preview it from the projected external amount, never a manual toggle.
  const projected = useMemo(() => projectedExternal(invoice, status), [invoice, status])
  const v = deriveInvoiceVerification({ ...invoice, externalAmount: projected })

  function save() {
    applyPreview((f) => updateInvoiceStatusPreview(f, invoice.id, status))
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Update Invoice Status"
      description="PATCH /invoices/:id/status — accepts a status enum only; amount_verified is DB-derived."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={save}>
            Update (Preview)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <MockPreviewNote />
        <Field label="Status" hint="Prisma InvoiceStatus enum.">
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            {INVOICE_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <dl className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-secondary/30 p-3 text-sm">
          <dt className="text-muted-foreground">Expected amount</dt>
          <dd className="text-right font-mono">{formatCurrency(invoice.expectedAmount)}</dd>
          <dt className="text-muted-foreground">External amount</dt>
          <dd className="text-right font-mono">{projected == null ? "—" : formatCurrency(projected)}</dd>
          <dt className="text-muted-foreground">Amount verified</dt>
          <dd className="text-right">
            <span className={v.matched ? "text-success" : "text-warning"}>{v.matched ? "Verified" : "Unverified"}</span>
          </dd>
        </dl>
        <p className="text-xs text-muted-foreground">
          Derived status: {v.status}
          {v.blocksClose && " — blocks close"}. Verification is computed from amounts, not set directly.
        </p>
      </div>
    </Modal>
  )
}

/* ---- Closed settlement chrome (V0-SET-01, DL-033) ---- */

/**
 * Persistent banner shown atop the Settlement tab for a closed formula. Signals
 * append-only correction mode (not trade edit) with distinct accent-soft chrome.
 */
export function ClosedSettlementBanner() {
  const { formula } = useFormulaWorkflow()
  if (!formula.isClosed) return null
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-accent/40 bg-accent-soft/60 px-4 py-3 text-sm text-foreground">
      <Lock className="mt-0.5 size-4 shrink-0 text-accent" />
      <span>
        <span className="font-medium">Original trade locked.</span> This formula is closed — only append-only
        settlement corrections are allowed here (DL-033). Trade inputs, participants, and versions are immutable.
      </span>
    </div>
  )
}

/* ---- Settlement append closed (B-15, B-16) ---- */

export function SettlementWorkflowActions() {
  const { formula, caps, applyPreview } = useFormulaWorkflow()
  const [noteOpen, setNoteOpen] = useState(false)
  const [schedOpen, setSchedOpen] = useState(false)
  const [recOpen, setRecOpen] = useState(false)

  if (!caps.canSettlementAppend) {
    return (
      <p className="text-xs text-muted-foreground">
        Settlement append actions require a <span className="font-medium">closed</span> formula and COMPANY_ADMIN+ role
        (mock preview).
      </p>
    )
  }

  return (
    <>
      <WorkflowToolbar>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setSchedOpen(true)}>
          <Plus className="size-3.5" />
          Add schedule (Closed)
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRecOpen(true)}>
          <Plus className="size-3.5" />
          Register record (Closed)
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setNoteOpen(true)}>
          <MessageSquare className="size-3.5" />
          Settlement note
        </Button>
      </WorkflowToolbar>
      <SettlementNoteModal open={noteOpen} onClose={() => setNoteOpen(false)} applyPreview={applyPreview} />
      <ClosedScheduleModal open={schedOpen} onClose={() => setSchedOpen(false)} applyPreview={applyPreview} />
      <ClosedRecordModal open={recOpen} onClose={() => setRecOpen(false)} applyPreview={applyPreview} formula={formula} />
      {(formula.settlementNotes ?? []).length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Settlement notes</p>
          {formula.settlementNotes!.map((n) => (
            <div key={n.id} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <p>{n.text}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {n.createdBy} · {new Date(n.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function SettlementNoteModal({
  open,
  onClose,
  applyPreview,
}: {
  open: boolean
  onClose: () => void
  applyPreview: ReturnType<typeof useFormulaWorkflow>["applyPreview"]
}) {
  const [text, setText] = useState("")
  function save() {
    if (!text.trim()) return
    applyPreview((f) => addSettlementNotePreview(f, text.trim()))
    setText("")
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Settlement Note"
      description="POST .../settlement/notes — closed formulas only."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={save} disabled={!text.trim()}>
            Append note (Preview)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <MockPreviewNote />
        <Field label="Note">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Dispute, adjustment context…" />
        </Field>
      </div>
    </Modal>
  )
}

function ClosedScheduleModal({
  open,
  onClose,
  applyPreview,
}: {
  open: boolean
  onClose: () => void
  applyPreview: ReturnType<typeof useFormulaWorkflow>["applyPreview"]
}) {
  const [type, setType] = useState<"receipt" | "payment">("receipt")
  const [counterparty, setCounterparty] = useState("")
  const [amount, setAmount] = useState("")
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10))

  function save() {
    const amt = Number(amount)
    if (!counterparty.trim() || !amt) return
    applyPreview((f) =>
      addPaymentSchedule(f, { type, counterparty: counterparty.trim(), amount: amt, scheduledDate }),
    )
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Append Payment Schedule (Closed)"
      description="POST .../settlement/payment-schedules"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={save}>
            Append (Preview)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <MockPreviewNote />
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as "receipt" | "payment")}>
            <option value="receipt">Receipt</option>
            <option value="payment">Payment</option>
          </Select>
        </Field>
        <Field label="Counterparty">
          <Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
        </Field>
        <Field label="Amount">
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Scheduled date">
          <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

function ClosedRecordModal({
  open,
  onClose,
  applyPreview,
  formula,
}: {
  open: boolean
  onClose: () => void
  applyPreview: ReturnType<typeof useFormulaWorkflow>["applyPreview"]
  formula: ReturnType<typeof useFormulaWorkflow>["formula"]
}) {
  const [type, setType] = useState<"receipt" | "payment">("receipt")
  const [counterparty, setCounterparty] = useState("")
  const [amount, setAmount] = useState("")
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10))
  const [scheduleId, setScheduleId] = useState("")

  function save() {
    const amt = Number(amount)
    if (!counterparty.trim() || !amt) return
    applyPreview((f) =>
      addPaymentRecord(f, {
        type,
        counterparty: counterparty.trim(),
        amount: amt,
        paidDate,
        scheduleId: scheduleId || undefined,
      }),
    )
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Register Payment Record (Closed)"
      description="Append-only actual on closed formula."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={save}>
            Register (Preview)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <MockPreviewNote />
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as "receipt" | "payment")}>
            <option value="receipt">Receipt</option>
            <option value="payment">Payment</option>
          </Select>
        </Field>
        <Field label="Counterparty">
          <Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
        </Field>
        <Field label="Amount">
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Paid date">
          <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
        </Field>
        <Field label="Link schedule">
          <Select value={scheduleId} onChange={(e) => setScheduleId(e.target.value)}>
            <option value="">— None —</option>
            {formula.schedule.map((s) => (
              <option key={s.id} value={s.id}>
                {s.type} · {formatCurrency(s.amount)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  )
}

/* ---- Timeline filters + status log viewer (B partial) ---- */

import { TimelinePanel, StatusLogTable } from "../detail-panels"
import type { Formula } from "@/lib/types"
import type { VersionEntry, StatusLogType } from "@/lib/types"
import { buildTimeline } from "@/lib/formula-math"

const STATUS_LOG_FILTERS: { label: string; value: StatusLogType | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Trade", value: "trade" },
  { label: "Cash In", value: "cashIn" },
  { label: "Cash Out", value: "cashOut" },
  { label: "Invoice", value: "invoice" },
  { label: "Logistics", value: "logistics" },
  { label: "Delivery", value: "delivery" },
]

export function TimelineWorkflowChrome({
  formula,
  versionHistory,
  onNavigate,
}: {
  formula: Formula
  versionHistory?: VersionEntry[]
  onNavigate?: (tab: string) => void
}) {
  const [filter, setFilter] = useState<string>("all")
  const [statusLogFilter, setStatusLogFilter] = useState<StatusLogType | "all">("all")
  const events = buildTimeline(formula, versionHistory)
  const types = useMemo(() => ["all", ...new Set(events.map((e) => e.type))], [events])

  return (
    <div className="space-y-3">
      {/* Section A — Status Logs (canonical status change history) */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status Logs</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Canonical status change history from <code className="text-[10px]">formula.statusLogs</code>. Six domains:
          trade, cash in, cash out, invoice, logistics, delivery.
        </p>
        <div className="mb-3 mt-3 flex flex-wrap gap-2">
          {STATUS_LOG_FILTERS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => setStatusLogFilter(chip.value)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs",
                statusLogFilter === chip.value
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-muted-foreground",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <StatusLogTable formula={formula} statusTypeFilter={statusLogFilter} />
      </div>

      {/* Section divider */}
      <div className="mt-6 mb-4 border-t border-border pt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity Timeline</p>
      </div>

      {/* Section B — Activity Timeline (existing behavior) */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="size-4 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filter events</span>
        {types.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilter(t)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs capitalize",
              filter === t ? "border-accent bg-accent-soft text-accent" : "border-border text-muted-foreground",
            )}
          >
            {t}
          </button>
        ))}
        {filter !== "all" && (
          <span className="text-xs text-muted-foreground">
            {events.filter((e) => e.type === filter).length} of {events.length}
          </span>
        )}
      </div>
      <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
        <History className="mt-0.5 size-3.5 shrink-0" />
        Status log entries are projected from <code className="text-[10px]">formula.statusLogs</code> — authoritative
        list API deferred (Group C).
      </div>
      <TimelinePanel formula={formula} onNavigate={onNavigate} versionHistory={versionHistory} eventFilter={filter} />
    </div>
  )
}
