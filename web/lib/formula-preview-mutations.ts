/**
 * Mock/repository-preview mutations for Formula detail workflows (UI Batch 1).
 * No HTTP — updates in-memory preview state only.
 */
import {
  deriveExpected,
  deriveInvoiceClose,
  deriveRealized,
  deriveSettlement,
  isCloseable,
  isFormulaCanceled,
  scheduleFulfillment,
} from "./formula-math"
import type {
  CashProgress,
  DeliveryState,
  Formula,
  FormulaShare,
  InvoiceRecord,
  LogisticsLeg,
  LogisticsState,
  Participant,
  PaymentRecord,
  PaymentScheduleItem,
  StatusLog,
  StatusLogType,
  TradeProgress,
} from "./types"
import { uid } from "./utils"

export type AddScheduleInput = {
  type: "receipt" | "payment"
  counterparty: string
  amount: number
  scheduledDate: string
}

export type AddRecordInput = {
  type: "receipt" | "payment"
  counterparty: string
  amount: number
  paidDate: string
  scheduleId?: string
}

export type AddInvoiceInput = {
  direction: "issued" | "received"
  counterparty: string
  expectedAmount: number
  externalAmount: number | null
  dueDate: string
}

export type ShareInput = {
  id?: string
  companyName: string
  amount: number
  note?: string
  method?: FormulaShare["method"]
  rate?: number
  splitCount?: number
}

let previewSeq = 0
function nextPreviewId(prefix: string) {
  previewSeq += 1
  return `${prefix}-${Date.now()}-${previewSeq}`
}

function appendStatusLog(
  f: Formula,
  statusType: StatusLogType,
  previousStatus: string | null,
  newStatus: string,
  opts?: { memo?: string; reason?: string; correlationId?: string },
): StatusLog {
  const id = nextPreviewId("sl")
  return {
    id,
    formulaId: f.id,
    statusType,
    previousStatus,
    newStatus,
    changedAt: new Date().toISOString(),
    changedBy: "Preview User",
    reason: opts?.reason,
    // Correlation defaults to the event id for single-domain transitions (§0.2).
    correlationId: opts?.correlationId ?? id,
    memo: opts?.memo,
  }
}

/* -------------------------------------------------------------------------- */
/* Unified status lifecycle mutators (Status Workflow spec §0.2, §1.5)        */
/* -------------------------------------------------------------------------- */

/** Domains that support the unified complete / revoke / modify lifecycle. */
export type StatusDomain = "trade" | "cashIn" | "cashOut" | "logistics" | "delivery"

/** Shared input for every domain status mutator (§1.5). */
export type StatusActionInput = {
  /** Required — maps to backend change_reason. */
  reason: string
  /** Optional supplementary note (preview-only until backend adds a column). */
  memo?: string
}

/** Terminal "complete" value per domain (§1.5 terminal complete values). */
const DOMAIN_COMPLETE_VALUE: Record<StatusDomain, string> = {
  trade: "completed",
  cashIn: "completed",
  cashOut: "completed",
  logistics: "delivered",
  delivery: "delivered",
}

/** Revoke target per domain — fixed, not parameterized (§1.5). */
const DOMAIN_REVOKE_TARGET: Record<StatusDomain, string> = {
  trade: "confirmed",
  cashIn: "pending",
  cashOut: "pending",
  logistics: "in_transit",
  delivery: "in_transit",
}

function currentDomainValue(f: Formula, domain: StatusDomain): string {
  switch (domain) {
    case "trade":
      return f.tradeStatus
    case "cashIn":
      return f.cashInStatus
    case "cashOut":
      return f.cashOutStatus
    case "logistics":
      return f.logisticsStatus
    case "delivery":
      return f.deliveryStatus
  }
}

function setDomainColumn(f: Formula, domain: StatusDomain, value: string): Formula {
  switch (domain) {
    case "trade":
      return { ...f, tradeStatus: value as TradeProgress }
    case "cashIn":
      return { ...f, cashInStatus: value as CashProgress }
    case "cashOut":
      return { ...f, cashOutStatus: value as CashProgress }
    case "logistics": {
      const logistics = f.logistics.map((leg) => ({
        ...leg,
        status:
          value === "delivered"
            ? ("cleared" as const)
            : value === "in_transit"
              ? ("in_transit" as const)
              : leg.status,
      }))
      return { ...f, logisticsStatus: value as LogisticsState, logistics }
    }
    case "delivery":
      return { ...f, deliveryStatus: value as DeliveryState }
  }
}

