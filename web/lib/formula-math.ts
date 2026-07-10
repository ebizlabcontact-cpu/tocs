import type { Formula, InvoiceRecord, InvoiceStatus, PaymentScheduleItem, VersionEntry } from "./types"
import { formatCurrency } from "./utils"

/**
 * Canonical Formula derivation adapter (P0-4).
 *
 * Every preview surface (detail view, calculation breakdown, settlement,
 * shares) reads its headline figures from here so there is exactly one
 * definition of Expected Profit, Realized Profit, and Share. These are
 * illustrative frontend derivations — authoritative calculations belong to
 * backend services and database views after integration.
 *
 *   Expected Net Profit = Total Sell − Total Buy − Costs − Share
 *   Realized Net Profit = Actual Receipts − Actual Payments   (from records)
 */

export type ExpectedDerivation = {
  totalSell: number
  totalBuy: number
  cost: number
  share: number
  grossMargin: number
  expectedProfit: number
}

/**
 * Canonical share total (P0-2): summed from `shares[]` (formula_shares), never the
 * legacy `Formula.share` scalar. Falls back to the scalar only if no share rows
 * exist so legacy fixtures still render.
 */
export function deriveTotalShare(f: Formula): number {
  const rows = f.shares ?? []
  if (rows.length === 0) return f.share ?? 0
  return rows.reduce((sum, s) => sum + (s.amount ?? 0), 0)
}

/**
 * Canonical logistics cost path (P0-6): summed from `logistics[].cost`. Falls back
 * to the `Formula.cost` scalar only when there are no logistics legs, so the
 * scalar cost, per-leg costs and snapshot totalCost never diverge silently.
 */
export function deriveLogisticsCost(f: Formula): number {
  const legs = f.logistics ?? []
  if (legs.length === 0) return f.cost ?? 0
  return legs.reduce((sum, l) => sum + (l.cost ?? 0), 0)
}

export function deriveExpected(f: Formula): ExpectedDerivation {
  const grossMargin = f.totalSell - f.totalBuy
  // Share comes from shares[] and cost from the logistics path — not the scalars.
  const share = deriveTotalShare(f)
  const cost = deriveLogisticsCost(f)
  const expectedProfit = grossMargin - cost - share
  return {
    totalSell: f.totalSell,
    totalBuy: f.totalBuy,
    cost,
    share,
    grossMargin,
    expectedProfit,
  }
}

export type RealizedDerivation = {
  actualReceipts: number
  actualPayments: number
  realizedProfit: number
}

/**
 * Realized figures derive from ACTUAL payment records (Tier 2), never from
 * planned schedules. Canceled records are excluded. Falls back to the stored
 * actuals when a formula carries no records.
 */
export function deriveRealized(f: Formula): RealizedDerivation {
  const records = f.records ?? []
  const active = records.filter((r) => !r.canceled)
  if (active.length > 0) {
    const actualReceipts = active.filter((r) => r.type === "receipt").reduce((s, r) => s + r.amount, 0)
    const actualPayments = active.filter((r) => r.type === "payment").reduce((s, r) => s + r.amount, 0)
    return { actualReceipts, actualPayments, realizedProfit: actualReceipts - actualPayments }
  }
  // All records canceled — realized totals are zero (canceled never counts).
  if (records.length > 0) {
    return { actualReceipts: 0, actualPayments: 0, realizedProfit: 0 }
  }
  // Legacy fixture with no records array — fall back to stored scalars.
  return {
    actualReceipts: f.actualReceipts,
    actualPayments: f.actualPayments,
    realizedProfit: f.actualReceipts - f.actualPayments,
  }
}

export type SettlementDerivation = {
  scheduledReceipts: number
  scheduledPayments: number
  actualReceipts: number
  actualPayments: number
  canceledCount: number
  canceledAmount: number
  remainingReceivable: number
  remainingPayable: number
  /** Actual Receipts ÷ Scheduled Receipts (0–1). */
  receiptRate: number
  /** Actual Payments ÷ Scheduled Payments (0–1). */
  paymentRate: number
}

