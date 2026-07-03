import type { Formula, Participant } from "./types"
import { deriveRealized, deriveSettlement } from "./formula-math"

export type ChainFinancials = {
  expectedRevenue: number
  expectedCost: number
  grossMargin: number
  logisticsCost: number
  share: number
  expectedProfit: number
}

/** Canonical per-node accessors (new fields, with legacy aliases as fallback). */
const qtyOf = (p: Participant) => p.quantity ?? 0
const buyUnitOf = (p: Participant) => p.buyUnitPrice ?? p.buyPrice ?? 0
const sellUnitOf = (p: Participant) => p.sellUnitPrice ?? p.sellPrice ?? 0

/** Ordered, chain-positioned participants (A → B → C …). */
export function orderedChain(participants: Participant[]): Participant[] {
  const key = (p: Participant) => p.sequenceOrder ?? p.chainOrder ?? 0
  return [...participants]
    .filter((p) => p.sequenceOrder != null || p.chainOrder != null)
    .sort((a, b) => key(a) - key(b))
}

/**
 * Single source of truth for chain-derived financials.
 *
 * Revenue = what the end buyer pays  → participant flagged `isEnd`.
 * Cost    = what the origin is paid  → participant flagged `isStart`.
 * Margin  = the spread captured across the intermediary chain.
 *
 * Endpoints are resolved from EXPLICIT `isStart` / `isEnd` flags — never
 * inferred from `buyPrice === 0` / `sellPrice === 0` patterns. Returns null
 * when either endpoint is missing so callers can surface a warning instead of
 * silently inferring.
 */
export function deriveChainFinancials(
  participants: Participant[],
  opts: { logisticsCost?: number; share?: number } = {},
): ChainFinancials | null {
  const chain = orderedChain(participants)
  const starts = chain.filter((p) => p.isStart)
  const ends = chain.filter((p) => p.isEnd)
  if (starts.length === 0 || ends.length === 0) return null

  const expectedRevenue = ends.reduce((s, p) => s + buyUnitOf(p) * qtyOf(p), 0)
  const expectedCost = starts.reduce((s, p) => s + sellUnitOf(p) * qtyOf(p), 0)

  const grossMargin = expectedRevenue - expectedCost
  const logisticsCost = opts.logisticsCost ?? 0
  const share = opts.share ?? 0
  const expectedProfit = grossMargin - logisticsCost - share

  return { expectedRevenue, expectedCost, grossMargin, logisticsCost, share, expectedProfit }
}

export type EditSimInput = {
  quantity: number
  /** Final per-unit sell price (what the end buyer pays per unit). */
  sellUnitPrice: number
}

export type EditSimResult = {
  quantity: number
  sellUnitPrice: number
  buyUnitPrice: number
  /* Expected (trade definition) — recompute with the hypothetical edit. */
  totalSell: number
  totalBuy: number
  cost: number
  share: number
  expectedProfit: number
  /* Settlement — derived only from schedules & records (unaffected by edit). */
  scheduledReceipts: number
  actualReceipts: number
  receivable: number
  scheduledPayments: number
  actualPayments: number
  payable: number
  realizedProfit: number
  /** False when start/end endpoints are missing (cost falls back to stored total). */
  endpointsResolved: boolean
}

/**
 * Derives financials for a hypothetical Formula edit.
 *
 * Expected figures recompute against the edited quantity / sell price. The
 * per-unit BUY cost derives from the chain's start participant (`isStart`)
 * when endpoints are resolved; otherwise it falls back to the stored Total Buy
 * and `endpointsResolved` is false so the UI can warn. Settlement figures come
 * ONLY from schedules and records and are therefore unchanged by this preview
 * (they are shown for completeness, not coupled to Total Sell / Total Buy).
 * Pure/mock — nothing is persisted.
 */
export function simulateFormulaEdit(formula: Formula, input: EditSimInput): EditSimResult {
  const baseQty = formula.quantity || 1
  const chain = deriveChainFinancials(formula.participants, { logisticsCost: formula.cost, share: formula.share })
  const endpointsResolved = chain !== null
  const unitCost = (endpointsResolved ? chain.expectedCost : formula.totalBuy) / baseQty

  const totalSell = Math.round(input.sellUnitPrice * input.quantity)
  const totalBuy = Math.round(unitCost * input.quantity)
  const expectedProfit = totalSell - totalBuy - formula.cost - formula.share

  const settlement = deriveSettlement(formula)
  const realized = deriveRealized(formula)

  return {
    quantity: input.quantity,
    sellUnitPrice: input.sellUnitPrice,
    buyUnitPrice: Math.round(unitCost),
    totalSell,
    totalBuy,
    cost: formula.cost,
    share: formula.share,
    expectedProfit,
    scheduledReceipts: settlement.scheduledReceipts,
    actualReceipts: settlement.actualReceipts,
    receivable: settlement.remainingReceivable,
    scheduledPayments: settlement.scheduledPayments,
    actualPayments: settlement.actualPayments,
    payable: settlement.remainingPayable,
    realizedProfit: realized.realizedProfit,
    endpointsResolved,
  }
}