/**
 * Core domain status write: compares before/after (no-op if equal → no event),
 * updates the domain column, appends exactly ONE StatusLog event, and recomputes
 * formula consistency (§0.2). Never auto-completes Cash In/Out from records.
 */
function applyDomainStatus(f: Formula, domain: StatusDomain, newStatus: string, input: StatusActionInput): Formula {
  const prev = currentDomainValue(f, domain)
  if (prev === newStatus) return f // idempotent no-op — no duplicate event
  const log = appendStatusLog(f, domain, prev, newStatus, { reason: input.reason, memo: input.memo })
  const next = setDomainColumn(f, domain, newStatus)
  return recomputeFormulaPreview({ ...next, statusLogs: [...f.statusLogs, log] })
}

/** Non-terminal change (e.g. trade draft→confirmed, cash pending↔partial) + one event. */
export function transitionDomainStatusPreview(
  f: Formula,
  domain: StatusDomain,
  newStatus: string,
  input: StatusActionInput,
): Formula {
  return applyDomainStatus(f, domain, newStatus, input)
}

/** Terminal complete + one event. */
export function completeDomainStatusPreview(f: Formula, domain: StatusDomain, input: StatusActionInput): Formula {
  return applyDomainStatus(f, domain, DOMAIN_COMPLETE_VALUE[domain], input)
}

/** Revert terminal → revoke target + one event. */
export function revokeDomainStatusPreview(f: Formula, domain: StatusDomain, input: StatusActionInput): Formula {
  return applyDomainStatus(f, domain, DOMAIN_REVOKE_TARGET[domain], input)
}

/** Recompute derived fields after a preview mutation. Never auto-completes cash statuses from payments. */
export function recomputeFormulaPreview(f: Formula): Formula {
  const settlement = deriveSettlement(f)
  const realized = deriveRealized(f)
  const expected = deriveExpected(f)

  const schedule = f.schedule.map((s) => {
    const ful = scheduleFulfillment(f, s.id, s.amount)
    let status: PaymentScheduleItem["status"] = "scheduled"
    if (ful.matchedTotal >= s.amount) status = "settled"
    else if (ful.matchedTotal > 0) status = "partial"
    return { ...s, settledAmount: ful.matchedTotal, status }
  })

  const financials = {
    schedule,
    actualReceipts: realized.actualReceipts,
    actualPayments: realized.actualPayments,
    realizedProfit: realized.realizedProfit,
    receivable: settlement.remainingReceivable,
    payable: settlement.remainingPayable,
    expectedProfit: expected.expectedProfit,
    share: expected.share,
    cost: expected.cost,
    closeable: false as boolean,
    updatedAt: new Date().toISOString(),
  }

  // Canceled formulas keep six CANCELED domain statuses — do not re-derive rollups.
  if (isFormulaCanceled(f)) {
    return {
      ...f,
      ...financials,
      closeable: false,
    }
  }

  const invClose = deriveInvoiceClose(f)
  let invoiceStatus = f.invoiceStatus
  if (invClose.activeCount === 0) invoiceStatus = "unmatched"
  else if (invClose.done) invoiceStatus = "complete"
  else invoiceStatus = "partial"

  const allComplete = isCloseable(f)
  const closeable = allComplete && !f.isClosed

  let status = f.status
  if (f.isClosed) status = "closed"
  else if (closeable) status = "closeable"
  else if (invoiceStatus !== "complete") status = "invoicing"
  else status = "active"

  return {
    ...f,
    ...financials,
    invoiceStatus,
    closeable,
    status,
  }
}

export function addPaymentSchedule(f: Formula, input: AddScheduleInput): Formula {
  const item: PaymentScheduleItem = {
    id: nextPreviewId("sch"),
    type: input.type,
    counterparty: input.counterparty,
    amount: input.amount,
    scheduledDate: input.scheduledDate,
    status: "scheduled",
    settledAmount: 0,
  }
  return recomputeFormulaPreview({ ...f, schedule: [...f.schedule, item] })
}

export function addPaymentRecord(f: Formula, input: AddRecordInput): Formula {
  const record: PaymentRecord = {
    id: nextPreviewId("rec"),
    type: input.type,
    counterparty: input.counterparty,
    amount: input.amount,
    paidDate: input.paidDate,
    scheduleId: input.scheduleId || undefined,
  }
  return recomputeFormulaPreview({ ...f, records: [...(f.records ?? []), record] })
}

