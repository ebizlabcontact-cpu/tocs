"use client"

import { useMemo, useState } from "react"
import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Lock,
  Ban,
  Plus,
  Pencil,
  Trash2,
  UserPlus,
  Truck,
  PackageCheck,
  Handshake,
  ArrowDownLeft,
  ArrowUpRight,
  PieChart,
} from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Field, Input, Select } from "@/components/ui/field"
import { Tooltip } from "@/components/ui/tooltip"
import { formatCurrency, cn } from "@/lib/utils"
import {
  addInvoice,
  addParticipantPreview,
  addPaymentRecord,
  addPaymentSchedule,
  applyVersionTriggerPreview,
  cancelFormulaPreview,
  cancelPaymentRecord,
  closeFormulaPreview,
  deleteSharePreview,
  addLogisticsLegPreview,
  updateLogisticsStatusPreview,
  upsertSharePreview,
} from "@/lib/formula-preview-mutations"
import { deriveExpected, sixStatuses } from "@/lib/formula-math"
import type { Formula, FormulaShare, PaymentRecord } from "@/lib/types"
import { useFormulaWorkflow } from "./formula-workflow-context"
import { BACKEND_ROUTE_GAPS, MockPreviewNote } from "./mock-preview-note"

/* -------------------------------------------------------------------------- */
/* Closed-formula payments banner (V0-PAY-04)                                 */
/* -------------------------------------------------------------------------- */

/** DL-033: no open-formula payment writes once closed — corrections happen on Settlement. */
export function ClosedPaymentsBanner() {
  return (
    <div className="mb-4 flex items-start gap-2 rounded-lg border border-accent/30 bg-accent-soft/50 px-4 py-3 text-sm text-foreground">
      <Lock className="mt-0.5 size-4 shrink-0 text-accent" />
      <span>
        <span className="font-medium">Formula closed — payments locked.</span> Post-close payment changes are
        append-only corrections on the <span className="font-medium">Settlement</span> tab (DL-033). Records below are
        read-only here.
      </span>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Payment modals                                                             */
/* -------------------------------------------------------------------------- */

export function PaymentWorkflowActions({ onCancelRecord }: { onCancelRecord: (recordId: string) => void }) {
  const { formula, caps } = useFormulaWorkflow()
  const canPay = caps.canWritePayments
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [recordOpen, setRecordOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelRecordId, setCancelRecordId] = useState<string | null>(null)

  function requestCancel(id: string) {
    setCancelRecordId(id)
    setCancelOpen(true)
    onCancelRecord(id)
  }

  return (
    <>
      <WorkflowToolbar>
        <ToolbarButton
          icon={Plus}
          label="Add Schedule"
          disabled={!canPay}
          onClick={() => setScheduleOpen(true)}
        />
        <ToolbarButton
          icon={Plus}
          label="Register Record"
          disabled={!canPay}
          onClick={() => setRecordOpen(true)}
        />
        {/* V0-PAY-02: schedule linking happens only at record registration (CreatePaymentRecordRequest.payment_schedule_id).
            No post-create "Link to Schedule" action — backend has no record PATCH. */}
      </WorkflowToolbar>

      <AddScheduleModal open={scheduleOpen} onClose={() => setScheduleOpen(false)} />
      <RegisterRecordModal open={recordOpen} onClose={() => setRecordOpen(false)} />
      <CancelRecordModal
        open={cancelOpen}
        recordId={cancelRecordId}
        onClose={() => {
          setCancelOpen(false)
          setCancelRecordId(null)
        }}
      />

      <PaymentCancelBridge onCancel={requestCancel} />
    </>
  )
}

/** Bridges cancel handler to PaymentRecordsPanel without prop drilling through the panel file. */
const paymentCancelBridge: { fn?: (id: string) => void } = {}

function PaymentCancelBridge({ onCancel }: { onCancel: (id: string) => void }) {
  paymentCancelBridge.fn = onCancel
  return null
}

export function triggerPaymentRecordCancel(recordId: string) {
  paymentCancelBridge.fn?.(recordId)
}

function AddScheduleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { formula, applyPreview } = useFormulaWorkflow()
  const [type, setType] = useState<"receipt" | "payment">("receipt")
  const [counterparty, setCounterparty] = useState("")
  const [amount, setAmount] = useState("")
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().slice(0, 10))

  function submit() {
    const amt = Number(amount)
    if (!counterparty.trim() || !amt || !scheduledDate) return
    applyPreview((f) =>
      addPaymentSchedule(f, { type, counterparty: counterparty.trim(), amount: amt, scheduledDate }),
    )
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Payment Schedule"
      description="Planned receipt or payment — mock preview only."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit}>
            Add Schedule (Preview)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <MockPreviewNote />
        <Field label="Flow type">
          <Select value={type} onChange={(e) => setType(e.target.value as "receipt" | "payment")}>
            <option value="receipt">Receipt (In)</option>
            <option value="payment">Payment (Out)</option>
          </Select>
        </Field>
        <Field label="Counterparty">
          <Input
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            placeholder={formula.participants[0]?.company ?? "Company name"}
          />
        </Field>
        <Field label="Planned amount (KRW)">
          <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Scheduled date">
          <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}

function RegisterRecordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { formula, applyPreview } = useFormulaWorkflow()
  const [type, setType] = useState<"receipt" | "payment">("receipt")
  const [counterparty, setCounterparty] = useState("")
  const [amount, setAmount] = useState("")
  const [paidDate, setPaidDate] = useState(new Date().toISOString().slice(0, 10))
  const [scheduleId, setScheduleId] = useState("")

  function submit() {
    const amt = Number(amount)
    if (!counterparty.trim() || !amt || !paidDate) return
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
      title="Register Payment Record"
      description="Actual bank movement — does not auto-complete Cash In/Out statuses."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit}>
            Register (Preview)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <MockPreviewNote />
        <Field label="Flow type">
          <Select value={type} onChange={(e) => setType(e.target.value as "receipt" | "payment")}>
            <option value="receipt">Receipt (In)</option>
            <option value="payment">Payment (Out)</option>
          </Select>
        </Field>
        <Field label="Counterparty">
          <Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
        </Field>
        <Field label="Actual amount (KRW)">
          <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Actual payment date">
          <Input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
        </Field>
        <Field label="Link to schedule (optional)" hint="Match this record to a planned schedule item.">
          <Select value={scheduleId} onChange={(e) => setScheduleId(e.target.value)}>
            <option value="">— None —</option>
            {formula.schedule.map((s) => (
              <option key={s.id} value={s.id}>
                {s.type} · {s.counterparty} · {formatCurrency(s.amount)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Modal>
  )
}

function CancelRecordModal({
  open,
  recordId,
  onClose,
}: {
  open: boolean
  recordId: string | null
  onClose: () => void
}) {
  const { formula, applyPreview } = useFormulaWorkflow()
  const [reason, setReason] = useState("")
  const record = (formula.records ?? []).find((r) => r.id === recordId)

  function submit() {
    if (!recordId || !reason.trim() || record?.canceled) return
    applyPreview((f) => cancelPaymentRecord(f, recordId, reason.trim()))
    setReason("")
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cancel Payment Record"
      description="Canceled records stay visible but are excluded from realized totals. Re-cancel returns 409 on API."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Back
          </Button>
          <Button variant="accent" onClick={submit} disabled={!reason.trim() || record?.canceled}>
            Cancel Record (Preview)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <MockPreviewNote />
        {record && (
          <p className="text-sm text-muted-foreground">
            {record.type} · {record.counterparty} · {formatCurrency(record.amount)}
          </p>
        )}
        <Field label="Cancellation reason" hint="Required — mirrors backend payment record cancel policy.">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Duplicate entry" />
        </Field>
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/* Settlement record cancel (V0-PAY-05, closed formula, COMPANY_ADMIN+)       */
/* -------------------------------------------------------------------------- */

/**
 * DL-033 allowlist: payment_record_cancel is permitted on a CLOSED formula
 * (COMPANY_ADMIN+ only). Rendered on the Settlement tab so closed formulas keep
 * cancel out of the (locked) Payments tab. Mock preview only.
 */
export function SettlementRecordCancelSection() {
  const { formula, caps } = useFormulaWorkflow()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [recordId, setRecordId] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  if (!formula.isClosed || !caps.canCancelPayment) return null

  const records = formula.records ?? []
  if (records.length === 0) return null

  function requestCancel(r: PaymentRecord) {
    if (r.canceled) {
      // Preview mirror of API 409 Conflict on re-cancel.
      setNote(`${r.counterparty} · ${formatCurrency(r.amount)} is already canceled (API would return 409 Conflict).`)
      return
    }
    setNote(null)
    setRecordId(r.id)
    setCancelOpen(true)
  }

  return (
    <div className="mb-4 rounded-lg border border-dashed border-border bg-secondary/20 p-3">
      <MockPreviewNote className="mb-3 w-full" />
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Manage records — cancel (append-only)
      </p>
      <div className="space-y-2">
        {records.map((r) => (
          <div
            key={r.id}
            className={cn(
              "flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm",
              r.canceled && "opacity-60",
            )}
          >
            <span className="min-w-0 truncate">
              {r.type === "receipt" ? "Receipt" : "Payment"} · {r.counterparty} · {formatCurrency(r.amount)}
              {r.canceled && <span className="ml-2 text-xs text-danger">Canceled</span>}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1 text-xs"
              onClick={() => requestCancel(r)}
              disabled={r.canceled}
            >
              <Ban className="size-3.5" />
              {r.canceled ? "Canceled" : "Cancel (Preview)"}
            </Button>
          </div>
        ))}
      </div>
      {note && <p className="mt-2 text-xs text-warning">{note}</p>}
      <CancelRecordModal
        open={cancelOpen}
        recordId={recordId}
        onClose={() => {
          setCancelOpen(false)
          setRecordId(null)
        }}
      />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Invoice modal                                                              */
/* -------------------------------------------------------------------------- */

export function InvoiceWorkflowActions() {
  const { caps } = useFormulaWorkflow()
  const canInv = caps.canWriteInvoices
  const [open, setOpen] = useState(false)
  return (
    <>
      <WorkflowToolbar>
        <ToolbarButton icon={Plus} label="Add Invoice" disabled={!canInv} onClick={() => setOpen(true)} />
      </WorkflowToolbar>
      <AddInvoiceModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function AddInvoiceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { formula, applyPreview } = useFormulaWorkflow()
  const expected = deriveExpected(formula)
  const [direction, setDirection] = useState<"issued" | "received">("issued")
  const [counterparty, setCounterparty] = useState("")
  const [expectedAmount, setExpectedAmount] = useState(String(expected.totalSell))
  const [externalAmount, setExternalAmount] = useState("")
  const [statusMode, setStatusMode] = useState<"pending" | "matched" | "mismatched" | "custom">("pending")
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10))

  const previewExternal = useMemo(() => {
    const exp = Number(expectedAmount)
    if (statusMode === "pending") return null
    if (statusMode === "matched") return exp
    if (statusMode === "mismatched") return exp + Math.round(exp * 0.05)
    return externalAmount === "" ? null : Number(externalAmount)
  }, [expectedAmount, statusMode, externalAmount])

  const delta = previewExternal == null ? null : previewExternal - Number(expectedAmount)
  const blocksClose = previewExternal == null || previewExternal !== Number(expectedAmount)

  function submit() {
    const exp = Number(expectedAmount)
    if (!counterparty.trim() || !exp) return
    applyPreview((f) =>
      addInvoice(f, {
        direction,
        counterparty: counterparty.trim(),
        expectedAmount: exp,
        externalAmount: previewExternal,
        dueDate,
      }),
    )
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add Invoice"
      description="External amount drives system-derived verification status."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit}>
            Add Invoice (Preview)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <MockPreviewNote />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Direction">
            <Select value={direction} onChange={(e) => setDirection(e.target.value as "issued" | "received")}>
              <option value="issued">Issued (sales)</option>
              <option value="received">Received (purchase)</option>
            </Select>
          </Field>
          <Field label="Counterparty">
            <Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
          </Field>
          <Field label="Expected amount (KRW)">
            <Input type="number" value={expectedAmount} onChange={(e) => setExpectedAmount(e.target.value)} />
          </Field>
          <Field label="Verification preview" hint="Status is derived from external vs expected — not user-entered on API.">
            <Select value={statusMode} onChange={(e) => setStatusMode(e.target.value as typeof statusMode)}>
              <option value="pending">Pending (no external amount)</option>
              <option value="matched">Amount matched</option>
              <option value="mismatched">Amount mismatched</option>
              <option value="custom">Custom external amount</option>
            </Select>
          </Field>
          {statusMode === "custom" && (
            <Field label="External invoice amount (KRW)">
              <Input type="number" value={externalAmount} onChange={(e) => setExternalAmount(e.target.value)} />
            </Field>
          )}
          <Field label="Due date">
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Field>
        </div>
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Close impact (preview)</p>
          <div className="mt-2 space-y-1">
            <p>
              Difference:{" "}
              <span className="font-mono">{delta == null ? "—" : formatCurrency(delta)}</span>
            </p>
            <p className={blocksClose ? "text-warning" : "text-success"}>
              {blocksClose ? "Blocks close until amount is matched" : "Allows close (for this invoice)"}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/* Logistics controls                                                         */
/* -------------------------------------------------------------------------- */

export function LogisticsWorkflowActions() {
  const { formula, caps, applyPreview } = useFormulaWorkflow()
  const canLog = caps.canWriteLogistics
  const [addOpen, setAddOpen] = useState(false)
  const [mode, setMode] = useState<"sea" | "air" | "land">("sea")
  const [origin, setOrigin] = useState("")
  const [destination, setDestination] = useState("")
  const [eta, setEta] = useState(new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10))
  const [cost, setCost] = useState("")

  function addLeg() {
    if (!origin.trim() || !destination.trim()) return
    applyPreview((f) =>
      addLogisticsLegPreview(f, {
        mode,
        origin: origin.trim(),
        destination: destination.trim(),
        eta,
        cost: cost ? Number(cost) : 0,
      }),
    )
    setAddOpen(false)
  }

  return (
    <>
      <WorkflowToolbar>
        <Field label="Logistics status (preview)" className="min-w-[200px]">
          <Select
            value={formula.logisticsStatus}
            disabled={!canLog}
            onChange={(e) =>
              applyPreview((f) => updateLogisticsStatusPreview(f, e.target.value as Formula["logisticsStatus"]))
            }
          >
            <option value="not_started">Not Started</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
          </Select>
        </Field>
        <Tooltip content={BACKEND_ROUTE_GAPS.delivery}>
          <span>
            <Field label="Delivery status" className="min-w-[200px]">
              <Select value={formula.deliveryStatus} disabled>
                <option value="pending">Pending</option>
                <option value="in_transit">In Transit</option>
                <option value="delivered">Delivered</option>
              </Select>
            </Field>
          </span>
        </Tooltip>
        <ToolbarButton icon={Plus} label="Add Leg" disabled={!canLog} onClick={() => setAddOpen(true)} />
        <p className="w-full text-[11px] text-muted-foreground">
          Logistics: mock <code className="text-xs">PATCH …/logistics-status</code> · Delivery: {BACKEND_ROUTE_GAPS.delivery}
          · Vehicles: {BACKEND_ROUTE_GAPS.vehicles}
        </p>
      </WorkflowToolbar>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Logistics Leg"
        description="Preview row only — no backend vehicle CRUD."
        footer={
          <>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button variant="accent" onClick={addLeg}>
              Add Leg (Preview)
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <MockPreviewNote />
          <Field label="Mode">
            <Select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
              <option value="sea">Sea</option>
              <option value="air">Air</option>
              <option value="land">Land</option>
            </Select>
          </Field>
          <Field label="Origin">
            <Input value={origin} onChange={(e) => setOrigin(e.target.value)} />
          </Field>
          <Field label="Destination">
            <Input value={destination} onChange={(e) => setDestination(e.target.value)} />
          </Field>
          <Field label="ETA">
            <Input type="date" value={eta} onChange={(e) => setEta(e.target.value)} />
          </Field>
          <Field label="Leg cost (KRW)">
            <Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Six-status manual controls                                                 */
/* -------------------------------------------------------------------------- */

export function SixStatusControls() {
  const { formula, caps, applyPreview } = useFormulaWorkflow()
  const canStatus = caps.canWrite
  const statuses = sixStatuses(formula)
  const canceled = Boolean(formula.canceledAt)

  const items = [
    {
      key: "trade",
      label: "Trade",
      icon: Handshake,
      status: statuses.find((s) => s.key === "trade")!,
      wired: false,
      gap: BACKEND_ROUTE_GAPS.trade,
    },
    {
      key: "cashIn",
      label: "Cash In",
      icon: ArrowDownLeft,
      status: statuses.find((s) => s.key === "cashIn")!,
      wired: false,
      gap: BACKEND_ROUTE_GAPS.cashIn,
    },
    {
      key: "cashOut",
      label: "Cash Out",
      icon: ArrowUpRight,
      status: statuses.find((s) => s.key === "cashOut")!,
      wired: false,
      gap: BACKEND_ROUTE_GAPS.cashOut,
    },
    {
      key: "invoice",
      label: "Invoice",
      icon: FileText,
      status: statuses.find((s) => s.key === "invoice")!,
      wired: true,
      hint: "Add invoices on Invoices tab — status is derived from amount verification.",
    },
    {
      key: "logistics",
      label: "Logistics",
      icon: Truck,
      status: statuses.find((s) => s.key === "logistics")!,
      wired: true,
      previewAction: () => applyPreview((f) => updateLogisticsStatusPreview(f, "delivered")),
    },
    {
      key: "delivery",
      label: "Delivery",
      icon: PackageCheck,
      status: statuses.find((s) => s.key === "delivery")!,
      wired: false,
      gap: BACKEND_ROUTE_GAPS.delivery,
    },
  ]

  const done = statuses.filter((s) => s.done).length

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Formula Status</p>
        <span className="text-xs text-muted-foreground">
          {canceled ? "Canceled (preview)" : `${done}/6 matched`}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon
          const s = item.status
          return (
            <div
              key={item.key}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border px-3 py-2",
                s.done ? "border-success/30 bg-success-soft" : "border-border bg-secondary/40",
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                {s.done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-success" />
                ) : (
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
                  <p className="truncate text-sm font-medium text-foreground">{s.value}</p>
                </div>
              </div>
              {item.wired && item.previewAction && canStatus && !canceled ? (
                <Button variant="outline" size="sm" className="shrink-0 text-xs" onClick={item.previewAction}>
                  Mark done
                </Button>
              ) : item.wired && item.hint ? (
                <span className="text-[10px] text-muted-foreground">Derived</span>
              ) : (
                <Tooltip content={item.gap ?? "Not wired"}>
                  <button type="button" disabled className="shrink-0 text-[10px] text-muted-foreground opacity-60">
                    API missing
                  </button>
                </Tooltip>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Manual status completion only — payment amounts never auto-complete Cash In/Out. Mock preview updates local
        state; missing backend routes are disabled.
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Close & Cancel dialogs                                                     */
/* -------------------------------------------------------------------------- */

export function CloseFormulaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { formula, applyPreview } = useFormulaWorkflow()
  const statuses = sixStatuses(formula)
  const settlement = deriveExpected(formula)

  function submit() {
    applyPreview(closeFormulaPreview)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Close Formula"
      description="Manual final approval — mock preview only (no POST /close)."
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit} disabled={!formula.closeable || formula.isClosed}>
            Close Formula (Preview)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <MockPreviewNote />
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Six-status readiness</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {statuses.map((s) => (
              <div key={s.key} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span>{s.label}</span>
                <span className={s.done ? "text-success" : "text-warning"}>{s.done ? "Ready" : s.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-secondary/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Review KPI (not blockers)</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Receivable and payable are for review only — they do not gate closing.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <span>Receivable: {formatCurrency(formula.receivable)}</span>
            <span>Payable: {formatCurrency(formula.payable)}</span>
            <span>Expected profit: {formatCurrency(settlement.expectedProfit)}</span>
            <span>Realized profit: {formatCurrency(formula.realizedProfit)}</span>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export function CancelFormulaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { formula, applyPreview } = useFormulaWorkflow()
  const [reason, setReason] = useState("")

  function submit() {
    if (!reason.trim()) return
    applyPreview((f) => cancelFormulaPreview(f, reason.trim()))
    setReason("")
    onClose()
  }

  const canceledLogs = formula.statusLogs.filter((l) => l.newStatus === "canceled").slice(-6)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cancel Formula"
      description="Sets all six statuses to CANCELED in preview — no undo in MVP."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Back
          </Button>
          <Button variant="accent" onClick={submit} disabled={!reason.trim() || Boolean(formula.canceledAt)}>
            Cancel Formula (Preview)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <MockPreviewNote />
        <Field label="Cancellation reason">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required" />
        </Field>
        {formula.canceledAt && (
          <div className="rounded-lg border border-danger/30 bg-danger-soft/30 p-3 text-sm">
            <p className="font-medium text-danger">Formula canceled (preview)</p>
            <p className="mt-1 text-xs text-muted-foreground">All six statuses show CANCELED. Status log preview:</p>
            <ul className="mt-2 space-y-1 text-xs">
              {canceledLogs.map((l) => (
                <li key={l.id}>
                  {l.statusType}: {l.previousStatus} → {l.newStatus}
                  {l.memo ? ` — ${l.memo}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/* Participant add + version trigger (V0-PART-01)                             */
/* -------------------------------------------------------------------------- */

/** Mock registered companies — stands in for useRegisteredCompanies() until master data API is wired. */
const MOCK_REGISTERED_COMPANIES = [
  "Hanwha Trading Co.",
  "Samil Logistics",
  "Daewoo International",
  "Kospo Materials",
  "Nexen Global Partners",
]

const CUSTOM_COMPANY = "__custom__"

export function ParticipantWorkflowActions() {
  const { caps } = useFormulaWorkflow()
  const [open, setOpen] = useState(false)

  if (!caps.canWrite) {
    return (
      <Tooltip content="Requires MANAGER+ role on an open formula.">
        <span className="mb-4 inline-block text-xs text-muted-foreground opacity-60">
          Add participant unavailable
        </span>
      </Tooltip>
    )
  }

  return (
    <>
      <WorkflowToolbar>
        <ToolbarButton icon={UserPlus} label="Add Participant" onClick={() => setOpen(true)} />
      </WorkflowToolbar>
      <AddParticipantModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

function AddParticipantModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { formula, applyPreview, appendVersion } = useFormulaWorkflow()

  const chainCompanies = useMemo(
    () => Array.from(new Set(formula.participants.map((p) => p.company).filter(Boolean))),
    [formula.participants],
  )
  const companyOptions = useMemo(
    () => Array.from(new Set([...chainCompanies, ...MOCK_REGISTERED_COMPANIES])),
    [chainCompanies],
  )

  const [companySelect, setCompanySelect] = useState("")
  const [customCompany, setCustomCompany] = useState("")
  const [roleGroup, setRoleGroup] = useState("buyer")
  const [natureGroup, setNatureGroup] = useState("trading")
  const [paymentGroup, setPaymentGroup] = useState("credit")
  const [quantity, setQuantity] = useState(String(formula.quantity ?? ""))
  const [buyUnitPrice, setBuyUnitPrice] = useState("")
  const [sellUnitPrice, setSellUnitPrice] = useState("")
  const [isStart, setIsStart] = useState(false)
  const [isEnd, setIsEnd] = useState(false)
  const [memo, setMemo] = useState("")
  const [versionOpen, setVersionOpen] = useState(false)

  const company = companySelect === CUSTOM_COMPANY ? customCompany.trim() : companySelect
  const hasStart = formula.participants.some((p) => p.isStart)
  const hasEnd = formula.participants.some((p) => p.isEnd)
  const startConflict = isStart && hasStart
  const endConflict = isEnd && hasEnd
  const canContinue = Boolean(company) && !startConflict && !endConflict

  function reset() {
    setCompanySelect("")
    setCustomCompany("")
    setRoleGroup("buyer")
    setNatureGroup("trading")
    setPaymentGroup("credit")
    setQuantity(String(formula.quantity ?? ""))
    setBuyUnitPrice("")
    setSellUnitPrice("")
    setIsStart(false)
    setIsEnd(false)
    setMemo("")
  }

  function save() {
    if (!company) return
    const summary = `Participant added: ${company}`
    applyPreview((f) =>
      addParticipantPreview(f, {
        company,
        roleGroup,
        natureGroup,
        paymentGroup,
        quantity: quantity ? Number(quantity) : undefined,
        buyUnitPrice: buyUnitPrice ? Number(buyUnitPrice) : undefined,
        sellUnitPrice: sellUnitPrice ? Number(sellUnitPrice) : undefined,
        isStart,
        isEnd,
        memo: memo.trim() || undefined,
      }),
    )
    const nextNo = formula.latestVersionNo + 1
    appendVersion({
      versionNo: nextNo,
      createdAt: new Date().toISOString(),
      createdBy: "Preview User",
      summary,
      changes: [
        {
          field: "participants",
          label: "Participant",
          oldValue: formula.participants.length,
          newValue: formula.participants.length + 1,
          valueType: "text",
          versionTriggering: true,
        },
      ],
    })
    applyPreview((f) => applyVersionTriggerPreview(f, summary))
    setVersionOpen(false)
    reset()
    onClose()
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Add Participant"
        description="POST /formulas/:id/participants — creates participant + version + snapshot + audit."
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="accent" disabled={!canContinue} onClick={() => setVersionOpen(true)}>
              Continue
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <MockPreviewNote />
          <Field label="Company" hint="Registered companies or an existing chain member.">
            <Select value={companySelect} onChange={(e) => setCompanySelect(e.target.value)}>
              <option value="">Select company…</option>
              {companyOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value={CUSTOM_COMPANY}>Other (type below)…</option>
            </Select>
          </Field>
          {companySelect === CUSTOM_COMPANY && (
            <Field label="Company name">
              <Input value={customCompany} onChange={(e) => setCustomCompany(e.target.value)} />
            </Field>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Role group">
              <Select value={roleGroup} onChange={(e) => setRoleGroup(e.target.value)}>
                <option value="supplier">Supplier</option>
                <option value="buyer">Buyer</option>
                <option value="carrier">Carrier</option>
                <option value="financial">Financial</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Nature group">
              <Select value={natureGroup} onChange={(e) => setNatureGroup(e.target.value)}>
                <option value="manufacturer">Manufacturer</option>
                <option value="trading">Trading</option>
                <option value="agent">Agent</option>
                <option value="logistics">Logistics</option>
              </Select>
            </Field>
            <Field label="Payment group">
              <Select value={paymentGroup} onChange={(e) => setPaymentGroup(e.target.value)}>
                <option value="prepaid">Prepaid</option>
                <option value="credit">Credit</option>
                <option value="postpaid">Postpaid</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Quantity">
              <Input type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </Field>
            <Field label="Buy unit price (KRW)">
              <Input type="number" min={0} value={buyUnitPrice} onChange={(e) => setBuyUnitPrice(e.target.value)} />
            </Field>
            <Field label="Sell unit price (KRW)">
              <Input type="number" min={0} value={sellUnitPrice} onChange={(e) => setSellUnitPrice(e.target.value)} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isStart} onChange={(e) => setIsStart(e.target.checked)} />
              Start point
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isEnd} onChange={(e) => setIsEnd(e.target.checked)} />
              End point
            </label>
          </div>
          {(startConflict || endConflict) && (
            <p className="text-xs text-danger">
              {startConflict && "A start point already exists in this chain. "}
              {endConflict && "An end point already exists in this chain. "}
              Uncheck to continue.
            </p>
          )}
          <Field label="Memo (optional)">
            <Input value={memo} onChange={(e) => setMemo(e.target.value)} />
          </Field>
        </div>
      </Modal>
      <VersionTriggerModal
        open={versionOpen}
        onClose={() => setVersionOpen(false)}
        onConfirm={save}
        actionLabel="Add participant"
      />
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Share CRUD + version trigger                                               */
/* -------------------------------------------------------------------------- */

export function ShareWorkflowActions() {
  const { caps } = useFormulaWorkflow()
  const canShare = caps.canWriteShares
  const [open, setOpen] = useState(false)
  const [editShare, setEditShare] = useState<FormulaShare | null>(null)

  return (
    <>
      <WorkflowToolbar>
        <ToolbarButton
          icon={Plus}
          label="Add Share"
          disabled={!canShare}
          onClick={() => {
            setEditShare(null)
            setOpen(true)
          }}
        />
      </WorkflowToolbar>
      <ShareEditorModal
        open={open}
        share={editShare}
        onClose={() => {
          setOpen(false)
          setEditShare(null)
        }}
      />
      <ShareListEditor onEdit={(s) => { setEditShare(s); setOpen(true) }} />
    </>
  )
}

function ShareListEditor({ onEdit }: { onEdit: (s: FormulaShare) => void }) {
  const { formula, caps, applyPreview, appendVersion } = useFormulaWorkflow()
  const canShare = caps.canWriteShares
  const shares = formula.shares ?? []
  const [versionOpen, setVersionOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  function confirmVersion(mutator: () => void, summary: string, oldTotal: number, newTotal: number) {
    mutator()
    const nextNo = formula.latestVersionNo + 1
    appendVersion({
      versionNo: nextNo,
      createdAt: new Date().toISOString(),
      createdBy: "Preview User",
      summary,
      changes: [
        {
          field: "totalShare",
          label: "Total Share",
          oldValue: oldTotal,
          newValue: newTotal,
          valueType: "currency",
          versionTriggering: true,
        },
      ],
    })
    applyPreview((f) => applyVersionTriggerPreview(f, summary, { oldTotal, newTotal }))
    setVersionOpen(false)
    setPendingDelete(null)
  }

  if (shares.length === 0) return null

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {shares.map((s) => (
        <div key={s.id} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
          <span>{s.companyName}</span>
          {canShare && (
            <>
              <button type="button" className="text-accent" onClick={() => onEdit(s)}>
                <Pencil className="size-3" />
              </button>
              <button
                type="button"
                className="text-danger"
                onClick={() => {
                  setPendingDelete(s.id)
                  setVersionOpen(true)
                }}
              >
                <Trash2 className="size-3" />
              </button>
            </>
          )}
        </div>
      ))}
      <VersionTriggerModal
        open={versionOpen}
        onClose={() => { setVersionOpen(false); setPendingDelete(null) }}
        onConfirm={() => {
          const oldTotal = shares.reduce((sum, x) => sum + x.amount, 0)
          if (pendingDelete) {
            const next = shares.filter((x) => x.id !== pendingDelete)
            const newTotal = next.reduce((sum, x) => sum + x.amount, 0)
            confirmVersion(
              () => applyPreview((f) => deleteSharePreview(f, pendingDelete)),
              "Share row deleted",
              oldTotal,
              newTotal,
            )
          }
        }}
        actionLabel={pendingDelete ? "Delete share" : "Save share"}
      />
    </div>
  )
}

function ShareEditorModal({
  open,
  onClose,
  share,
}: {
  open: boolean
  onClose: () => void
  share: FormulaShare | null
}) {
  const { formula, applyPreview, appendVersion } = useFormulaWorkflow()
  const expected = deriveExpected(formula)
  const [companyName, setCompanyName] = useState(share?.companyName ?? "")
  const [method, setMethod] = useState<FormulaShare["method"]>(share?.method ?? "fixed")
  const [amount, setAmount] = useState(String(share?.amount ?? 0))
  const [rate, setRate] = useState(String(share?.rate ?? 10))
  const [splitCount, setSplitCount] = useState(String(share?.splitCount ?? 2))
  const [note, setNote] = useState(share?.note ?? "")
  const [versionOpen, setVersionOpen] = useState(false)

  const computedAmount = useMemo(() => {
    if (method === "rate") return Math.round(expected.expectedProfit * (Number(rate) / 100))
    if (method === "split") {
      const n = Math.max(1, Number(splitCount))
      const total = formula.shares?.reduce((s, x) => s + x.amount, 0) ?? formula.share
      return Math.round(total / n)
    }
    return Number(amount)
  }, [method, amount, rate, splitCount, expected.expectedProfit, formula.shares, formula.share])

  const profitAfter = expected.expectedProfit - computedAmount + (share?.amount ?? 0)

  function save() {
    const oldTotal = (formula.shares ?? []).reduce((s, x) => s + x.amount, 0)
    const input = {
      id: share?.id,
      companyName: companyName.trim(),
      amount: computedAmount,
      note,
      method,
      rate: method === "rate" ? Number(rate) : undefined,
      splitCount: method === "split" ? Number(splitCount) : undefined,
    }
    const newTotal = oldTotal - (share?.amount ?? 0) + computedAmount
    applyPreview((f) => upsertSharePreview(f, input))
    const nextNo = formula.latestVersionNo + 1
    appendVersion({
      versionNo: nextNo,
      createdAt: new Date().toISOString(),
      createdBy: "Preview User",
      summary: share ? "Share updated" : "Share added",
      changes: [
        {
          field: "shareAmount",
          label: "Share Amount",
          oldValue: share?.amount ?? 0,
          newValue: computedAmount,
          valueType: "currency",
          versionTriggering: true,
        },
      ],
    })
    applyPreview((f) => applyVersionTriggerPreview(f, share ? "Share updated" : "Share added", { oldTotal, newTotal }))
    onClose()
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={share ? "Edit Share" : "Add Share"}
        description="Share changes trigger a new Formula Version in production."
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="accent"
              disabled={!companyName.trim()}
              onClick={() => setVersionOpen(true)}
            >
              Continue
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <MockPreviewNote />
          <Field label="Company">
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </Field>
          <Field label="Share method">
            <Select value={method} onChange={(e) => setMethod(e.target.value as FormulaShare["method"])}>
              <option value="fixed">Fixed amount (KRW)</option>
              <option value="rate">Percentage of expected profit</option>
              <option value="split">N/1 split of total share</option>
            </Select>
          </Field>
          {method === "fixed" && (
            <Field label="Amount (KRW)">
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
          )}
          {method === "rate" && (
            <Field label="Rate (% of expected profit)">
              <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
            </Field>
          )}
          {method === "split" && (
            <Field label="Split count (N)">
              <Input type="number" min={1} value={splitCount} onChange={(e) => setSplitCount(e.target.value)} />
            </Field>
          )}
          <Field label="Note">
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">
            <p>Computed share: <span className="font-mono font-semibold">{formatCurrency(computedAmount)}</span></p>
            <p className="mt-1 text-muted-foreground">
              Expected profit after share (preview): {formatCurrency(profitAfter)}
            </p>
          </div>
        </div>
      </Modal>
      <VersionTriggerModal
        open={versionOpen}
        onClose={() => setVersionOpen(false)}
        onConfirm={save}
        actionLabel={share ? "Update share" : "Add share"}
      />
    </>
  )
}

export function VersionTriggerModal({
  open,
  onClose,
  onConfirm,
  actionLabel,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  actionLabel: string
}) {
  const { formula } = useFormulaWorkflow()
  const expected = deriveExpected(formula)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Version Trigger Confirmation"
      description="This change would create formula_versions + calculation_snapshots + audit_logs on the backend."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={onConfirm}>
            {actionLabel} (Preview v{formula.latestVersionNo + 1})
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <MockPreviewNote />
        <p>Current version: v{formula.latestVersionNo}</p>
        <p>Expected profit impact (preview): {formatCurrency(expected.expectedProfit)}</p>
        <p className="text-xs text-muted-foreground">
          Share, quantity, prices, exchange rates, and logistics cost are version-triggering fields per TOCS policy.
        </p>
      </div>
    </Modal>
  )
}

/* -------------------------------------------------------------------------- */
/* Shared toolbar primitives                                                  */
/* -------------------------------------------------------------------------- */

function WorkflowToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-border bg-secondary/20 px-3 py-3">
      <MockPreviewNote className="w-full" />
      {children}
    </div>
  )
}

function ToolbarButton({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button variant="outline" size="sm" className="gap-1.5" disabled={disabled} onClick={onClick}>
      <Icon className="size-3.5" />
      {label}
    </Button>
  )
}
