import type {
  Company,
  Formula,
  FormulaStatus,
  TradeType,
  Kpi,
  RegisteredCompany,
  DateRange,
  CalendarEvent,
  VersionEntry,
} from "./types"

export const companies: Company[] = [
  { id: "all", name: "All Companies", shortName: "ALL", color: "#f59e0b" },
  { id: "c1", name: "Meridian Trading Co.", shortName: "MT", color: "#7c3aed" },
  { id: "c2", name: "Pacific Commodities Ltd.", shortName: "PC", color: "#3b82f6" },
  { id: "c3", name: "Northgate Resources", shortName: "NR", color: "#10b981" },
]

/** Registered trade companies — selectable as formula participants. */
export const registeredCompanies: RegisteredCompany[] = [
  { id: "rc1", name: "CJ CheilJedang", nature: "Manufacturer", status: "active" },
  { id: "rc2", name: "GeoWorks", nature: "Distributor", status: "active" },
  { id: "rc3", name: "Nature Insight", nature: "Manufacturer", status: "active" },
  { id: "rc4", name: "Eco & Recycle", nature: "Distributor", status: "active" },
  { id: "rc5", name: "Local Collector", nature: "Supplier", status: "active" },
  { id: "rc6", name: "Logistics Partner", nature: "Logistics", status: "active" },
]

const tradeItems: { name: string; memo: string }[] = [
  {
    name: "Used Cooking Oil",
    memo: "FFA ≤ 3.5%, Moisture ≤ 1%, Impurity ≤ 0.5%, ISCC eligible, Vietnam origin",
  },
  { name: "Residue", memo: "FFA 40–50%, Moisture ≤ 1.5%, IV ~55, refining residue" },
  { name: "Vegetable Oil", memo: "RBD grade, FFA ≤ 0.1%, IV ~110, Malaysia origin" },
  { name: "Glucose", memo: "DE 42, Moisture ~18%, pH 4.8, syrup form" },
]

