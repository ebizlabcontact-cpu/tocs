import type { TradeType } from "@/lib/types"

export type WizardLine = {
  id: string
  description: string
  sell: number
  buy: number
}

export type WizardCost = {
  id: string
  label: string
  amount: number
}

export type WizardParticipant = {
  id: string
  name: string
  role: "buyer" | "seller" | "agent" | "logistics" | "financier"
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
  item: string
  tradeType: TradeType
  reference: string
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
  item: "",
  tradeType: "import",
  reference: "",
  participants: [{ id: "p1", name: "", role: "seller", sharePct: 60 }],
  lines: [{ id: "l1", description: "", sell: 0, buy: 0 }],
  costs: [{ id: "co1", label: "Freight", amount: 0 }],
  sharePct: 100,
  schedule: [],
  logistics: [],
  notes: "",
}
