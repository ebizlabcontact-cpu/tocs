import type { TradeType } from "@/lib/types"

export type WizardCost = {
  id: string
  label: string
  amount: number
}

/**
 * A node in the trade chain. Roles are formula-specific and selected
 * per row — there are no fixed Buyer/Seller/Carrier top-level fields.
 * Pricing (quantity/buy/sell) lives on the node so the commercial chain
 * and its economics are a single Formula-derived structure.
 */
export type WizardParticipant = {
  id: string
  company: string
  roleGroup: string
  natureGroup: string
  paymentGroup: string
  /** Units moving through this node. */
  quantity: number
  /** Price this node pays to acquire. */
  buyPrice: number
  /** Price this node charges downstream. */
  sellPrice: number
  /** Chain start point toggle. */
  startPoint: boolean
  /** Chain end point toggle. */
  endPoint: boolean
}

export type WizardScheduleItem = {
  id: string
  type: "receipt" | "payment"
  counterparty: string
  amount: number
  dueDate: string
}

export type WizardLogisticsLeg = {
  id: string
  mode: "sea" | "air" | "land"
  origin: string
  destination: string
  eta: string
}

export type WizardState = {
  companyId: string
  itemId: string
  item: string
  tradeType: TradeType
  quantity: number
  unit: string
  /** Free-text spec / quality memo (Step 1). No structured spec fields. */
  specMemo: string
  /** Internal memo (Step 1). */
  internalMemo: string
  participants: WizardParticipant[]
  costs: WizardCost[]
  sharePct: number
  schedule: WizardScheduleItem[]
  logistics: WizardLogisticsLeg[]
}

/**
 * Single derivation of every headline figure from the Formula draft.
 * All wizard views (live summary, trade chain, settlement, review) read
 * from this so numbers always trace back to Formula inputs.
 */
export function deriveFormula(state: WizardState) {
  const expectedRevenue = state.participants.reduce((s, p) => s + (p.sellPrice || 0) * (p.quantity || 0), 0)
  const expectedCost = state.participants.reduce((s, p) => s + (p.buyPrice || 0) * (p.quantity || 0), 0)
  const costs = state.costs.reduce((s, c) => s + (c.amount || 0), 0)
  const grossMargin = expectedRevenue - expectedCost - costs
  const retainedShare = (grossMargin * state.sharePct) / 100
  const expectedProfit = retainedShare
  const totalQuantity = state.participants.reduce((s, p) => s + (p.quantity || 0), 0)
  const participantCount = state.participants.filter((p) => p.company.trim().length > 0).length
  return {
    expectedRevenue,
    expectedCost,
    costs,
    grossMargin,
    retainedShare,
    expectedProfit,
    totalQuantity,
    participantCount,
    expectedReceipts: expectedRevenue,
    expectedPayments: expectedCost + costs,
  }
}

export const emptyWizardState: WizardState = {
  companyId: "c1",
  itemId: "",
  item: "",
  tradeType: "import",
  quantity: 0,
  unit: "MT",
  specMemo: "",
  internalMemo: "",
  participants: [
    {
      id: "p1",
      company: "",
      roleGroup: "supplier",
      natureGroup: "manufacturer",
      paymentGroup: "prepaid",
      quantity: 0,
      buyPrice: 0,
      sellPrice: 0,
      startPoint: true,
      endPoint: false,
    },
  ],
  costs: [{ id: "co1", label: "Freight", amount: 0 }],
  sharePct: 100,
  schedule: [],
  logistics: [],
}

/* Formula-specific option groups for the trade chain (Step 2). */
export const roleGroupOptions = [
  { value: "supplier", label: "Supplier" },
  { value: "buyer", label: "Buyer" },
  { value: "carrier", label: "Carrier" },
  { value: "financial", label: "Financial" },
  { value: "other", label: "Other" },
]

export const natureGroupOptions = [
  { value: "manufacturer", label: "Manufacturer" },
  { value: "distributor", label: "Distributor" },
  { value: "trading", label: "Trading Company" },
  { value: "logistics", label: "Logistics Company" },
  { value: "buyer", label: "Buyer" },
  { value: "other", label: "Other" },
]

export const paymentGroupOptions = [
  { value: "prepaid", label: "Prepaid" },
  { value: "credit", label: "Credit" },
  { value: "postpaid", label: "Postpaid" },
]