/**
 * Two-tier settlement rollup (P0-5): planned schedule vs actual records.
 *
 * Domain definitions (TOCS):
 *   Receivable = Scheduled Receipts − Actual Receipts
 *   Payable    = Scheduled Payments − Actual Payments
 *
 * Settlement is derived ONLY from schedules and records. A Formula may
 * intentionally schedule only part of its trade value (advances, installments,
 * credit terms, partial settlements), so schedule totals are NEVER coupled to
 * Total Sell / Total Buy. When nothing is scheduled, the base is 0.
 */
export function deriveSettlement(f: Formula): SettlementDerivation {
  const scheduledReceipts = f.schedule.filter((s) => s.type === "receipt").reduce((s, x) => s + x.amount, 0)
  const scheduledPayments = f.schedule.filter((s) => s.type === "payment").reduce((s, x) => s + x.amount, 0)
  const { actualReceipts, actualPayments } = deriveRealized(f)
  const canceled = (f.records ?? []).filter((r) => r.canceled)
  return {
    scheduledReceipts,
    scheduledPayments,
    actualReceipts,
    actualPayments,
    canceledCount: canceled.length,
    canceledAmount: canceled.reduce((s, r) => s + r.amount, 0),
    remainingReceivable: Math.max(0, scheduledReceipts - actualReceipts),
    remainingPayable: Math.max(0, scheduledPayments - actualPayments),
    receiptRate: scheduledReceipts > 0 ? actualReceipts / scheduledReceipts : 0,
    paymentRate: scheduledPayments > 0 ? actualPayments / scheduledPayments : 0,
  }
}

/**
 * Rolls up actual (non-canceled) records matched to a schedule item, plus the
 * remaining amount for that schedule. Canceled records are excluded (P4).
 */
export function scheduleFulfillment(f: Formula, scheduleId: string, scheduledAmount: number) {
  const matched = (f.records ?? []).filter((r) => !r.canceled && r.scheduleId === scheduleId)
  const matchedTotal = matched.reduce((s, r) => s + r.amount, 0)
  return { matchedTotal, remaining: Math.max(0, scheduledAmount - matchedTotal), count: matched.length }
}

/* ---------------- Invoice amount verification (P0-1/P0-3) ---------------- */

export type InvoiceVerification = {
  status: InvoiceStatus
  expectedAmount: number
  externalAmount: number | null
  /** externalAmount − expectedAmount; null while pending. */
  delta: number | null
  matched: boolean
  /** True when this invoice blocks close (pending or amount mismatch). */
  blocksClose: boolean
}

/**
 * System-derived per-invoice status. Verification is computed by comparing the
 * external invoice amount with the expected amount — it is never user-entered.
 * Authoritative verification runs in backend services after integration.
 */
export function deriveInvoiceStatus(inv: InvoiceRecord): InvoiceStatus {
  if (inv.canceled) return "canceled"
  if (inv.externalAmount == null) return "pending"
  return inv.externalAmount === inv.expectedAmount ? "amount_matched" : "amount_mismatched"
}

export function deriveInvoiceVerification(inv: InvoiceRecord): InvoiceVerification {
  const status = deriveInvoiceStatus(inv)
  const delta = inv.externalAmount == null ? null : inv.externalAmount - inv.expectedAmount
  return {
    status,
    expectedAmount: inv.expectedAmount,
    externalAmount: inv.externalAmount,
    delta,
    matched: status === "amount_matched",
    blocksClose: status === "pending" || status === "amount_mismatched",
  }
}

/**
 * Formula-level invoice close roll-up derived ONLY from invoice records
 * (canonical). Canceled invoices stay visible but never count toward matched.
 * Invoice is a Formula close condition, not a transaction blocker.
 */
export function deriveInvoiceClose(f: Formula) {
  const active = (f.invoices ?? []).filter((i) => !i.canceled)
  const matched = active.filter((i) => deriveInvoiceStatus(i) === "amount_matched")
  const blocking = active.length - matched.length
  return {
    done: active.length > 0 && blocking === 0,
    activeCount: active.length,
    matchedCount: matched.length,
    blocking,
    canceledCount: (f.invoices ?? []).length - active.length,
  }
}

/* ---------------- Chain ordering (P1-3) ---------------- */

/**
 * Single canonical chain-order accessor. `sequenceOrder` is the canonical key;
 * legacy `chainOrder` is only an internal fallback so older data keeps working.
 * Every chain surface (Participants tab, Overview chain) sorts by this so users
 * only ever see one ordering concept.
 */
