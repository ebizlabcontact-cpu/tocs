import type { Company, Formula, FormulaStatus, TradeType, Kpi } from "./types"

export const companies: Company[] = [
  { id: "all", name: "All Companies", shortName: "ALL", color: "#f59e0b" },
  { id: "c1", name: "Meridian Trading Co.", shortName: "MT", color: "#7c3aed" },
  { id: "c2", name: "Pacific Commodities Ltd.", shortName: "PC", color: "#3b82f6" },
  { id: "c3", name: "Northgate Resources", shortName: "NR", color: "#10b981" },
]

const items = [
  "HR Steel Coil",
  "Copper Cathode",
  "Polypropylene Resin",
  "Aluminium Ingot",
  "Zinc Concentrate",
  "Naphtha",
  "Soybean Meal",
  "Cotton Yarn",
  "Nickel Briquette",
  "Base Oil SN500",
]

const counterparties = [
  "Hansol Metals",
  "Orient Steel",
  "Delta Chemicals",
  "Kobe Alloys",
  "Sunrise Grains",
  "Anglobe Freight",
  "Maritime Logistics",
  "Vertex Capital",
  "Blue Ocean Corp",
  "Everline Traders",
]

const tradeTypes: TradeType[] = ["import", "export", "domestic", "triangular"]

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

function buildFormula(i: number): Formula {
  const rand = rng(i * 131 + 7)
  const companyId = ["c1", "c2", "c3"][i % 3]
  const item = items[i % items.length]
  const tradeType = tradeTypes[i % tradeTypes.length]

  const totalSell = Math.round((800000 + rand() * 3200000) / 1000) * 1000
  const totalBuy = Math.round(totalSell * (0.72 + rand() * 0.2))
  const cost = Math.round(totalSell * (0.02 + rand() * 0.05))
  const share = Math.round(totalSell * (0.01 + rand() * 0.03))
  const expectedProfit = totalSell - totalBuy - cost - share

  const receiptRatio = 0.4 + rand() * 0.6
  const paymentRatio = 0.4 + rand() * 0.6
  const actualReceipts = Math.round(totalSell * receiptRatio)
  const actualPayments = Math.round(totalBuy * paymentRatio)
  const realizedProfit = actualReceipts - actualPayments

  const receivable = Math.max(0, totalSell - actualReceipts)
  const payable = Math.max(0, totalBuy - actualPayments)

  const isLoss = realizedProfit < 0
  let status: FormulaStatus
  const roll = rand()
  if (isLoss) status = "loss"
  else if (receivable === 0 && payable === 0) status = "closeable"
  else if (roll < 0.25) status = "in_transit"
  else if (roll < 0.5) status = "invoicing"
  else if (roll < 0.85) status = "active"
  else status = "closeable"

  const closeable = status === "closeable"
  const invoiceStatus = rand() < 0.3 ? "unmatched" : rand() < 0.6 ? "partial" : "complete"
  const logisticsStatus = rand() < 0.4 ? "in_transit" : rand() < 0.7 ? "delivered" : "not_started"

  const daysAgo = Math.floor(rand() * 40)
  const createdDaysAgo = daysAgo + 20 + Math.floor(rand() * 60)
  const updatedAt = new Date(Date.now() - daysAgo * 86400000).toISOString()
  const createdAt = new Date(Date.now() - createdDaysAgo * 86400000).toISOString()

  const cp1 = counterparties[i % counterparties.length]
  const cp2 = counterparties[(i + 3) % counterparties.length]

  let attention: string | undefined
  if (isLoss) attention = "Realized profit is negative — review pricing and settlement."
  else if (invoiceStatus === "unmatched") attention = "Invoice unmatched — 1 document needs reconciliation."
  else if (payable > 0 && daysAgo > 25) attention = "Payment overdue — counterparty settlement pending."

  const number = `F-${2026}-${String(1000 + i).padStart(4, "0")}`

  return {
    id: `f${i}`,
    number,
    companyId,
    item,
    tradeType,
    participants: [
      { id: "p1", name: cp1, role: "seller", company: cp1, sharePct: 60 },
      { id: "p2", name: cp2, role: "buyer", company: cp2, sharePct: 40 },
      { id: "p3", name: "Anglobe Freight", role: "logistics", company: "Anglobe Freight" },
    ],
    totalSell,
    totalBuy,
    cost,
    share,
    expectedProfit,
    realizedProfit,
    actualReceipts,
    actualPayments,
    receivable,
    payable,
    status,
    invoiceStatus,
    logisticsStatus,
    closeable,
    attention,
    updatedAt,
    createdAt,
    version: 1 + Math.floor(rand() * 4),
    schedule: [
      {
        id: "s1",
        type: "receipt",
        counterparty: cp2,
        amount: Math.round(totalSell * 0.5),
        dueDate: new Date(Date.now() + (5 + i) * 86400000).toISOString(),
        status: receivable > 0 ? "scheduled" : "settled",
        settledAmount: receivable > 0 ? 0 : Math.round(totalSell * 0.5),
      },
      {
        id: "s2",
        type: "payment",
        counterparty: cp1,
        amount: Math.round(totalBuy * 0.5),
        dueDate: new Date(Date.now() + (3 + i) * 86400000).toISOString(),
        status: payable > 0 ? (daysAgo > 25 ? "overdue" : "scheduled") : "settled",
        settledAmount: payable > 0 ? 0 : Math.round(totalBuy * 0.5),
      },
    ],
    invoices: [
      {
        id: "iv1",
        number: `INV-${9000 + i}`,
        direction: "issued",
        counterparty: cp2,
        amount: Math.round(totalSell * 0.5),
        status: invoiceStatus === "unmatched" ? "unmatched" : "matched",
        date: updatedAt,
      },
      {
        id: "iv2",
        number: `INV-${9500 + i}`,
        direction: "received",
        counterparty: cp1,
        amount: Math.round(totalBuy * 0.5),
        status: "matched",
        date: createdAt,
      },
    ],
    logistics: [
      {
        id: "lg1",
        mode: tradeType === "domestic" ? "land" : "sea",
        origin: tradeType === "export" ? "Busan, KR" : "Shanghai, CN",
        destination: tradeType === "export" ? "Rotterdam, NL" : "Busan, KR",
        status: logisticsStatus === "delivered" ? "cleared" : logisticsStatus === "in_transit" ? "in_transit" : "booked",
        eta: new Date(Date.now() + (10 + i) * 86400000).toISOString(),
      },
    ],
    timeline: [
      {
        id: "t1",
        type: "created",
        title: "Formula created",
        description: `${number} initialized for ${item}`,
        date: createdAt,
        actor: "Sarah Kim",
      },
      {
        id: "t2",
        type: "logistics",
        title: "Shipment booked",
        description: `Sea freight booked with Anglobe Freight`,
        date: new Date(Date.parse(createdAt) + 3 * 86400000).toISOString(),
        actor: "Logistics Bot",
        linkTab: "logistics",
      },
      {
        id: "t3",
        type: "invoice",
        title: "Invoice issued",
        description: `INV-${9000 + i} issued to ${cp2}`,
        date: new Date(Date.parse(createdAt) + 8 * 86400000).toISOString(),
        actor: "Sarah Kim",
        linkTab: "invoices",
      },
      {
        id: "t4",
        type: "receipt",
        title: "Receipt recorded",
        description: `Partial receipt from ${cp2}`,
        date: updatedAt,
        actor: "Finance Team",
        linkTab: "payments",
      },
    ],
  }
}

