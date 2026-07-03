import type { Formula } from "./types"

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
 * Scheduled receipts/payments equal Total Sell / Total Buy in a well-formed
 * Formula, so these reconcile with the canonical Expected figures.
 */
export function deriveSettlement(f: Formula): SettlementDerivation {
  const scheduledReceipts = f.schedule.filter((s) => s.type === "receipt").reduce((s, x) => s + x.amount, 0)
  const scheduledPayments = f.schedule.filter((s) => s.type === "payment").reduce((s, x) => s + x.amount, 0)
  const { actualReceipts, actualPayments } = deriveRealized(f)
  const canceled = (f.records ?? []).filter((r) => r.canceled)
  const receiptBase = scheduledReceipts || f.totalSell
  const paymentBase = scheduledPayments || f.totalBuy
  return {
    scheduledReceipts,
    scheduledPayments,
    actualReceipts,
    actualPayments,
    canceledCount: canceled.length,
    canceledAmount: canceled.reduce((s, r) => s + r.amount, 0),
    remainingReceivable: Math.max(0, receiptBase - actualReceipts),
    remainingPayable: Math.max(0, paymentBase - actualPayments),
    receiptRate: receiptBase > 0 ? actualReceipts / receiptBase : 0,
    paymentRate: paymentBase > 0 ? actualPayments / paymentBase : 0,
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
const invoiceLabel: Record<string, string> = {
  unmatched: "Unmatched",
  partial: "Partial",
  complete: "Matched",
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
  return [
    { key: "trade", label: "Trade", value: tradeLabel[f.tradeStatus], done: f.tradeStatus === "completed" },
    { key: "cashIn", label: "Cash In", value: cashLabel[f.cashInStatus], done: f.cashInStatus === "completed" },
    { key: "cashOut", label: "Cash Out", value: cashLabel[f.cashOutStatus], done: f.cashOutStatus === "completed" },
    { key: "invoice", label: "Invoice", value: invoiceLabel[f.invoiceStatus], done: f.invoiceStatus === "complete" },
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