export function chainOrderOf(p: { sequenceOrder?: number; chainOrder?: number }): number {
  return p.sequenceOrder ?? p.chainOrder ?? 0
}

/* ---------------- Timeline (P1-1) ---------------- */

export type TimelineEventType =
  | "created"
  | "contract"
  | "trade"
  | "schedule"
  | "status"
  | "receipt"
  | "payment"
  | "invoice"
  | "invoice_matched"
  | "logistics"
  | "delivery"
  | "version"
  | "settlement"
  | "closed"

/** Human labels for status-log values, keyed by status type (P0-2). */
const statusLogValueLabels: Record<string, Record<string, string>> = {
  trade: { draft: "Draft", confirmed: "Confirmed", completed: "Completed", canceled: "Canceled" },
  cashIn: { pending: "Pending", partial: "Partial", completed: "Completed", canceled: "Canceled" },
  cashOut: { pending: "Pending", partial: "Partial", completed: "Completed", canceled: "Canceled" },
  invoice: { unmatched: "Unmatched", partial: "Partial", complete: "Complete", canceled: "Canceled" },
  logistics: { not_started: "Not Started", in_transit: "In Transit", delivered: "Delivered", canceled: "Canceled" },
  delivery: { pending: "Pending", in_transit: "In Transit", delivered: "Delivered", canceled: "Canceled" },
}
const statusLogTypeLabels: Record<string, string> = {
  trade: "Trade",
  cashIn: "Cash In",
  cashOut: "Cash Out",
  invoice: "Invoice",
  logistics: "Logistics",
  delivery: "Delivery",
}
function statusLogValue(type: string, value: string | null): string {
  if (value == null) return "—"
  return statusLogValueLabels[type]?.[value] ?? value
}

export type DerivedTimelineEvent = {
  id: string
  type: TimelineEventType
  title: string
  description: string
  date: string
  actor: string
  /** Detail tab this event links to (P1-4). */
  linkTab?: string
}

/**
 * Builds the Formula timeline purely from Formula-derived data (P1-1). No event
 * is fabricated: each entry is emitted only when its underlying date/record
 * exists. Version events come from the mock version history helper (passed in to
 * avoid a mock-data import cycle). Events are returned in chronological order.
 */