export const formulas: Formula[] = Array.from({ length: 26 }, (_, i) => buildFormula(i + 1))

export function getFormulasByCompany(companyId: string): Formula[] {
  if (companyId === "all") return formulas
  return formulas.filter((f) => f.companyId === companyId)
}

export function getFormula(id: string): Formula | undefined {
  return formulas.find((f) => f.id === id)
}

/** Dashboard KPIs — REALIZED profit only, never estimated. */
export function getKpis(companyId: string): Kpi[] {
  const list = getFormulasByCompany(companyId)
  const realizedProfit = list.filter((f) => f.realizedProfit > 0).reduce((s, f) => s + f.realizedProfit, 0)
  const totalLoss = list.filter((f) => f.realizedProfit < 0).reduce((s, f) => s + f.realizedProfit, 0)
  const receivable = list.reduce((s, f) => s + f.receivable, 0)
  const payable = list.reduce((s, f) => s + f.payable, 0)
  const upcomingReceipts = list
    .flatMap((f) => f.schedule)
    .filter((s) => s.type === "receipt" && s.status !== "settled")
    .reduce((s, x) => s + (x.amount - x.settledAmount), 0)
  const upcomingPayments = list
    .flatMap((f) => f.schedule)
    .filter((s) => s.type === "payment" && s.status !== "settled")
    .reduce((s, x) => s + (x.amount - x.settledAmount), 0)
  const closeable = list.filter((f) => f.closeable).length
  const unmatched = list.filter((f) => f.invoiceStatus === "unmatched").length

  return [
    { key: "realized", label: "Realized Profit", value: realizedProfit, currency: true, delta: 12.4, intent: "success", drillTo: "/formulas?filter=profit" },
    { key: "loss", label: "Total Loss", value: totalLoss, currency: true, delta: -4.1, intent: "danger", drillTo: "/formulas?filter=loss" },
    { key: "receivable", label: "Accounts Receivable", value: receivable, currency: true, intent: "info", drillTo: "/formulas?filter=receivable" },
    { key: "payable", label: "Accounts Payable", value: payable, currency: true, intent: "warning", drillTo: "/formulas?filter=payable" },
    { key: "up-receipts", label: "Upcoming Receipts", value: upcomingReceipts, currency: true, intent: "info", drillTo: "/calendar?type=receipt" },
    { key: "up-payments", label: "Upcoming Payments", value: upcomingPayments, currency: true, intent: "warning", drillTo: "/calendar?type=payment" },
    { key: "closeable", label: "Closeable Formulas", value: closeable, count: true, intent: "success", drillTo: "/formulas?filter=closeable" },
    { key: "unmatched", label: "Invoice Unmatched", value: unmatched, count: true, intent: "danger", drillTo: "/formulas?filter=unmatched" },
  ]
}

export function getMonthlyRealizedProfit(companyId: string) {
  const list = getFormulasByCompany(companyId)
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const now = new Date().getMonth()
  const base = list.reduce((s, f) => s + f.realizedProfit, 0) / 8
  return Array.from({ length: 8 }, (_, i) => {
    const m = (now - 7 + i + 12) % 12
    const factor = 0.6 + ((i * 131 + companyId.length * 17) % 100) / 100
    return { month: months[m], profit: Math.round(base * factor) }
  })
}

export function getLossRanking(companyId: string) {
  return getFormulasByCompany(companyId)
    .filter((f) => f.realizedProfit < 0)
    .sort((a, b) => a.realizedProfit - b.realizedProfit)
    .slice(0, 5)
}

export function getCashflowTimeline(companyId: string, type: "receipt" | "payment") {
  return getFormulasByCompany(companyId)
    .flatMap((f) => f.schedule.map((s) => ({ ...s, formula: f.number, item: f.item })))
    .filter((s) => s.type === type && s.status !== "settled")
    .sort((a, b) => Date.parse(a.dueDate) - Date.parse(b.dueDate))
    .slice(0, 6)
}