const counterparties = registeredCompanies.map((c) => c.name)

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
  const tradeItem = tradeItems[i % tradeItems.length]
  const item = tradeItem.name
  const tradeType = tradeTypes[i % tradeTypes.length]

  // KRW-scale amounts (₩80M – ₩400M range).
  const totalSell = Math.round((80000000 + rand() * 320000000) / 1000000) * 1000000
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
    specMemo: tradeItem.memo,
    tradeType,
    participants: [
      { id: "p1", name: cp1, role: "seller", company: cp1, sharePct: 60 },
      { id: "p2", name: cp2, role: "buyer", company: cp2, sharePct: 40 },
      { id: "p3", name: "Logistics Partner", role: "logistics", company: "Logistics Partner" },
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
        description: `Sea freight booked with Logistics Partner`,
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

/**
 * Demonstration formula with a full A → B → C → D → E participant chain.
 * Manufacturer → Distributor → Trading Company → Logistics → Buyer.
 */
function buildChainFormula(): Formula {
  const base = buildFormula(7)
  const createdAt = new Date(Date.now() - 54 * 86400000).toISOString()
  const updatedAt = new Date(Date.now() - 2 * 86400000).toISOString()
  return {
    ...base,
    id: "f-chain",
    number: "F-2026-0900",
    companyId: "c1",
    item: "Used Cooking Oil",
    specMemo: "FFA ≤ 3.5%, Moisture ≤ 1%, ISCC-EU certified, multi-tier collection chain.",
    tradeType: "triangular",
    status: "active",
    createdAt,
    updatedAt,
    version: 4,
    participants: [
      { id: "cp1", name: "CJ CheilJedang", company: "CJ CheilJedang", role: "seller", nature: "Manufacturer", chainOrder: 0, quantity: 500, buyPrice: 0, sellPrice: 920000 },
      { id: "cp2", name: "GeoWorks", company: "GeoWorks", role: "agent", nature: "Distributor", chainOrder: 1, quantity: 500, buyPrice: 920000, sellPrice: 948000 },
      { id: "cp3", name: "Nature Insight", company: "Nature Insight", role: "agent", nature: "Trading Company", chainOrder: 2, quantity: 500, buyPrice: 948000, sellPrice: 985000 },
      { id: "cp4", name: "Logistics Partner", company: "Logistics Partner", role: "logistics", nature: "Logistics Company", chainOrder: 3, quantity: 500, buyPrice: 985000, sellPrice: 992000 },
      { id: "cp5", name: "Eco & Recycle", company: "Eco & Recycle", role: "buyer", nature: "Buyer", chainOrder: 4, quantity: 500, buyPrice: 992000, sellPrice: 0 },
    ],
  }
}

export const formulas: Formula[] = [
  buildChainFormula(),
  ...Array.from({ length: 26 }, (_, i) => buildFormula(i + 1)),
]

export function getFormulasByCompany(companyId: string): Formula[] {
  if (companyId === "all") return formulas
  return formulas.filter((f) => f.companyId === companyId)
}

export function getFormula(id: string): Formula | undefined {
  return formulas.find((f) => f.id === id)
}

export const DATE_RANGES: DateRange[] = [
  "Last 7 Days",
  "Last 30 Days",
  "This Month",
  "Last Month",
  "This Year",
]

/**
 * Mock share of full-year totals attributable to each range. Used to make
 * dashboard figures visibly react to the selected period (mock only).
 */
const rangeFactor: Record<DateRange, number> = {
  "Last 7 Days": 0.14,
  "Last 30 Days": 0.42,
  "This Month": 0.55,
  "Last Month": 0.47,
  "This Year": 1,
}

/** Dashboard KPIs — REALIZED profit only, never estimated. Reacts to date range (mock). */
export function getKpis(companyId: string, range: DateRange = "This Year"): Kpi[] {
  const list = getFormulasByCompany(companyId)
  const f = rangeFactor[range]
  const scale = (v: number) => Math.round(v * f)
  const scaleCount = (n: number) => (n === 0 ? 0 : Math.max(1, Math.round(n * f)))

  const realizedProfit = scale(list.filter((x) => x.realizedProfit > 0).reduce((s, x) => s + x.realizedProfit, 0))
  const totalLoss = scale(list.filter((x) => x.realizedProfit < 0).reduce((s, x) => s + x.realizedProfit, 0))
  const receivable = scale(list.reduce((s, x) => s + x.receivable, 0))
  const payable = scale(list.reduce((s, x) => s + x.payable, 0))
  const upcomingReceipts = scale(
    list
      .flatMap((x) => x.schedule)
      .filter((s) => s.type === "receipt" && s.status !== "settled")
      .reduce((s, x) => s + (x.amount - x.settledAmount), 0),
  )
  const upcomingPayments = scale(
    list
      .flatMap((x) => x.schedule)
      .filter((s) => s.type === "payment" && s.status !== "settled")
      .reduce((s, x) => s + (x.amount - x.settledAmount), 0),
  )
  const closeable = scaleCount(list.filter((x) => x.closeable).length)
  const unmatched = scaleCount(list.filter((x) => x.invoiceStatus === "unmatched").length)

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

/**
 * Realized-profit trend series. The number of buckets and their labels change
 * with the selected range so the chart visibly reacts (mock only).
 */
export function getProfitSeries(companyId: string, range: DateRange = "This Year") {
  const list = getFormulasByCompany(companyId)
  const total = list.reduce((s, f) => s + f.realizedProfit, 0)
  const seed = companyId.length * 17 + 3

  const buckets: Record<DateRange, string[]> = {
    "Last 7 Days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    "Last 30 Days": ["Week 1", "Week 2", "Week 3", "Week 4"],
    "This Month": ["Week 1", "Week 2", "Week 3", "Week 4"],
    "Last Month": ["Week 1", "Week 2", "Week 3", "Week 4"],
    "This Year": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  }
  const labels = buckets[range]
  const base = (total * rangeFactor[range]) / labels.length
  return labels.map((label, i) => {
    const wobble = 0.55 + (((i * 131 + seed) % 100) / 100) * 0.9
    return { month: label, profit: Math.round(base * wobble) }
  })
}

/** All scheduled receipts/payments across formulas, for the calendar grid. */
export function getCalendarEvents(companyId: string, flow?: "receipt" | "payment"): CalendarEvent[] {
  return getFormulasByCompany(companyId)
    .flatMap((f) =>
      f.schedule.map((s) => ({
        id: `${f.id}-${s.id}`,
        formula: f.number,
        formulaId: f.id,
        item: f.item,
        flow: s.type,
        amount: s.amount - s.settledAmount,
        dueDate: s.dueDate,
        status: s.status,
      })),
    )
    .filter((e) => (flow ? e.flow === flow : true))
    .sort((a, b) => Date.parse(a.dueDate) - Date.parse(b.dueDate))
}

const versionAuthors = ["Sarah Kim", "David Park", "Finance Team", "Jenny Lee", "Ops Desk"]

/**
 * Deterministic mock version history for a formula. Newest first.
 * No diff engine — change entries are illustrative sample data.
 */
export function getVersionHistory(formula: Formula): VersionEntry[] {
  const count = Math.max(1, formula.version)
  const changeSets: VersionEntry["changes"][] = [
    [
      { label: "Sell Unit Price", from: "₩980,000", to: "₩992,000" },
      { label: "Payment Schedule", note: "Receipt date moved +7 days" },
    ],
    [
      { label: "Quantity", from: "500 MT", to: "480 MT" },
      { label: "Participant Added", note: "Nature Insight (Trading Company)" },
    ],
    [
      { label: "Buy Unit Price", from: "₩950,000", to: "₩948,000" },
      { label: "Logistics", note: "Mode changed to Sea freight" },
    ],
    [{ label: "Formula created", note: "Initial draft" }],
  ]
  const summaries = ["Pricing revised", "Participants & quantity updated", "Sourcing terms adjusted", "Initial draft created"]

  return Array.from({ length: count }, (_, i) => {
    const versionNo = count - i
    const dayOffset = i === 0 ? 2 : 8 + i * 12
    const idx = Math.min(i, changeSets.length - 1)
    return {
      versionNo,
      createdAt: new Date(Date.now() - dayOffset * 86400000).toISOString(),
      createdBy: versionAuthors[(versionNo + formula.id.length) % versionAuthors.length],
      summary: summaries[idx],
      changes: changeSets[idx],
    }
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