export function buildTimeline(f: Formula, versions: VersionEntry[] = []): DerivedTimelineEvent[] {
  const ev: DerivedTimelineEvent[] = []

  if (f.createdAt)
    ev.push({
      id: "tl-created",
      type: "created",
      title: "Formula Created",
      description: `${f.number} · ${f.item}`,
      date: f.createdAt,
      actor: "System",
      linkTab: "overview",
    })
  if (f.contractDate)
    ev.push({
      id: "tl-contract",
      type: "contract",
      title: "Contract Date",
      description: "Contract date recorded for this Formula.",
      date: f.contractDate,
      actor: "System",
      linkTab: "overview",
    })
  if (f.tradeDate)
    ev.push({
      id: "tl-trade",
      type: "trade",
      title: "Trade Date",
      description: "Trade executed / goods transacted.",
      date: f.tradeDate,
      actor: "System",
      linkTab: "overview",
    })

  // Status history is PROJECTED from canonical Status Logs (P0-2) — never
  // fabricated. Each entry corresponds to a real formula_status_logs row.
  for (const log of f.statusLogs ?? []) {
    const typeLabel = statusLogTypeLabels[log.statusType] ?? log.statusType
    // §0.1: Timeline description must surface Reason (then Memo) when present.
    const transition = `${statusLogValue(log.statusType, log.previousStatus)} → ${statusLogValue(log.statusType, log.newStatus)}`
    const reasonPart = log.reason ? ` · Reason: ${log.reason}` : ""
    const memoPart = log.memo && log.memo !== log.reason ? ` · Memo: ${log.memo}` : ""
    ev.push({
      id: `tl-status-${log.id}`,
      type: "status",
      title: `${typeLabel} Status Changed`,
      description: `${transition}${reasonPart}${memoPart}`,
      date: log.changedAt,
      actor: log.changedBy,
      linkTab: log.statusType === "logistics" || log.statusType === "delivery" ? "logistics" : "overview",
    })
  }

  for (const s of f.schedule ?? []) {
    ev.push({
      id: `tl-sch-${s.id}`,
      type: "schedule",
      title: s.type === "receipt" ? "Receipt Scheduled" : "Payment Scheduled",
      description: `${s.counterparty} · ${formatCurrency(s.amount)}`,
      date: s.scheduledDate,
      actor: "System",
      linkTab: "payments",
    })
  }

  for (const r of f.records ?? []) {
    if (r.canceled) {
      ev.push({
        id: `tl-rec-${r.id}`,
        type: "settlement",
        title: "Settlement Adjustment",
        description: `Canceled ${r.type} · ${r.counterparty}${r.cancelReason ? ` — ${r.cancelReason}` : ""}`,
        date: r.paidDate,
        actor: "System",
        linkTab: "settlement",
      })
    } else {
      ev.push({
        id: `tl-rec-${r.id}`,
        type: r.type,
        title: r.type === "receipt" ? "Actual Receipt" : "Actual Payment",
        description: `${r.counterparty} · ${formatCurrency(r.amount)}`,
        date: r.paidDate,
        actor: "System",
        linkTab: "payments",
      })
    }
  }

  for (const inv of f.invoices ?? []) {
    if (inv.canceled) continue
    ev.push({
      id: `tl-inv-${inv.id}`,
      type: "invoice",
      title: "Invoice Issued",
      description: `${inv.number} · ${inv.counterparty}`,
      date: inv.date,
      actor: "System",
      linkTab: "invoices",
    })
    if (deriveInvoiceStatus(inv) === "amount_matched")
      ev.push({
        id: `tl-invm-${inv.id}`,
        type: "invoice_matched",
        title: "Invoice Matched",
        description: `${inv.number} amount verified (${formatCurrency(inv.expectedAmount)})`,
        date: inv.date,
        actor: "System",
        linkTab: "invoices",
      })
  }

  for (const leg of f.logistics ?? []) {
    if (leg.actualArrival)
      ev.push({
        id: `tl-log-${leg.id}`,
        type: "logistics",
        title: "Logistics Completed",
        description: `${leg.carrier} · ${leg.origin} → ${leg.destination}`,
        date: leg.actualArrival,
        actor: "System",
        linkTab: "logistics",
      })
    if (leg.actualDelivery)
      ev.push({
        id: `tl-del-${leg.id}`,
        type: "delivery",
        title: "Delivery Completed",
        description: `${leg.carrier} · delivered to ${leg.destination}`,
        date: leg.actualDelivery,
        actor: "System",
        linkTab: "logistics",
      })
  }

  for (const v of versions) {
    if (v.versionNo <= 1) continue
    ev.push({
      id: `tl-ver-${v.versionNo}`,
      type: "version",
      title: `Version v${v.versionNo}`,
      description: v.summary,
      date: v.createdAt,
      actor: v.createdBy,
      linkTab: "versions",
    })
  }

  if (f.closedAt)
    ev.push({
      id: "tl-closed",
      type: "closed",
      title: "Formula Closed",
      description: "All six close conditions met; Formula closed.",
      date: f.closedAt,
      actor: "System",
      linkTab: "settlement",
    })

  return ev.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

/* ---------------- Six-status model (P0-6) ---------------- */

export type StatusItem = {
  key: string
  label: string
  value: string
  /** Whether this status counts as complete for the close condition. */
  done: boolean
}

const cashLabel: Record<string, string> = {
  pending: "Pending",
  partial: "Partial",
  completed: "Completed",
  canceled: "Canceled",
}
const logisticsLabel: Record<string, string> = {
  not_started: "Not Started",
  in_transit: "In Transit",
  delivered: "Delivered",
  canceled: "Canceled",
}
const deliveryLabel: Record<string, string> = {
  pending: "Pending",
  in_transit: "In Transit",
  delivered: "Delivered",
  canceled: "Canceled",
}
const tradeLabel: Record<string, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  completed: "Completed",
  canceled: "Canceled",
}

/** True when the Formula has been canceled (preview or backend six CANCELED statuses). */
export function isFormulaCanceled(f: Formula): boolean {
  return Boolean(f.canceledAt)
}