export function linkRecordToSchedule(f: Formula, recordId: string, scheduleId: string): Formula {
  const records = (f.records ?? []).map((r) => (r.id === recordId ? { ...r, scheduleId } : r))
  return recomputeFormulaPreview({ ...f, records })
}

export function cancelPaymentRecord(f: Formula, recordId: string, reason: string): Formula {
  const records = (f.records ?? []).map((r) =>
    r.id === recordId && !r.canceled ? { ...r, canceled: true, cancelReason: reason } : r,
  )
  return recomputeFormulaPreview({ ...f, records })
}

export function addInvoice(f: Formula, input: AddInvoiceInput): Formula {
  const inv: InvoiceRecord = {
    id: nextPreviewId("inv"),
    number: `INV-PREVIEW-${uid().slice(0, 6).toUpperCase()}`,
    direction: input.direction,
    counterparty: input.counterparty,
    expectedAmount: input.expectedAmount,
    externalAmount: input.externalAmount,
    dueDate: input.dueDate,
    date: new Date().toISOString(),
  }
  return recomputeFormulaPreview({ ...f, invoices: [...f.invoices, inv] })
}

/** Mock preview for PATCH /formulas/:id/logistics-status (backend shipped). */
export function updateLogisticsStatusPreview(f: Formula, status: LogisticsState): Formula {
  const prev = f.logisticsStatus
  const logs =
    prev === status
      ? f.statusLogs
      : [
          ...f.statusLogs,
          appendStatusLog(f, "logistics", prev, status, { memo: "Mock preview — logistics status update" }),
        ]
  const logistics = f.logistics.map((leg) => ({
    ...leg,
    status:
      status === "delivered"
        ? ("cleared" as const)
        : status === "in_transit"
          ? ("in_transit" as const)
          : leg.status,
  }))
  return recomputeFormulaPreview({ ...f, logisticsStatus: status, logistics, statusLogs: logs })
}

/** Mock preview for trade status — only when explicitly allowed (still preview). */
export function updateTradeStatusPreview(f: Formula, status: TradeProgress): Formula {
  const prev = f.tradeStatus
  const logs =
    prev === status
      ? f.statusLogs
      : [...f.statusLogs, appendStatusLog(f, "trade", prev, status, { memo: "Mock preview — trade status update" })]
  return recomputeFormulaPreview({ ...f, tradeStatus: status, statusLogs: logs })
}

export function closeFormulaPreview(f: Formula): Formula {
  if (f.isClosed || f.canceledAt) return f
  const closedAt = new Date().toISOString()
  const logs = [
    ...f.statusLogs,
    appendStatusLog(f, "trade", f.tradeStatus, "closed", { memo: "Mock preview — formula closed" }),
  ]
  return recomputeFormulaPreview({
    ...f,
    isClosed: true,
    closedAt,
    closeable: false,
    status: "closed",
    statusLogs: logs,
    attention: undefined,
  })
}

export function cancelFormulaPreview(f: Formula, reason: string): Formula {
  if (f.canceledAt) return f
  const canceledAt = new Date().toISOString()
  const types: StatusLogType[] = ["trade", "cashIn", "cashOut", "invoice", "logistics", "delivery"]
  const prevMap: Record<StatusLogType, string> = {
    trade: f.tradeStatus,
    cashIn: f.cashInStatus,
    cashOut: f.cashOutStatus,
    invoice: f.invoiceStatus,
    logistics: f.logisticsStatus,
    delivery: f.deliveryStatus,
  }
  // Formula Cancel exception (§0.2): six rows share one correlationId, each with own eventId.
  const correlationId = nextPreviewId("corr")
  const newLogs = types.map((t) => appendStatusLog(f, t, prevMap[t], "canceled", { reason, memo: reason, correlationId }))
  return recomputeFormulaPreview({
    ...f,
    canceledAt,
    tradeStatus: "canceled",
    cashInStatus: "canceled",
    cashOutStatus: "canceled",
    invoiceStatus: "canceled",
    logisticsStatus: "canceled",
    deliveryStatus: "canceled",
    isClosed: false,
    attention: `Formula canceled (preview): ${reason}`,
    statusLogs: [...f.statusLogs, ...newLogs],
  })
}

