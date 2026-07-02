import type { Formula, Participant } from "./types"

export type ChainFinancials = {
  expectedRevenue: number
  expectedCost: number
  grossMargin: number
  logisticsCost: number
  share: number
  expectedProfit: number
}

/** Ordered, chain-positioned participants (A → B → C …). */
export function orderedChain(participants: Participant[]): Participant[] {
  return [...participants]
    .filter((p) => p.chainOrder != null)
    .sort((a, b) => (a.chainOrder ?? 0) - (b.chainOrder ?? 0))
}

const sumBuy = (list: Participant[]) => list.reduce((s, p) => s + (p.buyPrice ?? 0) * (p.quantity ?? 0), 0)
const sumSell = (list: Participant[]) => list.reduce((s, p) => s + (p.sellPrice ?? 0) * (p.quantity ?? 0), 0)

/**
 * Single source of truth for chain-derived financials.
 *
 * Revenue  = what the end buyer pays (node that only buys).
 * Cost     = what the origin is paid (node that only sells).
 * Margin   = the spread captured across the intermediary chain.
 *
 * Every figure traces back to per-node quantity and buy/sell prices — there
 * are no independent financial inputs. Returns null when the chain is not
 * priced, so callers can fall back to stored (mock) totals.
 */
export function deriveChainFinancials(
  participants: Participant[],
  opts: { logisticsCost?: number; share?: number } = {},
): ChainFinancials | null {
  const chain = orderedChain(participants)
  const priced = chain.filter((p) => (p.buyPrice ?? 0) > 0 || (p.sellPrice ?? 0) > 0)
  if (priced.length < 2) return null

  const endBuyers = priced.filter((p) => (p.sellPrice ?? 0) === 0 && (p.buyPrice ?? 0) > 0)
  const origins = priced.filter((p) => (p.buyPrice ?? 0) === 0 && (p.sellPrice ?? 0) > 0)

  const expectedRevenue = endBuyers.length
    ? sumBuy(endBuyers)
    : Math.max(...priced.map((p) => (p.sellPrice ?? 0) * (p.quantity ?? 0)))
  const buyers = priced.filter((p) => (p.buyPrice ?? 0) > 0)
  const expectedCost = origins.length
    ? sumSell(origins)
    : buyers.length
      ? Math.min(...buyers.map((p) => (p.buyPrice ?? 0) * (p.quantity ?? 0)))
      : 0

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
  expectedRevenue: number
  expectedCost: number
  grossMargin: number
  expectedProfit: number
}

/**
 * Derives financials for a hypothetical Formula edit. Unit cost is held
 * constant (cost scales with quantity); revenue = new quantity × new sell
 * price. Logistics cost and share are carried over from the base formula.
 * Pure/mock — nothing is persisted.
 */
export function simulateFormulaEdit(formula: Formula, input: EditSimInput): EditSimResult {
  const baseQty = formula.quantity || 1
  const unitCost = formula.totalBuy / baseQty
  const expectedRevenue = Math.round(input.sellUnitPrice * input.quantity)
  const expectedCost = Math.round(unitCost * input.quantity)
  const grossMargin = expectedRevenue - expectedCost
  const expectedProfit = grossMargin - formula.cost - formula.share
  return {
    quantity: input.quantity,
    sellUnitPrice: input.sellUnitPrice,
    expectedRevenue,
    expectedCost,
    grossMargin,
    expectedProfit,
  }
}