/** The six canonical Formula statuses, in display order. */
export function sixStatuses(f: Formula): StatusItem[] {
  if (isFormulaCanceled(f)) {
    return [
      { key: "trade", label: "Trade", value: tradeLabel[f.tradeStatus] ?? "Canceled", done: false },
      { key: "cashIn", label: "Cash In", value: cashLabel[f.cashInStatus] ?? "Canceled", done: false },
      { key: "cashOut", label: "Cash Out", value: cashLabel[f.cashOutStatus] ?? "Canceled", done: false },
      { key: "invoice", label: "Invoice", value: "Canceled", done: false },
      { key: "logistics", label: "Logistics", value: logisticsLabel[f.logisticsStatus] ?? "Canceled", done: false },
      { key: "delivery", label: "Delivery", value: deliveryLabel[f.deliveryStatus] ?? "Canceled", done: false },
    ]
  }

  const inv = deriveInvoiceClose(f)
  const invoiceValue = inv.done
    ? "Matched"
    : inv.activeCount === 0
      ? "Missing"
      : `${inv.matchedCount}/${inv.activeCount} Matched`
  return [
    {
      key: "trade",
      label: "Trade",
      value: tradeLabel[f.tradeStatus] ?? f.tradeStatus,
      done: f.tradeStatus === "completed",
    },
    {
      key: "cashIn",
      label: "Cash In",
      value: cashLabel[f.cashInStatus] ?? f.cashInStatus,
      done: f.cashInStatus === "completed",
    },
    {
      key: "cashOut",
      label: "Cash Out",
      value: cashLabel[f.cashOutStatus] ?? f.cashOutStatus,
      done: f.cashOutStatus === "completed",
    },
    { key: "invoice", label: "Invoice", value: invoiceValue, done: inv.done },
    {
      key: "logistics",
      label: "Logistics",
      value: logisticsLabel[f.logisticsStatus] ?? f.logisticsStatus,
      done: f.logisticsStatus === "delivered",
    },
    {
      key: "delivery",
      label: "Delivery",
      value: deliveryLabel[f.deliveryStatus] ?? f.deliveryStatus,
      done: f.deliveryStatus === "delivered",
    },
  ]
}

/** Close condition (P0-6): a Formula is closeable only when all six match. */
export function isCloseable(f: Formula): boolean {
  if (isFormulaCanceled(f)) return false
  return sixStatuses(f).every((s) => s.done)
}

/* ---------------- FX preview (P0-7) — no engine, no persistence ---------------- */

export type FxPreview = {
  isCrossBorder: boolean
  transactionCurrency: string
  baseCurrency: string
  contractRate: number
  adjustedRate: number
  /** KRW-converted sell total using the contract rate (illustrative). */
  convertedSellTotal: number
  convertedBuyTotal: number
}

export function deriveFxPreview(f: Formula): FxPreview | null {
  if (f.tradeType === "domestic") return null
  const contractRate = f.contractExchangeRate ?? 0
  const adjustedRate = f.adjustedExchangeRate ?? contractRate
  return {
    isCrossBorder: true,
    transactionCurrency: f.transactionCurrency,
    baseCurrency: f.baseCurrency,
    contractRate,
    adjustedRate,
    convertedSellTotal: f.totalSell,
    convertedBuyTotal: f.totalBuy,
  }
}

/* ---------------- Analytical company perspective (P0-2) ---------------- */

/**
 * Per-node accessors (canonical fields, legacy aliases as fallback).
 */
const pQty = (p: { quantity?: number }) => p.quantity ?? 0
const pBuyUnit = (p: { buyUnitPrice?: number; buyPrice?: number }) => p.buyUnitPrice ?? p.buyPrice ?? 0
const pSellUnit = (p: { sellUnitPrice?: number; sellPrice?: number }) => p.sellUnitPrice ?? p.sellPrice ?? 0

/**
 * Maps every settlement counterparty NAME appearing in a formula to the
 * companyId of the participant with that name. Settlement rows (schedules /
 * records) reference counterparties by name; participants carry the stable
 * `companyId` (P0-1). This bridges the two so settlement can be scoped to a
 * selected analytical company.
 */
function counterpartyCompanyIndex(f: Formula): Map<string, string> {
  const index = new Map<string, string>()
  for (const p of f.participants) {
    if (p.companyId && !index.has(p.company)) index.set(p.company, p.companyId)
    if (p.companyId && !index.has(p.name)) index.set(p.name, p.companyId)
  }
  return index
}