export function upsertSharePreview(f: Formula, input: ShareInput): Formula {
  const shares = [...(f.shares ?? [])]
  const row: FormulaShare = {
    id: input.id ?? nextPreviewId("sh"),
    companyName: input.companyName,
    amount: input.amount,
    note: input.note,
    method: input.method,
    rate: input.rate,
    splitCount: input.splitCount,
  }
  const idx = shares.findIndex((s) => s.id === row.id)
  if (idx >= 0) shares[idx] = row
  else shares.push(row)
  return recomputeFormulaPreview({ ...f, shares })
}

export function deleteSharePreview(f: Formula, shareId: string): Formula {
  const shares = (f.shares ?? []).filter((s) => s.id !== shareId)
  return recomputeFormulaPreview({ ...f, shares })
}

export function addLogisticsLegPreview(
  f: Formula,
  input: { mode: LogisticsLeg["mode"]; origin: string; destination: string; eta: string; cost?: number },
): Formula {
  const leg: LogisticsLeg = {
    id: nextPreviewId("lg"),
    carrier: "Preview Carrier",
    mode: input.mode,
    origin: input.origin,
    destination: input.destination,
    status: "booked",
    eta: input.eta,
    actualArrival: null,
    actualDelivery: null,
    cost: input.cost ?? 0,
    costBearer: f.tradeType === "export" ? "Seller (FOB)" : "Buyer (CIF)",
  }
  return recomputeFormulaPreview({ ...f, logistics: [...f.logistics, leg] })
}

export function applyVersionTriggerPreview(
  f: Formula,
  summary: string,
  shareDelta?: { oldTotal: number; newTotal: number },
): Formula {
  const nextNo = f.latestVersionNo + 1
  const expected = deriveExpected(f)
  return {
    ...recomputeFormulaPreview(f),
    latestVersionNo: nextNo,
    attention: `Version ${nextNo} created (preview): ${summary}${
      shareDelta ? ` — share ${shareDelta.oldTotal} → ${shareDelta.newTotal}` : ""
    }. Expected profit: ${expected.expectedProfit.toLocaleString()} KRW`,
  }
}

export type AddParticipantInput = {
  company: string
  sequenceOrder?: number
  roleGroup?: string
  natureGroup?: string
  paymentGroup?: string
  buyUnitPrice?: number
  sellUnitPrice?: number
  quantity?: number
  isStart?: boolean
  isEnd?: boolean
  memo?: string
}

const ROLE_GROUP_TO_LEGACY: Record<string, Participant["role"]> = {
  supplier: "seller",
  buyer: "buyer",
  carrier: "logistics",
  financial: "financier",
  other: "agent",
}

/**
 * Append a participant to the chain (mock preview for POST .../participants).
 * Recomputes chain totals so expected amounts refresh; version bump is handled
 * by the caller via applyVersionTriggerPreview (matches Share flow).
 */
export function addParticipantPreview(f: Formula, input: AddParticipantInput): Formula {
  const roleGroup = input.roleGroup || "other"
  const sequenceOrder =
    input.sequenceOrder ??
    (f.participants.reduce((max, p) => Math.max(max, p.sequenceOrder ?? p.chainOrder ?? 0), -1) + 1)

  const participant: Participant = {
    id: nextPreviewId("pt"),
    sequenceOrder,
    chainOrder: sequenceOrder,
    company: input.company,
    name: input.company,
    roleGroup,
    natureGroup: input.natureGroup || undefined,
    paymentGroup: input.paymentGroup || undefined,
    quantity: input.quantity,
    buyUnitPrice: input.buyUnitPrice,
    sellUnitPrice: input.sellUnitPrice,
    isStart: input.isStart,
    isEnd: input.isEnd,
    role: ROLE_GROUP_TO_LEGACY[roleGroup] ?? "agent",
    nature: input.natureGroup || undefined,
    buyPrice: input.buyUnitPrice,
    sellPrice: input.sellUnitPrice,
  }

  const participants = [...f.participants, participant]
  const qty = f.quantity
  const totalSell = participants
    .filter((p) => p.isEnd)
    .reduce((s, p) => s + (p.buyUnitPrice ?? p.buyPrice ?? 0) * (p.quantity ?? qty ?? 0), 0)
  const totalBuy = participants
    .filter((p) => p.isStart)
    .reduce((s, p) => s + (p.sellUnitPrice ?? p.sellPrice ?? 0) * (p.quantity ?? qty ?? 0), 0)

  return recomputeFormulaPreview({
    ...f,
    participants,
    totalSell: totalSell || f.totalSell,
    totalBuy: totalBuy || f.totalBuy,
  })
}

