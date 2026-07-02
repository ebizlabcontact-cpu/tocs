export type Company = {
  id: string
  name: string
  shortName: string
  color: string
}

/**
 * A registered trade company. Selectable as a participant in a formula.
 * Company role is formula-specific, so nature here is only a default hint.
 */
export type RegisteredCompany = {
  id: string
  name: string
  nature: string
  status: "active" | "inactive"
}

export type FormulaStatus =
  | "draft"
  | "active"
  | "in_transit"
  | "invoicing"
  | "closeable"
  | "closed"
  | "loss"

export type TradeType = "import" | "export" | "domestic" | "triangular"

export type Participant = {
  id: string
  name: string
  role: "buyer" | "seller" | "agent" | "logistics" | "financier"
  company: string
  sharePct?: number
}

export type PaymentScheduleItem = {
  id: string
  type: "receipt" | "payment"
  counterparty: string
  amount: number
  dueDate: string
  status: "scheduled" | "partial" | "settled" | "overdue"
  settledAmount: number
}

export type InvoiceRecord = {
  id: string
  number: string
  direction: "issued" | "received"
  counterparty: string
  amount: number
  status: "matched" | "unmatched" | "pending"
  date: string
}

export type LogisticsLeg = {
  id: string
  mode: "sea" | "air" | "land"
  origin: string
  destination: string
  status: "booked" | "in_transit" | "arrived" | "cleared"
  eta: string
}

export type TimelineEvent = {
  id: string
  type: "created" | "receipt" | "payment" | "invoice" | "logistics" | "version" | "note" | "share"
  title: string
  description: string
  date: string
  actor: string
  linkTab?: string
}

export type Formula = {
  id: string
  number: string
  companyId: string
  item: string
  specMemo: string
  tradeType: TradeType
  participants: Participant[]
  totalSell: number
  totalBuy: number
  cost: number
  share: number
  expectedProfit: number
  realizedProfit: number
  actualReceipts: number
  actualPayments: number
  receivable: number
  payable: number
  status: FormulaStatus
  invoiceStatus: "complete" | "partial" | "unmatched"
  logisticsStatus: "not_started" | "in_transit" | "delivered"
  closeable: boolean
  attention?: string
  updatedAt: string
  createdAt: string
  version: number
  schedule: PaymentScheduleItem[]
  invoices: InvoiceRecord[]
  logistics: LogisticsLeg[]
  timeline: TimelineEvent[]
}

export type Kpi = {
  key: string
  label: string
  value: number
  currency?: boolean
  count?: boolean
  delta?: number
  intent: "neutral" | "success" | "warning" | "danger" | "info"
  drillTo: string
}
