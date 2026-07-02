import type { TradeType } from "@/lib/types"

/** A pricing line is tied to a company in the participant chain. */
export type WizardLine = {
  id: string
  company: string
  description: string
  buyUnitPrice: number
  sellUnitPrice: number
  quantity: number
  directCost: number
}

export type WizardCost = {
  id: string
  label: string
  amount: number
}

/**
 * A node in the trade chain. Roles are formula-specific and selected
 * per row — there are no fixed Buyer/Seller/Carrier top-level fields.
 */
export type WizardParticipant = {
  id: string
  company: string
  roleGroup: string
  natureGroup: string
  paymentGroup: string
  /** Chain start point toggle. */
  startPoint: boolean
  /** Chain end point toggle. */
  endPoint: boolean
  sharePct: number
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
  lines: WizardLine[]
  costs: WizardCost[]
  sharePct: number
  schedule: WizardScheduleItem[]
  logistics: WizardLogisticsLeg[]
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
      startPoint: true,
      endPoint: false,
      sharePct: 60,
    },
  ],
  lines: [
    { id: "l1", company: "", description: "", buyUnitPrice: 0, sellUnitPrice: 0, quantity: 0, directCost: 0 },
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
  { value: "logistics", label: "Logistics" },
  { value: "financial", label: "Financial" },
  { value: "other", label: "Other" },
]

export const paymentGroupOptions = [
  { value: "prepaid", label: "Prepaid" },
  { value: "credit", label: "Credit" },
  { value: "postpaid", label: "Postpaid" },
]