/**
 * A formula's schedule items reinterpreted from a participant company's point of
 * view. The owning desk's `receipt` (it collects from the buyer) is the buyer's
 * `payment`; the desk's `payment` (it pays the supplier) is the supplier's
 * `receipt`. Only rows whose counterparty maps to `companyId` are returned.
 */
export function perspectiveScheduleItems(
  f: Formula,
  companyId: string,
): (PaymentScheduleItem & { perspectiveType: "receipt" | "payment" })[] {
  const index = counterpartyCompanyIndex(f)
  const out: (PaymentScheduleItem & { perspectiveType: "receipt" | "payment" })[] = []
  for (const s of f.schedule ?? []) {
    if (index.get(s.counterparty) !== companyId) continue
    out.push({ ...s, perspectiveType: s.type === "receipt" ? "payment" : "receipt" })
  }
  return out
}

export type PerspectiveMetrics = {
  companyId: string
  /** True when the company appears at least once as a Formula participant. */
  participates: boolean
  /** Value the company acquires within the chain (Σ buyUnit × qty over its legs). */
  totalBuy: number
  /** Value the company sells within the chain (Σ sellUnit × qty over its legs). */
  totalSell: number
  grossMargin: number
  /** Net trade position of the company's legs (Sell − Buy). */
  expectedProfit: number
  /** Recorded net cash for the company (inflows it received − outflows it paid). */
  realizedProfit: number
  /** Amount the company is still owed (its counterparty rows, unsettled). */
  receivable: number
  /** Amount the company still owes (its counterparty rows, unsettled). */
  payable: number
  loss: boolean
}

/**
 * Formula metrics from a single participant company's perspective (P0-2).
 *
 * Formula First: every figure derives from that company's participant legs and
 * from the settlement rows that reference it — never from stored owner totals.
 *
 *   Buy / Sell      = Σ over the company's legs of buyUnit×qty / sellUnit×qty
 *   Expected Profit = Sell − Buy  (a supplier shows net proceeds, a pure buyer a
 *                     net outlay, an intermediary its captured spread)
 *   Receivable      = unsettled schedule rows where the desk PAYS this company
 *   Payable         = unsettled schedule rows where the desk COLLECTS from it
 *   Realized Profit = actual records: payments received − receipts paid out
 *                     (non-canceled), scoped to this company by counterparty
 *   Loss            = realized net < 0 (consistent with the app's realized model)
 */
export function derivePerspectiveMetrics(f: Formula, companyId: string): PerspectiveMetrics {
  const legs = f.participants.filter((p) => p.companyId === companyId)
  const totalBuy = legs.reduce((s, p) => s + pBuyUnit(p) * pQty(p), 0)
  const totalSell = legs.reduce((s, p) => s + pSellUnit(p) * pQty(p), 0)
  const grossMargin = totalSell - totalBuy

  const index = counterpartyCompanyIndex(f)

  // Settlement scoped to this company (schedules → remaining amounts).
  let receivable = 0
  let payable = 0
  for (const s of f.schedule ?? []) {
    if (index.get(s.counterparty) !== companyId) continue
    const remaining = Math.max(0, s.amount - s.settledAmount)
    // Desk receipt = this company pays (payable); desk payment = it receives (receivable).
    if (s.type === "receipt") payable += remaining
    else receivable += remaining
  }

  // Realized net from actual (non-canceled) records scoped to this company.
  let realizedProfit = 0
  for (const r of f.records ?? []) {
    if (r.canceled || index.get(r.counterparty) !== companyId) continue
    // Desk payment to the company = its inflow; desk receipt from it = its outflow.
    realizedProfit += r.type === "payment" ? r.amount : -r.amount
  }

  return {
    companyId,
    participates: legs.length > 0,
    totalBuy,
    totalSell,
    grossMargin,
    expectedProfit: grossMargin,
    realizedProfit,
    receivable,
    payable,
    loss: realizedProfit < 0,
  }
}

/**
 * Normalized per-formula metrics used by BOTH the Dashboard and Reports (P0-4).
 *
 * When `analyticsCompanyId` is absent or equal to the operating scope, this is
 * the owner / whole-formula view (unchanged behavior). Otherwise it is the
 * selected company's participant perspective. Every analytics aggregate routes
 * through this single adapter so the two screens can never diverge.
 */