export type MetadataPatch = {
  unit?: string
  specMemo?: string
  note?: string
}

/** Non-version metadata PATCH preview (Prisma note/content/unit). */
export function patchFormulaMetadataPreview(f: Formula, patch: MetadataPatch): Formula {
  return recomputeFormulaPreview({
    ...f,
    unit: patch.unit ?? f.unit,
    specMemo: patch.specMemo ?? f.specMemo,
    note: patch.note ?? f.note,
  })
}

/** Invoice status sync preview — external amount drives verification (PATCH .../invoices/:id/status). */
export function updateInvoiceExternalAmountPreview(
  f: Formula,
  invoiceId: string,
  externalAmount: number | null,
): Formula {
  const invoices = f.invoices.map((inv) =>
    inv.id === invoiceId && !inv.canceled ? { ...inv, externalAmount } : inv,
  )
  return recomputeFormulaPreview({ ...f, invoices })
}

/**
 * PATCH /invoices/:id/status preview (V0-INV-01). The backend accepts a status
 * enum only; `amount_verified` is DB-derived. Here we set the lifecycle enum and
 * reconcile the external amount so the derived verification badge stays honest —
 * we never let the user hand-toggle verification.
 */
/** P1-02: canonical formula-level invoice rollup label for Status Log / Timeline. */
function invoiceRollupLabel(f: Formula): string {
  const inv = deriveInvoiceClose(f)
  if (inv.activeCount === 0) return "Missing"
  if (inv.done) return "Matched"
  return `${inv.matchedCount}/${inv.activeCount} Matched`
}

export function updateInvoiceStatusPreview(
  f: Formula,
  invoiceId: string,
  status: InvoiceRecord["statusEnum"],
  input: StatusActionInput,
): Formula {
  // 1. Capture the rollup label before the change.
  const beforeLabel = invoiceRollupLabel(f)

  // 2. Apply invoice enum + external amount projection (unchanged switch logic).
  const invoices = f.invoices.map((inv) => {
    if (inv.id !== invoiceId || inv.canceled) return inv
    switch (status) {
      case "matched":
        return { ...inv, statusEnum: status, externalAmount: inv.expectedAmount }
      case "mismatched":
        return {
          ...inv,
          statusEnum: status,
          externalAmount: inv.expectedAmount + Math.round(inv.expectedAmount * 0.05),
        }
      case "received":
        // External received but not yet reconciled — keep any prior amount, else mirror expected pending review.
        return { ...inv, statusEnum: status, externalAmount: inv.externalAmount }
      case "canceled":
        return { ...inv, statusEnum: status, canceled: true }
      case "pending":
      case "issued":
      default:
        return { ...inv, statusEnum: status, externalAmount: null }
    }
  })

  // 3. Recompute derived rollups.
  const next = recomputeFormulaPreview({ ...f, invoices })

  // 4. Only append one formula-level StatusLog when the rollup label flips (D-04).
  const afterLabel = invoiceRollupLabel(next)
  if (beforeLabel !== afterLabel) {
    const log = appendStatusLog(f, "invoice", beforeLabel, afterLabel, {
      reason: input.reason,
      memo: input.memo,
    })
    return { ...next, statusLogs: [...next.statusLogs, log] }
  }

  return next
}

export type VersionCommitInput = {
  quantity: number
  sellUnitPrice: number
}

/** Version commit preview — applies quantity + end sell price, bumps version. */
export function commitVersionPreview(f: Formula, input: VersionCommitInput, summary: string): Formula {
  const qty = input.quantity
  const participants = f.participants.map((p) => {
    if (p.isEnd) {
      return {
        ...p,
        quantity: qty,
        buyUnitPrice: input.sellUnitPrice,
        buyPrice: input.sellUnitPrice,
      }
    }
    if (p.isStart) return { ...p, quantity: qty }
    return { ...p, quantity: qty }
  })
  const totalSell = participants
    .filter((p) => p.isEnd)
    .reduce((s, p) => s + (p.buyUnitPrice ?? p.buyPrice ?? 0) * (p.quantity ?? qty), 0)
  const totalBuy = participants
    .filter((p) => p.isStart)
    .reduce((s, p) => s + (p.sellUnitPrice ?? p.sellPrice ?? 0) * (p.quantity ?? qty), 0)
  const next = {
    ...f,
    quantity: qty,
    participants,
    totalSell,
    totalBuy,
  }
  return applyVersionTriggerPreview(recomputeFormulaPreview(next), summary)
}

