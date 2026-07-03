import type { Formula, InvoiceRecord, InvoiceStatus, VersionEntry } from "./types"
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

export function deriveExpected(f: Formula): ExpectedDerivation {
  const grossMargin = f.totalSell - f.totalBuy
  const expectedProfit = grossMargin - f.cost - f.share
  return {
    totalSell: f.totalSell,
    totalBuy: f.totalBuy,
    cost: f.cost,
    share: f.share,
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
  const active = (f.records ?? []).filter((r) => !r.canceled)
  if (active.length === 0) {
    return {
      actualReceipts: f.actualReceipts,
      actualPayments: f.actualPayments,
      realizedProfit: f.actualReceipts - f.actualPayments,
    }
  }
  const actualReceipts = active.filter((r) => r.type === "receipt").reduce((s, r) => s + r.amount, 0)
  const actualPayments = active.filter((r) => r.type === "payment").reduce((s, r) => s + r.amount, 0)
  return { actualReceipts, actualPayments, realizedProfit: actualReceipts - actualPayments }
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
  | "receipt"
  | "payment"
  | "invoice"
  | "invoice_matched"
  | "logistics"
  | "delivery"
  | "version"
  | "settlement"
  | "closed"

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

  for (const s of f.schedule ?? []) {
    ev.push({
      id: `tl-sch-${s.id}`,
      type: "schedule",
      title: s.type === "receipt" ? "Receipt Scheduled" : "Payment Scheduled",
      description: `${s.counterparty} · ${formatCurrency(s.amount)}`,
      date: s.scheduledDate ?? s.dueDate,
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
}
const logisticsLabel: Record<string, string> = {
  not_started: "Not Started",
  in_transit: "In Transit",
  delivered: "Delivered",
}
const deliveryLabel: Record<string, string> = {
  pending: "Pending",
  in_transit: "In Transit",
  delivered: "Delivered",
}
const tradeLabel: Record<string, string> = {
  draft: "Draft",
  confirmed: "Confirmed",
  completed: "Completed",
}

/** The six canonical Formula statuses, in display order. */
export function sixStatuses(f: Formula): StatusItem[] {
  const inv = deriveInvoiceClose(f)
  const invoiceValue = inv.done
    ? "Matched"
    : inv.activeCount === 0
      ? "Missing"
      : `${inv.matchedCount}/${inv.activeCount} Matched`
  return [
    { key: "trade", label: "Trade", value: tradeLabel[f.tradeStatus], done: f.tradeStatus === "completed" },
    { key: "cashIn", label: "Cash In", value: cashLabel[f.cashInStatus], done: f.cashInStatus === "completed" },
    { key: "cashOut", label: "Cash Out", value: cashLabel[f.cashOutStatus], done: f.cashOutStatus === "completed" },
    { key: "invoice", label: "Invoice", value: invoiceValue, done: inv.done },
    { key: "logistics", label: "Logistics", value: logisticsLabel[f.logisticsStatus], done: f.logisticsStatus === "delivered" },
    { key: "delivery", label: "Delivery", value: deliveryLabel[f.deliveryStatus], done: f.deliveryStatus === "delivered" },
  ]
}

/** Close condition (P0-6): a Formula is closeable only when all six match. */
export function isCloseable(f: Formula): boolean {
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
