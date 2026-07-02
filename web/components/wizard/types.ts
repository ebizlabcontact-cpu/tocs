import type { TradeType } from "@/lib/types"

export type WizardLine = {
  id: string
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
  startPoint: string
  endPoint: string
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
  specs: Record<string, string>
  quantity: number
  unit: string
  memo: string
  participants: WizardParticipant[]
  lines: WizardLine[]
  costs: WizardCost[]
  sharePct: number
  schedule: WizardScheduleItem[]
  logistics: WizardLogisticsLeg[]
  notes: string
}

export const emptyWizardState: WizardState = {
  companyId: "c1",
  itemId: "",
  item: "",
  tradeType: "import",
  specs: {},
  quantity: 0,
  unit: "MT",
  memo: "",
  participants: [
    {
      id: "p1",
      company: "",
      roleGroup: "seller",
      natureGroup: "purchase",
      paymentGroup: "lc",
      startPoint: "",
      endPoint: "",
      sharePct: 60,
    },
  ],
  lines: [{ id: "l1", description: "", buyUnitPrice: 0, sellUnitPrice: 0, quantity: 0, directCost: 0 }],
  costs: [{ id: "co1", label: "Freight", amount: 0 }],
  sharePct: 100,
  schedule: [],
  logistics: [],
  notes: "",
}

/* Formula-specific option groups for the trade chain (Step 2). */
export const roleGroupOptions = [
  { value: "buyer", label: "Buyer" },
  { value: "seller", label: "Seller" },
  { value: "intermediary", label: "Intermediary" },
  { value: "agent", label: "Agent" },
  { value: "logistics", label: "Logistics" },
  { value: "financier", label: "Financier" },
]

export const natureGroupOptions = [
  { value: "purchase", label: "Purchase" },
  { value: "sale", label: "Sale" },
  { value: "commission", label: "Commission" },
  { value: "service", label: "Service" },
  { value: "transit", label: "Transit" },
]

export const paymentGroupOptions = [
  { value: "prepaid", label: "Prepaid" },
  { value: "on_delivery", label: "On Delivery" },
  { value: "credit_30", label: "Credit 30d" },
  { value: "credit_60", label: "Credit 60d" },
  { value: "lc", label: "Letter of Credit" },
  { value: "open_account", label: "Open Account" },
]
