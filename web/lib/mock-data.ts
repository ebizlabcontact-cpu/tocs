import type {
  Company,
  Formula,
  FormulaStatus,
  TradeType,
  Kpi,
  Participant,
  PaymentScheduleItem,
  PaymentRecord,
  FormulaShare,
  CashProgress,
  RegisteredCompany,
  DateRange,
  CalendarEvent,
  VersionEntry,
} from "./types"
import { deriveChainFinancials } from "./derive"
import { isCloseable } from "./formula-math"

export const companies: Company[] = [
  { id: "all", name: "All Companies", shortName: "ALL", color: "#f59e0b" },
  { id: "c1", name: "Meridian Trading Co.", shortName: "MT", color: "#7c3aed" },
  { id: "c2", name: "Pacific Commodities Ltd.", shortName: "PC", color: "#3b82f6" },
  { id: "c3", name: "Northgate Resources", shortName: "NR", color: "#10b981" },
]

/** Registered trade companies — selectable as formula participants. */
export const registeredCompanies: RegisteredCompany[] = [
  {
    id: "rc1",
    name: "CJ CheilJedang",
    nature: "Manufacturer",
    status: "active",
    englishName: "CJ CheilJedang Corp.",
    country: "Korea",
    businessRegNo: "104-86-00121",
    corporateRegNo: "110111-0012345",
    taxType: "General",
    contactPerson: "Ji-woo Han",
    department: "Global Sourcing",
    position: "Manager",
    phone: "02-6740-1114",
    mobile: "010-2345-6789",
    email: "jiwoo.han@cj.example",
    zipCode: "04560",
    address: "330 Dongho-ro, Jung-gu, Seoul",
    addressDetail: "CJ Cheiljedang Center 12F",
    defaultCurrency: "KRW",
    memo: "Primary UCO supplier. ISCC-EU certified.",
    tags: ["ISCC", "Priority"],
    contacts: [
      { id: "ct1", name: "Ji-woo Han", department: "Global Sourcing", position: "Manager", email: "jiwoo.han@cj.example", mobile: "010-2345-6789", isPrimary: true },
      { id: "ct2", name: "Min-jun Seo", department: "Finance", position: "Accountant", email: "minjun.seo@cj.example" },
    ],
  },
  {
    id: "rc2",
    name: "GeoWorks",
    nature: "Distributor",
    status: "active",
    englishName: "GeoWorks Ltd.",
    country: "Vietnam",
    email: "trade@geoworks.example",
    defaultCurrency: "USD",
    tags: ["Import"],
  },
  { id: "rc3", name: "Nature Insight", nature: "Manufacturer", status: "active", country: "Malaysia", defaultCurrency: "USD" },
  { id: "rc4", name: "Eco & Recycle", nature: "Distributor", status: "active", country: "Korea", defaultCurrency: "KRW" },
  { id: "rc5", name: "Local Collector", nature: "Supplier", status: "active", country: "Korea", defaultCurrency: "KRW" },
  { id: "rc6", name: "Logistics Partner", nature: "Logistics", status: "active", country: "Korea", defaultCurrency: "KRW" },
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

const DAY = 86400000

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

const cashProgress = (actual: number, total: number): CashProgress =>
  actual >= total ? "completed" : actual > 0 ? "partial" : "pending"

/**
 * Builds the two-tier settlement (P0-5) for a formula: planned schedules and
 * actual records that are internally consistent. Realized figures derive from
 * the actual records, so nothing contradicts the Formula inputs.
 */
function buildSettlement(
  totalSell: number,
  totalBuy: number,
  receiptRatio: number,
  paymentRatio: number,
  receiptCp: string,
  paymentCp: string,
  daysAgo: number,
  rand: () => number,
) {
  const actualReceipts = Math.round(totalSell * receiptRatio)
  const actualPayments = Math.round(totalBuy * paymentRatio)
  const receivable = Math.max(0, totalSell - actualReceipts)
  const payable = Math.max(0, totalBuy - actualPayments)
  const now = Date.now()

  const schedule: PaymentScheduleItem[] = [
    {
      id: "s1",
      type: "receipt",
      counterparty: receiptCp,
      amount: totalSell,
      scheduledDate: new Date(now + 7 * DAY).toISOString(),
      dueDate: new Date(now + 7 * DAY).toISOString(),
      status: receivable === 0 ? "settled" : actualReceipts > 0 ? "partial" : "scheduled",
      settledAmount: actualReceipts,
    },
    {
      id: "s2",
      type: "payment",
      counterparty: paymentCp,
      amount: totalBuy,
      scheduledDate: new Date(now + 4 * DAY).toISOString(),
      dueDate: new Date(now + 4 * DAY).toISOString(),
      status:
        payable === 0
          ? "settled"
          : daysAgo > 25
            ? "overdue"
            : actualPayments > 0
              ? "partial"
              : "scheduled",
      settledAmount: actualPayments,
    },
  ]

  const records: PaymentRecord[] = []
  if (actualReceipts > 0) {
    records.push({
      id: "r1",
      type: "receipt",
      counterparty: receiptCp,
      amount: actualReceipts,
      paidDate: new Date(now - Math.round(daysAgo / 2) * DAY).toISOString(),
      scheduleId: "s1",
    })
  }
  if (actualPayments > 0) {
    records.push({
      id: "r2",
      type: "payment",
      counterparty: paymentCp,
      amount: actualPayments,
      paidDate: new Date(now - Math.round(daysAgo / 3) * DAY).toISOString(),
      scheduleId: "s2",
    })
  }
  // Occasionally include a canceled record so the two-tier UI shows the state.
  if (rand() < 0.18) {
    records.push({
      id: "rc",
      type: "receipt",
      counterparty: receiptCp,
      amount: Math.round(totalSell * 0.1),
      paidDate: new Date(now - daysAgo * DAY).toISOString(),
      canceled: true,
    })
  }

  return {
    actualReceipts,
    actualPayments,
    receivable,
    payable,
    schedule,
    records,
    cashInStatus: cashProgress(actualReceipts, totalSell),
    cashOutStatus: cashProgress(actualPayments, totalBuy),
  }
}

function buildFormula(i: number): Formula {
  const rand = rng(i * 131 + 7)
  const companyId = ["c1", "c2", "c3"][i % 3]
  const tradeItem = tradeItems[i % tradeItems.length]
  const item = tradeItem.name
  const tradeType = tradeTypes[i % tradeTypes.length]
  const quantity = 100 + (i % 9) * 50

  // ---- Priced participant chain (P0-3): origin → trader → buyer.
  // Every headline number derives from these per-unit prices (P0-15).
  const unitCost = 850000 + Math.round(rand() * 250000) // origin's per-unit proceeds
  const spread = 0.04 + rand() * 0.07
  const unitSell = Math.round(unitCost * (1 + spread)) // end buyer's per-unit payment

  const originCp = counterparties[i % counterparties.length]
  const traderCp = counterparties[(i + 2) % counterparties.length]
  const buyerCp = counterparties[(i + 4) % counterparties.length]

  const participants: Participant[] = [
    {
      id: "p1",
      sequenceOrder: 0,
      name: originCp,
      company: originCp,
      roleGroup: "supplier",
      natureGroup: "manufacturer",
      paymentGroup: "prepaid",
      quantity,
      buyUnitPrice: 0,
      sellUnitPrice: unitCost,
      isStart: true,
      isEnd: false,
      role: "seller",
      nature: "Manufacturer",
      chainOrder: 0,
      buyPrice: 0,
      sellPrice: unitCost,
    },
    {
      id: "p2",
      sequenceOrder: 1,
      name: traderCp,
      company: traderCp,
      roleGroup: "other",
      natureGroup: "trading",
      paymentGroup: "credit",
      quantity,
      buyUnitPrice: unitCost,
      sellUnitPrice: unitSell,
      isStart: false,
      isEnd: false,
      role: "agent",
      nature: "Trading Company",
      chainOrder: 1,
      buyPrice: unitCost,
      sellPrice: unitSell,
    },
    {
      id: "p3",
      sequenceOrder: 2,
      name: buyerCp,
      company: buyerCp,
      roleGroup: "buyer",
      natureGroup: "buyer",
      paymentGroup: "credit",
      quantity,
      buyUnitPrice: unitSell,
      sellUnitPrice: 0,
      isStart: false,
      isEnd: true,
      role: "buyer",
      nature: "Buyer",
      chainOrder: 2,
      buyPrice: unitSell,
      sellPrice: 0,
    },
  ]

  const derived = deriveChainFinancials(participants)!
  const totalSell = derived.expectedRevenue // = unitSell × qty
  const totalBuy = derived.expectedCost // = unitCost × qty
  const grossMargin = totalSell - totalBuy
  const cost = Math.round(totalSell * (0.02 + rand() * 0.03)) // logistics / other costs
  const share = Math.round(grossMargin * (0.05 + rand() * 0.15))
  const expectedProfit = totalSell - totalBuy - cost - share

  // ---- Two-tier settlement, derived from the same totals.
  const daysAgo = Math.floor(rand() * 40)
  const receiptRatio = 0.4 + rand() * 0.6
  const paymentRatio = 0.4 + rand() * 0.6
  const settle = buildSettlement(totalSell, totalBuy, receiptRatio, paymentRatio, buyerCp, originCp, daysAgo, rand)
  const realizedProfit = settle.actualReceipts - settle.actualPayments
  const isLoss = realizedProfit < 0

  // ---- Six-status model (P0-6).
  const invoiceStatus = rand() < 0.3 ? "unmatched" : rand() < 0.6 ? "partial" : "complete"
  const logisticsRoll = rand()
  const logisticsStatus = logisticsRoll < 0.4 ? "in_transit" : logisticsRoll < 0.75 ? "delivered" : "not_started"
  const deliveryStatus =
    logisticsStatus === "delivered" ? "delivered" : logisticsStatus === "in_transit" ? "in_transit" : "pending"
  const tradeStatus =
    settle.cashInStatus === "completed" && settle.cashOutStatus === "completed"
      ? "completed"
      : rand() < 0.12
        ? "draft"
        : "confirmed"

  // ---- Shares as a Formula concept (P0-4): split across the intermediaries.
  const shares: FormulaShare[] = []
  if (share > 0) {
    shares.push({ id: "sh1", companyName: traderCp, amount: Math.round(share * 0.6), note: "Trading margin share" })
    shares.push({ id: "sh2", companyName: originCp, amount: share - Math.round(share * 0.6), note: "Sourcing share" })
  }

  // ---- Dates (P0-2).
  const createdDaysAgo = daysAgo + 20 + Math.floor(rand() * 60)
  const createdAt = new Date(Date.now() - createdDaysAgo * DAY).toISOString()
  const updatedAt = new Date(Date.now() - daysAgo * DAY).toISOString()
  const tradeDate = new Date(Date.now() - (createdDaysAgo + 2) * DAY).toISOString()
  const contractDate = new Date(Date.now() - (createdDaysAgo + 1) * DAY).toISOString()

  // ---- FX (P0-7): domestic is KRW-only; cross-border carries a preview rate.
  const crossBorder = tradeType !== "domestic"
  const contractExchangeRate = crossBorder ? 1310 + Math.round(rand() * 60) : undefined
  const adjustedExchangeRate = crossBorder
    ? (contractExchangeRate ?? 0) + Math.round(rand() * 30) - 15
    : undefined

  const number = `F-${2026}-${String(1000 + i).padStart(4, "0")}`

  const base: Formula = {
    id: `f${i}`,
    number,
    companyId,
    item,
    specMemo: tradeItem.memo,
    tradeType,
    quantity,
    unit: "MT",
    participants,
    baseCurrency: "KRW",
    transactionCurrency: crossBorder ? "USD" : "KRW",
    contractExchangeRate,
    adjustedExchangeRate,
    totalSell,
    totalBuy,
    cost,
    share,
    expectedProfit,
    shares,
    realizedProfit,
    actualReceipts: settle.actualReceipts,
    actualPayments: settle.actualPayments,
    receivable: settle.receivable,
    payable: settle.payable,
    schedule: settle.schedule,
    records: settle.records,
    tradeStatus,
    cashInStatus: settle.cashInStatus,
    cashOutStatus: settle.cashOutStatus,
    invoiceStatus,
    logisticsStatus,
    deliveryStatus,
    isClosed: false,
    status: "active",
    closeable: false,
    tradeDate,
    contractDate,
    createdAt,
    updatedAt,
    version: 1 + Math.floor(rand() * 4),
    invoices: [
      {
        id: "iv1",
        number: `INV-${9000 + i}`,
        direction: "issued",
        counterparty: buyerCp,
        amount: Math.round(totalSell * 0.5),
        status: invoiceStatus === "unmatched" ? "unmatched" : "matched",
        date: updatedAt,
      },
      {
        id: "iv2",
        number: `INV-${9500 + i}`,
        direction: "received",
        counterparty: originCp,
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
        eta: new Date(Date.now() + (10 + i) * DAY).toISOString(),
      },
    ],
    timeline: [
      { id: "t1", type: "created", title: "Formula created", description: `${number} initialized for ${item}`, date: createdAt, actor: "Sarah Kim" },
      {
        id: "t2",
        type: "logistics",
        title: "Shipment booked",
        description: "Sea freight booked with Logistics Partner",
        date: new Date(Date.parse(createdAt) + 3 * DAY).toISOString(),
        actor: "Logistics Bot",
        linkTab: "logistics",
      },
      {
        id: "t3",
        type: "invoice",
        title: "Invoice issued",
        description: `INV-${9000 + i} issued to ${buyerCp}`,
        date: new Date(Date.parse(createdAt) + 8 * DAY).toISOString(),
        actor: "Sarah Kim",
        linkTab: "invoices",
      },
      { id: "t4", type: "receipt", title: "Receipt recorded", description: `Partial receipt from ${buyerCp}`, date: updatedAt, actor: "Finance Team", linkTab: "payments" },
    ],
  }

  return finalizeFormula(base, { isLoss, daysAgo })
}

/**
 * Derives the close condition (all six statuses matched), the lifecycle summary
 * status used for filtering, and the attention message — all from the canonical
 * Formula fields, so the derived views never contradict Formula data.
 */
function finalizeFormula(f: Formula, ctx: { isLoss: boolean; daysAgo: number }): Formula {
  const closeable = isCloseable(f) // all six statuses matched
  const isClosed = closeable && f.receivable === 0 && f.payable === 0

  let status: FormulaStatus
  if (ctx.isLoss) status = "loss"
  else if (isClosed) status = "closed"
  else if (closeable) status = "closeable"
  else if (f.logisticsStatus === "in_transit") status = "in_transit"
  else if (f.invoiceStatus !== "complete") status = "invoicing"
  else status = "active"

  let attention: string | undefined
  if (ctx.isLoss) attention = "Realized profit is negative — review pricing and settlement."
  else if (f.invoiceStatus === "unmatched") attention = "Invoice unmatched — 1 document needs reconciliation."
  else if (f.payable > 0 && ctx.daysAgo > 25) attention = "Payment overdue — counterparty settlement pending."

  return {
    ...f,
    closeable: closeable && !isClosed,
    isClosed,
    status,
    attention,
    closedAt: isClosed ? new Date(Date.now() - Math.max(1, ctx.daysAgo) * DAY).toISOString() : undefined,
  }
}

/**
 * Demonstration formula with a full A → B → C → D → E participant chain.
 * Manufacturer → Distributor → Trading Company → Logistics → Buyer.
 */
function buildChainFormula(): Formula {
  const base = buildFormula(7)
  const rand = rng(99)
  const createdAt = new Date(Date.now() - 54 * DAY).toISOString()
  const updatedAt = new Date(Date.now() - 2 * DAY).toISOString()

  const formulaQuantity = 500
  const participants: Participant[] = [
    { id: "cp1", sequenceOrder: 0, name: "CJ CheilJedang", company: "CJ CheilJedang", roleGroup: "supplier", natureGroup: "manufacturer", paymentGroup: "prepaid", quantity: 500, buyUnitPrice: 0, sellUnitPrice: 920000, isStart: true, isEnd: false, role: "seller", nature: "Manufacturer", chainOrder: 0, buyPrice: 0, sellPrice: 920000 },
    { id: "cp2", sequenceOrder: 1, name: "GeoWorks", company: "GeoWorks", roleGroup: "other", natureGroup: "distributor", paymentGroup: "credit", quantity: 500, buyUnitPrice: 920000, sellUnitPrice: 948000, isStart: false, isEnd: false, role: "agent", nature: "Distributor", chainOrder: 1, buyPrice: 920000, sellPrice: 948000 },
    { id: "cp3", sequenceOrder: 2, name: "Nature Insight", company: "Nature Insight", roleGroup: "other", natureGroup: "trading", paymentGroup: "credit", quantity: 300, buyUnitPrice: 948000, sellUnitPrice: 985000, isStart: false, isEnd: false, role: "agent", nature: "Trading Company", chainOrder: 2, buyPrice: 948000, sellPrice: 985000 },
    { id: "cp4", sequenceOrder: 3, name: "Logistics Partner", company: "Logistics Partner", roleGroup: "carrier", natureGroup: "logistics", paymentGroup: "postpaid", quantity: 500, buyUnitPrice: 985000, sellUnitPrice: 992000, isStart: false, isEnd: false, role: "logistics", nature: "Logistics Company", chainOrder: 3, buyPrice: 985000, sellPrice: 992000 },
    { id: "cp5", sequenceOrder: 4, name: "Eco & Recycle", company: "Eco & Recycle", roleGroup: "buyer", natureGroup: "buyer", paymentGroup: "credit", quantity: 500, buyUnitPrice: 992000, sellUnitPrice: 0, isStart: false, isEnd: true, role: "buyer", nature: "Buyer", chainOrder: 4, buyPrice: 992000, sellPrice: 0 },
  ]

  const logisticsCost = 3000000
  const shareAmount = 5000000
  const derived = deriveChainFinancials(participants, { logisticsCost, share: shareAmount })!
  const totalSell = derived.expectedRevenue
  const totalBuy = derived.expectedCost
  const settle = buildSettlement(totalSell, totalBuy, 0.5, 0.45, "Eco & Recycle", "CJ CheilJedang", 2, rand)

  const shares: FormulaShare[] = [
    { id: "sh1", companyName: "Nature Insight", amount: 3000000, note: "Trading margin share" },
    { id: "sh2", companyName: "GeoWorks", amount: 2000000, note: "Distribution share" },
  ]

  const merged: Formula = {
    ...base,
    id: "f-chain",
    number: "F-2026-0900",
    companyId: "c1",
    item: "Used Cooking Oil",
    specMemo: "FFA ≤ 3.5%, Moisture ≤ 1%, ISCC-EU certified, multi-tier collection chain.",
    tradeType: "triangular",
    quantity: formulaQuantity,
    unit: "MT",
    baseCurrency: "KRW",
    transactionCurrency: "USD",
    contractExchangeRate: 1345,
    adjustedExchangeRate: 1352,
    createdAt,
    updatedAt,
    tradeDate: new Date(Date.now() - 56 * DAY).toISOString(),
    contractDate: new Date(Date.now() - 55 * DAY).toISOString(),
    version: 4,
    participants,
    totalSell,
    totalBuy,
    cost: logisticsCost,
    share: shareAmount,
    expectedProfit: derived.expectedProfit,
    shares,
    actualReceipts: settle.actualReceipts,
    actualPayments: settle.actualPayments,
    realizedProfit: settle.actualReceipts - settle.actualPayments,
    receivable: settle.receivable,
    payable: settle.payable,
    schedule: settle.schedule,
    records: settle.records,
    cashInStatus: settle.cashInStatus,
    cashOutStatus: settle.cashOutStatus,
    tradeStatus: "confirmed",
    invoiceStatus: "partial",
    logisticsStatus: "in_transit",
    deliveryStatus: "in_transit",
  }

  return finalizeFormula(merged, { isLoss: merged.realizedProfit < 0, daysAgo: 2 })
}

export const formulas: Formula[] = [
  buildChainFormula(),
  ...Array.from({ length: 26 }, (_, i) => buildFormula(i + 1)),
]

export function getFormulasByCompany(companyId: string): Formula[] {
  if (companyId === "all") return formulas
  return formulas.filter((f) => f.companyId === companyId)
}

/**
 * Companies that appear at least once inside the currently accessible Formula
 * set (i.e. the formulas visible under the given operating scope). This powers
 * the Dashboard / Reports analytical company filter — never the full company
 * master. Formula First: the option list is derived from Formula data.
 */
export function getAccessibleCompanies(operatingId: string): Company[] {
  const accessible = getFormulasByCompany(operatingId)
  const ids = new Set(accessible.map((f) => f.companyId))
  return companies.filter((c) => c.id !== "all" && ids.has(c.id))
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
  "Custom Range",
]

/**
 * Illustrative share of full-period totals attributable to each range. Used to
 * make dashboard figures visibly react to the selected period. This is a mock
 * scaling factor — clearly not real date filtering (P0-2).
 */
const rangeFactor: Record<DateRange, number> = {
  "Last 7 Days": 0.14,
  "Last 30 Days": 0.42,
  "This Month": 0.55,
  "Last Month": 0.47,
  "This Year": 1,
  "Custom Range": 0.42,
}

/** Illustrative share of full-period totals for a range (mock, matches dashboard). */
export function getRangeFactor(range: DateRange): number {
  return rangeFactor[range]
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
    "Custom Range": ["Week 1", "Week 2", "Week 3", "Week 4"],
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
      createdAt: new Date(Date.now() - dayOffset * DAY).toISOString(),
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