export type FormulaMetricsView = {
  perspective: boolean
  realizedProfit: number
  expectedProfit: number
  totalSell: number
  totalBuy: number
  receivable: number
  payable: number
}

export function isPerspective(operatingId: string, analyticsCompanyId?: string): boolean {
  return !!analyticsCompanyId && analyticsCompanyId !== operatingId
}

/* ---------------- Participant Confirmed KPI (P1 Feature 1) ---------------- */

/**
 * Per-participant confirmed cash KPI row — mirrors `v_participant_confirmed_kpi`
 * / `GET /api/v1/formulas/:formulaId/kpi/participants`. Confirmed figures derive
 * from ACTUAL (non-canceled) payment records, never from schedules. This is an
 * illustrative local preview; authoritative figures come from the backend view.
 */
export type ParticipantConfirmedKpiRow = {
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

/**
 * Derives one confirmed-KPI row per participant, sorted by chain order.
 *
 * Cash movements are matched to a participant by counterparty NAME (schedules /
 * records reference counterparties by name; participants carry the stable
 * companyId — the counterparty index bridges the two, falling back to the
 * participant's own company name). Definitions (desk-scoped, matching the view):
 *   confirmedIn/Out  — Σ non-canceled receipt / payment records for the party
 *   scheduledIn/Out  — Σ remaining scheduled receipt / payment for the party
 *   receivable/payable — remaining scheduled minus confirmed, per direction
 *   confirmedNetProfit = confirmedIn − confirmedOut
 */
export function deriveParticipantConfirmedKpi(f: Formula): ParticipantConfirmedKpiRow[] {
  const index = counterpartyCompanyIndex(f)
  const sorted = [...f.participants].sort((a, b) => chainOrderOf(a) - chainOrderOf(b))

  return sorted.map((p) => {
    const companyId = p.companyId ?? ""
    // A settlement counterparty belongs to this participant when its indexed
    // companyId matches, or (no companyId) when the raw name matches.
    const belongs = (counterparty: string): boolean =>
      companyId ? index.get(counterparty) === companyId : counterparty === p.company

    let confirmedIn = 0
    let confirmedOut = 0
    for (const r of f.records ?? []) {
      if (r.canceled || !belongs(r.counterparty)) continue
      if (r.type === "receipt") confirmedIn += r.amount
      else confirmedOut += r.amount
    }

    let scheduledIn = 0
    let scheduledOut = 0
    for (const s of f.schedule ?? []) {
      if (!belongs(s.counterparty)) continue
      const remaining = Math.max(0, s.amount - s.settledAmount)
      if (s.type === "receipt") scheduledIn += remaining
      else scheduledOut += remaining
    }

    const totalBuyAmount = pBuyUnit(p) * pQty(p)
    const totalSellAmount = pSellUnit(p) * pQty(p)

    return {
      formulaId: f.id,
      formulaNo: f.number,
      participantId: p.id,
      companyId,
      companyName: p.company,
      roleGroup: p.roleGroup ?? p.role ?? "other",
      sequenceOrder: chainOrderOf(p),
      totalBuyAmount,
      totalSellAmount,
      confirmedIn,
      confirmedOut,
      scheduledIn,
      scheduledOut,
      receivable: Math.max(0, scheduledIn - confirmedIn),
      payable: Math.max(0, scheduledOut - confirmedOut),
      confirmedNetProfit: confirmedIn - confirmedOut,
    }
  })
}

export function viewFormula(f: Formula, operatingId: string, analyticsCompanyId?: string): FormulaMetricsView {
  if (isPerspective(operatingId, analyticsCompanyId)) {
    const m = derivePerspectiveMetrics(f, analyticsCompanyId as string)
    return {
      perspective: true,
      realizedProfit: m.realizedProfit,
      expectedProfit: m.expectedProfit,
      totalSell: m.totalSell,
      totalBuy: m.totalBuy,
      receivable: m.receivable,
      payable: m.payable,
    }
  }
  const e = deriveExpected(f)
  const r = deriveRealized(f)
  const s = deriveSettlement(f)
  return {
    perspective: false,
    realizedProfit: r.realizedProfit,
    expectedProfit: e.expectedProfit,
    totalSell: e.totalSell,
    totalBuy: e.totalBuy,
    receivable: s.remainingReceivable,
    payable: s.remainingPayable,
  }
}