/* ---------------- Version-triggering field edits (P1 Feature 3) ---------------- */

/**
 * FX rate change preview (contract / adjusted exchange rate). Version-triggering.
 * KRW totals are illustrative and left unchanged here — the backend recomputes
 * authoritative converted amounts.
 */
export function patchFormulaFxPreview(
  f: Formula,
  patch: { contractExchangeRate?: number; adjustedExchangeRate?: number },
  summary?: string,
): Formula {
  const next = {
    ...f,
    contractExchangeRate: patch.contractExchangeRate ?? f.contractExchangeRate,
    adjustedExchangeRate: patch.adjustedExchangeRate ?? f.adjustedExchangeRate,
  }
  const label =
    summary ??
    `Exchange rate updated (contract ${next.contractExchangeRate ?? "—"}, adjusted ${next.adjustedExchangeRate ?? "—"})`
  return applyVersionTriggerPreview(recomputeFormulaPreview(next), label)
}

/**
 * Total logistics cost change preview. Version-triggering. Keeps the canonical
 * logistics-cost rollup (`deriveLogisticsCost` sums `logistics[].cost`) in sync
 * with the new total so Expected Profit reflects the change: existing legs are
 * scaled proportionally (or split evenly) to the new total; when there are no
 * legs the scalar `cost` carries it.
 */
export function patchLogisticsCostPreview(f: Formula, totalLogisticsCost: number, summary?: string): Formula {
  const total = Math.max(0, Math.round(totalLogisticsCost))
  const legs = f.logistics ?? []
  let logistics = legs
  if (legs.length > 0) {
    const currentSum = legs.reduce((s, l) => s + (l.cost ?? 0), 0)
    if (currentSum > 0) {
      const factor = total / currentSum
      logistics = legs.map((l) => ({ ...l, cost: Math.round((l.cost ?? 0) * factor) }))
    } else {
      const each = Math.round(total / legs.length)
      logistics = legs.map((l) => ({ ...l, cost: each }))
    }
  }
  const label = summary ?? `Logistics cost updated to ${total.toLocaleString()} KRW`
  return applyVersionTriggerPreview(recomputeFormulaPreview({ ...f, cost: total, logistics }), label)
}

/**
 * Participant unit economics change preview (quantity, buy/sell unit price).
 * Version-triggering. Refreshes chain start/end totals so expected amounts track.
 */
export function patchParticipantEconomicsPreview(
  f: Formula,
  participantId: string,
  patch: { quantity?: number; buyUnitPrice?: number; sellUnitPrice?: number },
  summary?: string,
): Formula {
  const participants = f.participants.map((p) => {
    if (p.id !== participantId) return p
    const quantity = patch.quantity ?? p.quantity
    const buyUnitPrice = patch.buyUnitPrice ?? p.buyUnitPrice
    const sellUnitPrice = patch.sellUnitPrice ?? p.sellUnitPrice
    return {
      ...p,
      quantity,
      buyUnitPrice,
      sellUnitPrice,
      buyPrice: buyUnitPrice,
      sellPrice: sellUnitPrice,
    }
  })
  const qty = f.quantity
  const totalSell = participants
    .filter((p) => p.isEnd)
    .reduce((s, p) => s + (p.buyUnitPrice ?? p.buyPrice ?? 0) * (p.quantity ?? qty ?? 0), 0)
  const totalBuy = participants
    .filter((p) => p.isStart)
    .reduce((s, p) => s + (p.sellUnitPrice ?? p.sellPrice ?? 0) * (p.quantity ?? qty ?? 0), 0)

  const target = f.participants.find((p) => p.id === participantId)
  const label = summary ?? `Participant economics updated: ${target?.company ?? participantId}`
  return applyVersionTriggerPreview(
    recomputeFormulaPreview({
      ...f,
      participants,
      totalSell: totalSell || f.totalSell,
      totalBuy: totalBuy || f.totalBuy,
    }),
    label,
  )
}

/** Closed-formula settlement note append (POST .../settlement/notes). */
export function addSettlementNotePreview(f: Formula, text: string): Formula {
  if (!f.isClosed) return f
  const note = {
    id: nextPreviewId("sn"),
    text,
    createdAt: new Date().toISOString(),
    createdBy: "Preview User",
  }
  return recomputeFormulaPreview({
    ...f,
    settlementNotes: [...(f.settlementNotes ?? []), note],
  })
}
