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
  LogisticsVehicle,
  StatusLog,
  CalculationSnapshot,
} from "./types"
import { DATE_RANGE_IDS } from "./date-range-labels"
import { deriveChainFinancials } from "./derive"
import {
  isCloseable,
  deriveExpected,
  isPerspective,
  viewFormula,
  perspectiveScheduleItems,
} from "./formula-math"

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
      {
        id: "ct1",
        name: "Ji-woo Han",
        title: "Global Sourcing Manager",
        email: "jiwoo.han@cj.example",
        phone: "02-6740-1234",
        branchAddress: "CJ Cheiljedang Center 12F, Seoul",
        isPrimary: true,
        isActive: true,
        memo: "Primary sourcing contact",
      },
      {
        id: "ct2",
        name: "Min-jun Seo",
        title: "Finance Accountant",
        email: "minjun.seo@cj.example",
        phone: "02-6740-1288",
        isPrimary: false,
        isActive: true,
      },
      {
        id: "ct3",
        name: "Hae-won Cho",
        title: "Former Logistics Lead",
        email: "haewon.cho@cj.example",
        isPrimary: false,
        isActive: false,
        memo: "Left the desk — kept for history",
      },
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
    contacts: [
      {
        id: "ct4",
        name: "Thanh Nguyen",
        title: "Trade Desk Lead",
        email: "thanh.nguyen@geoworks.example",
        phone: "+84-28-3822-0000",
        branchAddress: "District 1, Ho Chi Minh City",
        isPrimary: true,
        isActive: true,
      },
    ],
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

/**
 * Stable company identity for a participant (P0-1). Every participant used in
 * Formula analytics resolves to a registered company id via its name, so a
 * company can be analyzed from its own perspective even when it is only ever a
 * participant (never a formula owner).
 */
const registeredIdByName = new Map(registeredCompanies.map((c) => [c.name, c.id]))
const companyIdForParticipant = (name: string): string | undefined => registeredIdByName.get(name)

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
      status: receivable === 0 ? "settled" : actualReceipts > 0 ? "partial" : "scheduled",
      settledAmount: actualReceipts,
    },
    {
      id: "s2",
      type: "payment",
      counterparty: paymentCp,
      amount: totalBuy,
      scheduledDate: new Date(now + 4 * DAY).toISOString(),
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
      scheduleId: "s1",
      canceled: true,
      cancelReason: "Duplicate entry — reversed by finance",
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

/**
 * Vehicles linked to a logistics leg (mirrors Prisma LogisticsVehicle). Separate
 * canonical records keyed by `logisticsId` — never flat fields on the leg. Uses
 * only Prisma columns (vehicleNo/driverName/transportStatus/settlementStatus/memo);
 * there is no free-text "vehicle type" column (P0-5).
 */
function buildVehicles(logisticsId: string, mode: "sea" | "air" | "land", seed: number): LogisticsVehicle[] {
  if (mode === "sea")
    return [
      {
        id: `${logisticsId}-v1`,
        logisticsId,
        vehicleNo: `MSKU${7000000 + seed}`,
        transportStatus: "in_progress",
        settlementStatus: "pending",
        memo: "40ft HC container · seal verified",
      },
      {
        id: `${logisticsId}-v2`,
        logisticsId,
        vehicleNo: `Vessel Ever Grace ${100 + (seed % 40)}E`,
        transportStatus: "in_progress",
        settlementStatus: "pending",
      },
    ]
  if (mode === "air")
    return [
      {
        id: `${logisticsId}-v1`,
        logisticsId,
        vehicleNo: `AWB-180-${4000 + seed}`,
        transportStatus: "completed",
        settlementStatus: "completed",
        memo: "Air ULD · perishable handling",
      },
    ]
  return [
    {
      id: `${logisticsId}-v1`,
      logisticsId,
      vehicleNo: `${12 + (seed % 80)}가 ${1000 + seed}`,
      driverName: "김기사",
      driverPhone: "010-0000-0000",
      transportStatus: "completed",
      settlementStatus: "completed",
      memo: "5t cargo truck",
    },
  ]
}

/**
 * Status-change history (P0-2), the canonical SOURCE the Timeline projects.
 * Entries are emitted only for statuses that have actually progressed past their
 * initial value, so no history is fabricated.
 */
function buildStatusLogs(
  formulaId: string,
  s: {
    tradeStatus: string
    cashInStatus: string
    cashOutStatus: string
    logisticsStatus: string
    deliveryStatus: string
  },
  dates: { createdAt: string; tradeDate: string; updatedAt: string },
): StatusLog[] {
  const logs: StatusLog[] = []
  const push = (
    statusType: StatusLog["statusType"],
    previousStatus: string | null,
    newStatus: string,
    changedAt: string,
    changedBy: string,
    memo?: string,
  ) => logs.push({ id: `${formulaId}-sl${logs.length + 1}`, formulaId, statusType, previousStatus, newStatus, changedAt, changedBy, memo })

  if (s.tradeStatus !== "draft")
    push("trade", "draft", s.tradeStatus, dates.tradeDate, "Sarah Kim", "Trade confirmed from draft")
  if (s.logisticsStatus !== "not_started")
    push("logistics", "not_started", s.logisticsStatus, dates.tradeDate, "Logistics Bot")
  if (s.deliveryStatus !== "pending")
    push("delivery", "pending", s.deliveryStatus, dates.updatedAt, "Ops Desk")
  if (s.cashInStatus !== "pending")
    push("cashIn", "pending", s.cashInStatus, dates.updatedAt, "Finance Team")
  if (s.cashOutStatus !== "pending")
    push("cashOut", "pending", s.cashOutStatus, dates.updatedAt, "Finance Team")

  return logs.sort((a, b) => Date.parse(a.changedAt) - Date.parse(b.changedAt))
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
      companyId: companyIdForParticipant(originCp),
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
      companyId: companyIdForParticipant(traderCp),
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
      companyId: companyIdForParticipant(buyerCp),
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

  // ---- Dates (P0-2). Anchor on the recent trade so default ranges have data:
  // the trade happened `daysAgo` (0–40) ago; contract precedes it, the record is
  // created around the trade, and the last update is the most recent event.
  const tradeDaysAgo = daysAgo
  // Canonical business dates are date-only (YYYY-MM-DD); audit stamps keep time.
  const tradeDate = new Date(Date.now() - tradeDaysAgo * DAY).toISOString().slice(0, 10)
  const contractDate = new Date(Date.now() - (tradeDaysAgo + 3 + Math.floor(rand() * 5)) * DAY)
    .toISOString()
    .slice(0, 10)
  const createdAt = new Date(Date.now() - (tradeDaysAgo + 1) * DAY).toISOString()
  const updatedAt = new Date(Date.now() - Math.floor(tradeDaysAgo / 2) * DAY).toISOString()

  // ---- FX (P0-7): domestic is KRW-only; cross-border carries a preview rate.
  const crossBorder = tradeType !== "domestic"
  const contractExchangeRate = crossBorder ? 1310 + Math.round(rand() * 60) : undefined
  const adjustedExchangeRate = crossBorder
    ? (contractExchangeRate ?? 0) + Math.round(rand() * 30) - 15
    : undefined

  // Canonical formula number format FM-YYMM-NNNNN (P1-3). Derived from the trade
  // date's year/month; the frontend never owns authoritative numbering — this
  // mirrors the backend generate_formula_no() format for display only.
  const numDate = new Date(tradeDate)
  const yymm = `${String(numDate.getFullYear()).slice(-2)}${String(numDate.getMonth() + 1).padStart(2, "0")}`
  const number = `FM-${yymm}-${String(i + 1).padStart(5, "0")}`

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
    latestVersionNo: 1 + Math.floor(rand() * 4),
    // Invoice expected amounts trace to Formula sell/buy totals (P0-2). The
    // external amount matches expected for "complete", is null (pending) for
    // "partial", and diverges for "unmatched" — always traceable.
    invoices: [
      {
        id: "iv1",
        number: `INV-${9000 + i}`,
        direction: "issued",
        counterparty: buyerCp,
        expectedAmount: totalSell,
        externalAmount:
          invoiceStatus === "complete"
            ? totalSell
            : invoiceStatus === "partial"
              ? totalSell
              : totalSell + Math.round(totalSell * 0.04),
        dueDate: new Date(Date.now() + (7 + (i % 10)) * DAY).toISOString(),
        date: updatedAt,
      },
      {
        id: "iv2",
        number: `INV-${9500 + i}`,
        direction: "received",
        counterparty: originCp,
        expectedAmount: totalBuy,
        externalAmount: invoiceStatus === "partial" ? null : totalBuy,
        dueDate: new Date(Date.now() + (5 + (i % 8)) * DAY).toISOString(),
        date: createdAt,
      },
      // Canceled invoice example — stays visible, never counts as matched (P0-5).
      ...(rand() < 0.3
        ? [
            {
              id: "iv3",
              number: `INV-${9900 + i}`,
              direction: "issued" as const,
              counterparty: buyerCp,
              expectedAmount: Math.round(totalSell * 0.2),
              externalAmount: null,
              canceled: true,
              dueDate: new Date(Date.now() + (3 + (i % 6)) * DAY).toISOString(),
              date: updatedAt,
            },
          ]
        : []),
    ],
    logistics: [
      {
        id: "lg1",
        carrier: tradeType === "domestic" ? "Hanjin Transport" : "Maersk Line",
        mode: tradeType === "domestic" ? "land" : "sea",
        origin: tradeType === "export" ? "Busan, KR" : "Shanghai, CN",
        destination: tradeType === "export" ? "Rotterdam, NL" : "Busan, KR",
        status: logisticsStatus === "delivered" ? "cleared" : logisticsStatus === "in_transit" ? "in_transit" : "booked",
        eta: new Date(Date.now() + (10 + i) * DAY).toISOString(),
        // Actual dates only exist once the leg has progressed (illustrative).
        actualArrival:
          logisticsStatus === "delivered" ? new Date(Date.now() + (8 + i) * DAY).toISOString() : null,
        actualDelivery:
          deliveryStatus === "delivered" ? new Date(Date.now() + (9 + i) * DAY).toISOString() : null,
        // Leg cost derives from the Formula logistics cost.
        cost,
        costBearer: tradeType === "export" ? "Seller (FOB)" : "Buyer (CIF)",
      },
    ],
    vehicles: buildVehicles("lg1", tradeType === "domestic" ? "land" : "sea", i),
    statusLogs: buildStatusLogs(
      `f${i}`,
      {
        tradeStatus,
        cashInStatus: settle.cashInStatus,
        cashOutStatus: settle.cashOutStatus,
        logisticsStatus,
        deliveryStatus,
      },
      { createdAt, tradeDate, updatedAt },
    ),
    // No embedded timeline (P1-2) — it is derived via buildTimeline().
  }

  return finalizeFormula(base, { isLoss, daysAgo })
}

/**
 * Derives the close condition (all six statuses matched), the lifecycle summary
 * status used for filtering, and the attention message — all from the canonical
 * Formula fields, so the derived views never contradict Formula data.
 */
function finalizeFormula(f: Formula, ctx: { isLoss: boolean; daysAgo: number }): Formula {
  // Lifecycle: Open → Closeable → Closed (distinct states).
  // allComplete = all six statuses completed (the precondition for closing).
  // isClosed is the ONLY persisted close state — it represents a MANUAL final
  // approval by the user, never an automatic consequence of allComplete.
  // Receivable/payable are KPI metrics only and NEVER gate closing.
  const allComplete = isCloseable(f) // all six statuses matched
  // Mock persisted approval: some fully-complete formulas have been manually
  // closed (deterministic by seed) so both Closeable and Closed states exist.
  const isClosed = allComplete && ctx.daysAgo % 2 === 0
  // Derived, NOT persisted: ready to close but awaiting manual approval.
  const closeable = allComplete && !isClosed

  // Lifecycle stage ONLY (P1-2). Financial loss and logistics in-transit are
  // deliberately excluded — loss is surfaced via profit metrics/filters and
  // in-transit via `logisticsStatus`, so the lifecycle summary stays pure.
  let status: FormulaStatus
  if (isClosed) status = "closed"
  else if (closeable) status = "closeable"
  else if (f.invoiceStatus !== "complete") status = "invoicing"
  else status = "active"

  let attention: string | undefined
  if (ctx.isLoss) attention = "Realized profit is negative — review pricing and settlement."
  else if (f.invoiceStatus === "unmatched") attention = "Invoice unmatched — 1 document needs reconciliation."
  else if (f.payable > 0 && ctx.daysAgo > 25) attention = "Payment overdue — counterparty settlement pending."

  return {
    ...f,
    closeable,
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
    { id: "cp1", sequenceOrder: 0, companyId: companyIdForParticipant("CJ CheilJedang"), name: "CJ CheilJedang", company: "CJ CheilJedang", roleGroup: "supplier", natureGroup: "manufacturer", paymentGroup: "prepaid", quantity: 500, buyUnitPrice: 0, sellUnitPrice: 920000, isStart: true, isEnd: false, role: "seller", nature: "Manufacturer", chainOrder: 0, buyPrice: 0, sellPrice: 920000 },
    { id: "cp2", sequenceOrder: 1, companyId: companyIdForParticipant("GeoWorks"), name: "GeoWorks", company: "GeoWorks", roleGroup: "other", natureGroup: "distributor", paymentGroup: "credit", quantity: 500, buyUnitPrice: 920000, sellUnitPrice: 948000, isStart: false, isEnd: false, role: "agent", nature: "Distributor", chainOrder: 1, buyPrice: 920000, sellPrice: 948000 },
    { id: "cp3", sequenceOrder: 2, companyId: companyIdForParticipant("Nature Insight"), name: "Nature Insight", company: "Nature Insight", roleGroup: "other", natureGroup: "trading", paymentGroup: "credit", quantity: 300, buyUnitPrice: 948000, sellUnitPrice: 985000, isStart: false, isEnd: false, role: "agent", nature: "Trading Company", chainOrder: 2, buyPrice: 948000, sellPrice: 985000 },
    { id: "cp4", sequenceOrder: 3, companyId: companyIdForParticipant("Logistics Partner"), name: "Logistics Partner", company: "Logistics Partner", roleGroup: "carrier", natureGroup: "logistics", paymentGroup: "postpaid", quantity: 500, buyUnitPrice: 985000, sellUnitPrice: 992000, isStart: false, isEnd: false, role: "logistics", nature: "Logistics Company", chainOrder: 3, buyPrice: 985000, sellPrice: 992000 },
    { id: "cp5", sequenceOrder: 4, companyId: companyIdForParticipant("Eco & Recycle"), name: "Eco & Recycle", company: "Eco & Recycle", roleGroup: "buyer", natureGroup: "buyer", paymentGroup: "credit", quantity: 500, buyUnitPrice: 992000, sellUnitPrice: 0, isStart: false, isEnd: true, role: "buyer", nature: "Buyer", chainOrder: 4, buyPrice: 992000, sellPrice: 0 },
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
    number: "FM-2605-00900",
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
    tradeDate: new Date(Date.now() - 56 * DAY).toISOString().slice(0, 10),
    contractDate: new Date(Date.now() - 55 * DAY).toISOString().slice(0, 10),
    latestVersionNo: 4,
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
 * Analytical companies derivable from the currently accessible Formula set: the
 * distinct PARTICIPANT companies appearing inside the formulas visible under the
 * operating scope (P0-3) — never the owner companies and never the full company
 * master. A company that only ever participates (never owns a formula) is still
 * listed here, so it can be analyzed from its own perspective.
 */
export function getAccessibleCompanies(operatingId: string): Company[] {
  const accessible = getFormulasByCompany(operatingId)
  const ids = new Set<string>()
  for (const f of accessible) {
    for (const p of f.participants) {
      if (p.companyId) ids.add(p.companyId)
    }
  }
  return [...ids].map((id) => {
    const rc = registeredCompanies.find((c) => c.id === id)
    const name = rc?.name ?? id
    return {
      id,
      name,
      shortName: name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || name.slice(0, 2).toUpperCase(),
      color: "#64748b",
    }
  })
}

/**
 * Display name for an analytical company id (owner company OR participant
 * company). Owner ids resolve against the company master; participant ids
 * against the registered-company list.
 */
export function analyticsCompanyName(id: string): string {
  const owner = companies.find((c) => c.id === id)
  if (owner) return owner.name
  const rc = registeredCompanies.find((c) => c.id === id)
  return rc?.name ?? id
}

/**
 * The formula set an analytics view operates on (P0-4).
 *
 * "All in scope" (no analytical company, or it equals the operating scope) →
 * every formula owned under the operating scope. A selected analytical company →
 * only formulas in which that company actually participates. Perspective figures
 * are then produced per formula via `viewFormula` / `derivePerspectiveMetrics`.
 */
export function getAnalyticsFormulas(operatingId: string, analyticsCompanyId?: string): Formula[] {
  const base = getFormulasByCompany(operatingId)
  if (!isPerspective(operatingId, analyticsCompanyId)) return base
  return base.filter((f) => f.participants.some((p) => p.companyId === analyticsCompanyId))
}

export function getFormula(id: string): Formula | undefined {
  return formulas.find((f) => f.id === id)
}

export const DATE_RANGES: DateRange[] = [...DATE_RANGE_IDS]

/**
 * Real date-window resolution (P0-2). Every range maps to an actual [start, end)
 * interval, and formulas are filtered by their `tradeDate`. This mirrors how the
 * backend will bound aggregates by date — no scalar approximation.
 */
export function getRangeWindow(range: DateRange, customStart?: string, customEnd?: string): { start: number; end: number } {
  const now = new Date()
  const end = now.getTime()
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

  switch (range) {
    case "last_7_days":
      return { start: end - 7 * DAY, end }
    case "last_30_days":
      return { start: end - 30 * DAY, end }
    case "this_month":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1).getTime(), end }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime()
      const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
      return { start, end: monthEnd }
    }
    case "this_year":
      return { start: new Date(now.getFullYear(), 0, 1).getTime(), end }
    case "custom_range": {
      const s = customStart ? startOfDay(new Date(customStart)) : end - 30 * DAY
      const e = customEnd ? startOfDay(new Date(customEnd)) + DAY : end
      return { start: s, end: e }
    }
  }
}

/**
 * Filter a formula list to those falling inside the range window. Uses the
 * canonical business `tradeDate` as the authoritative basis (P0-1).
 */
export function filterFormulasByRange(
  list: Formula[],
  range: DateRange,
  customStart?: string,
  customEnd?: string,
): Formula[] {
  const { start, end } = getRangeWindow(range, customStart, customEnd)
  return list.filter((f) => {
    const t = Date.parse(f.tradeDate)
    return t >= start && t <= end
  })
}

/**
 * MOCK-PREVIEW ONLY (P0-5) — not production truth. Authoritative dashboard KPIs
 * come from backend views (kpi/confirmed → v_formula_confirmed_kpi, kpi/expected
 * → v_formula_profit_engine, receivable-payable, kpi/participants). This local
 * derivation exists only so the UI can render before integration.
 *
 * Dashboard KPIs — REALIZED profit only, never estimated. Filtered by real date
 * window (P0-2). When `analyticsCompanyId` selects a participant company, every
 * financial figure is that company's perspective (P0-2/P0-4): profit/loss from
 * its recorded cash, receivable/payable and upcoming flows from the settlement
 * rows that reference it. Operational counts (closeable, unmatched) stay
 * formula-level over the participating set. Drill-downs carry the active context
 * (P0-5).
 */
export function getKpis(
  companyId: string,
  range: DateRange = "this_year",
  customStart?: string,
  customEnd?: string,
  analyticsCompanyId?: string,
): Kpi[] {
  const list = filterFormulasByRange(
    getAnalyticsFormulas(companyId, analyticsCompanyId),
    range,
    customStart,
    customEnd,
  )
  const perspective = isPerspective(companyId, analyticsCompanyId)

  // Route aggregates through the shared adapter so KPIs re-derive from
  // participant chains and settlement records (never stored profit fields), and
  // so Dashboard + Reports share one definition.
  const views = list.map((f) => viewFormula(f, companyId, analyticsCompanyId))
  const realizedProfit = views.filter((v) => v.realizedProfit > 0).reduce((s, v) => s + v.realizedProfit, 0)
  const totalLoss = views.filter((v) => v.realizedProfit < 0).reduce((s, v) => s + v.realizedProfit, 0)
  const receivable = views.reduce((s, v) => s + v.receivable, 0)
  const payable = views.reduce((s, v) => s + v.payable, 0)

  // Upcoming flows: reinterpreted from the selected company's viewpoint in
  // perspective mode, otherwise the owning desk's own schedule.
  const scheduleRows = perspective
    ? list.flatMap((f) => perspectiveScheduleItems(f, analyticsCompanyId as string))
    : list.flatMap((f) => f.schedule.map((s) => ({ ...s, perspectiveType: s.type })))
  const upcomingReceipts = scheduleRows
    .filter((s) => s.perspectiveType === "receipt" && s.status !== "settled")
    .reduce((s, x) => s + (x.amount - x.settledAmount), 0)
  const upcomingPayments = scheduleRows
    .filter((s) => s.perspectiveType === "payment" && s.status !== "settled")
    .reduce((s, x) => s + (x.amount - x.settledAmount), 0)

  const closeable = list.filter((x) => x.closeable).length
  const unmatched = list.filter((x) => x.invoiceStatus === "unmatched").length

  const ctx = analyticsDrillContext(companyId, range, analyticsCompanyId)
  return [
    { key: "realized", label: "Realized Profit", value: realizedProfit, currency: true, delta: 12.4, intent: "success", drillTo: `/formulas?filter=profit${ctx}` },
    { key: "loss", label: "Total Loss", value: totalLoss, currency: true, delta: -4.1, intent: "danger", drillTo: `/formulas?filter=loss${ctx}` },
    { key: "receivable", label: "Accounts Receivable", value: receivable, currency: true, intent: "info", drillTo: `/formulas?filter=receivable${ctx}` },
    { key: "payable", label: "Accounts Payable", value: payable, currency: true, intent: "warning", drillTo: `/formulas?filter=payable${ctx}` },
    { key: "up-receipts", label: "Upcoming Receipts", value: upcomingReceipts, currency: true, intent: "info", drillTo: `/calendar?type=receipt${ctx}` },
    { key: "up-payments", label: "Upcoming Payments", value: upcomingPayments, currency: true, intent: "warning", drillTo: `/calendar?type=payment${ctx}` },
    { key: "closeable", label: "Closeable Formulas", value: closeable, count: true, intent: "success", drillTo: `/formulas?filter=closeable${ctx}` },
    { key: "unmatched", label: "Invoice Unmatched", value: unmatched, count: true, intent: "danger", drillTo: `/formulas?filter=unmatched${ctx}` },
  ]
}

/**
 * Shared drill-down context suffix (P0-5): preserves operating scope, analytical
 * company and date range so the target screen can restore the same view. Always
 * begins with `&` since callers append it after an existing query param.
 */
export function analyticsDrillContext(
  operatingId: string,
  range: DateRange,
  analyticsCompanyId?: string,
): string {
  const params = new URLSearchParams()
  params.set("company", operatingId)
  params.set("range", range)
  if (isPerspective(operatingId, analyticsCompanyId)) params.set("analytics", analyticsCompanyId as string)
  return `&${params.toString()}`
}

/**
 * Realized-profit trend series bucketed by the formula's actual trade date
 * within the selected window (P0-2). Buckets are real sub-intervals of the
 * window, so figures reconcile with the KPIs above.
 */
export function getProfitSeries(
  companyId: string,
  range: DateRange = "this_year",
  customStart?: string,
  customEnd?: string,
  analyticsCompanyId?: string,
) {
  const list = filterFormulasByRange(
    getAnalyticsFormulas(companyId, analyticsCompanyId),
    range,
    customStart,
    customEnd,
  )
  const { start, end } = getRangeWindow(range, customStart, customEnd)

  // Choose bucket granularity by window length.
  const spanDays = Math.max(1, Math.round((end - start) / DAY))
  let bucketCount: number
  let labelFor: (from: number, to: number) => string
  if (spanDays <= 10) {
    bucketCount = Math.min(spanDays, 7)
    labelFor = (from) => new Date(from).toLocaleDateString("en-US", { weekday: "short" })
  } else if (spanDays <= 45) {
    bucketCount = 4
    labelFor = (_from, _to, ) => ""
  } else {
    bucketCount = Math.min(12, Math.max(3, Math.round(spanDays / 30)))
    labelFor = (from) => new Date(from).toLocaleDateString("en-US", { month: "short" })
  }

  const step = (end - start) / bucketCount
  const series: { month: string; profit: number }[] = []
  for (let i = 0; i < bucketCount; i++) {
    const from = start + i * step
    const to = start + (i + 1) * step
    const profit = list
      .filter((f) => {
        // Canonical business basis (P0-1): tradeDate.
        const t = Date.parse(f.tradeDate)
        return t >= from && t < to
      })
      .reduce((s, f) => s + viewFormula(f, companyId, analyticsCompanyId).realizedProfit, 0)
    const label = labelFor(from, to) || `Week ${i + 1}`
    series.push({ month: label, profit: Math.round(profit) })
  }
  return series
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
        dueDate: s.scheduledDate,
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
  const count = Math.max(1, formula.latestVersionNo)
  // Typed diffs: raw values + valueType (formatted at render time) and an
  // explicit versionTriggering flag. Non-triggering entries (payment schedule
  // date, logistics mode) are grouped separately in the UI.
  const changeSets: VersionEntry["changes"][] = [
    [
      {
        field: "sellUnitPrice",
        label: "Sell Unit Price",
        oldValue: 980000,
        newValue: 992000,
        valueType: "currency",
        versionTriggering: true,
      },
      {
        field: "paymentScheduleDate",
        label: "Payment Schedule Date",
        oldValue: "2025-03-01",
        newValue: "2025-03-08",
        valueType: "date",
        versionTriggering: false,
      },
    ],
    [
      {
        field: "quantity",
        label: "Formula Quantity",
        oldValue: 500,
        newValue: 480,
        valueType: "number",
        versionTriggering: true,
      },
      {
        field: "participantAdded",
        label: "Participant Added",
        oldValue: null,
        newValue: "Nature Insight (Trading Company)",
        valueType: "text",
        versionTriggering: true,
      },
    ],
    [
      {
        field: "buyUnitPrice",
        label: "Buy Unit Price",
        oldValue: 950000,
        newValue: 948000,
        valueType: "currency",
        versionTriggering: true,
      },
      {
        field: "logisticsCost",
        label: "Logistics Cost",
        oldValue: 3200000,
        newValue: 3500000,
        valueType: "currency",
        versionTriggering: true,
      },
      {
        field: "logisticsMode",
        label: "Logistics Mode",
        oldValue: "Air",
        newValue: "Sea",
        valueType: "text",
        versionTriggering: false,
      },
    ],
    [
      {
        field: "created",
        label: "Formula Created",
        oldValue: null,
        newValue: "Initial draft",
        valueType: "text",
        versionTriggering: false,
      },
    ],
  ]
  const summaries = ["Pricing revised", "Participants & quantity updated", "Sourcing terms adjusted", "Initial draft created"]

  // Live-derived figures used only as a base for FIXED historical snapshots.
  // Each historical snapshot is a frozen snapshotData object (P0-1) — the UI never
  // re-derives it from the current Formula. Only calculation fields are captured;
  // settlement-derived figures are intentionally excluded (Prisma stores none here).
  const exp = deriveExpected(formula)

  return Array.from({ length: count }, (_, i) => {
    const versionNo = count - i
    const dayOffset = i === 0 ? 2 : 8 + i * 12
    const idx = Math.min(i, changeSets.length - 1)
    // i === 0 is the latest version (factor 1); older versions are scaled down.
    const factor = 1 - i * 0.06
    const totalBuyAmount = Math.round(exp.totalBuy * factor)
    const totalSellAmount = Math.round(exp.totalSell * factor)
    const totalCost = Math.round(exp.cost * factor)
    const totalShare = Math.round(exp.share * factor)
    const netProfit = Math.round(exp.expectedProfit * factor)
    const exchangeRateUsed = formula.adjustedExchangeRate ?? formula.contractExchangeRate ?? null
    const snapshot: CalculationSnapshot = {
      formulaVersionId: `${formula.id}-v${versionNo}`,
      quantity: formula.quantity,
      totalBuyAmount,
      totalSellAmount,
      totalCost,
      totalShare,
      netProfit,
      profitRate: totalSellAmount ? Number(((netProfit / totalSellAmount) * 100).toFixed(4)) : null,
      exchangeRateUsed,
      // Fixed frozen payload — not recomputed from the live Formula (P0-1).
      snapshotData: {
        quantity: formula.quantity,
        totalBuyAmount,
        totalSellAmount,
        totalCost,
        totalShare,
        netProfit,
        exchangeRateUsed,
        capturedForVersion: versionNo,
      },
    }
    return {
      versionNo,
      createdAt: new Date(Date.now() - dayOffset * DAY).toISOString(),
      createdBy: versionAuthors[(versionNo + formula.id.length) % versionAuthors.length],
      summary: summaries[idx],
      changes: changeSets[idx],
      snapshot,
    }
  })
}

/**
 * Loss-formula ranking. In perspective mode a formula's loss is judged from the
 * selected company's recorded cash (P0-2); otherwise from the owning desk's
 * realized profit. Returns each formula with the perspective-scoped realized
 * value used for ranking so callers render the right figure.
 */
export function getLossRanking(companyId: string, analyticsCompanyId?: string) {
  return getAnalyticsFormulas(companyId, analyticsCompanyId)
    .map((f) => ({ ...f, realizedProfit: viewFormula(f, companyId, analyticsCompanyId).realizedProfit }))
    .filter((f) => f.realizedProfit < 0)
    .sort((a, b) => a.realizedProfit - b.realizedProfit)
    .slice(0, 5)
}

/**
 * Upcoming settlement rows for the cashflow timeline. In perspective mode the
 * rows are reinterpreted from the selected company's viewpoint (the desk's
 * receipt is the counterparty's payment, and vice-versa) and scoped to that
 * company; otherwise they are the owning desk's own schedule.
 */
export function getCashflowTimeline(
  companyId: string,
  type: "receipt" | "payment",
  analyticsCompanyId?: string,
) {
  const perspective = isPerspective(companyId, analyticsCompanyId)
  return getAnalyticsFormulas(companyId, analyticsCompanyId)
    .flatMap((f) => {
      const rows = perspective
        ? perspectiveScheduleItems(f, analyticsCompanyId as string)
        : f.schedule.map((s) => ({ ...s, perspectiveType: s.type }))
      return rows.map((s) => ({ ...s, formula: f.number, item: f.item }))
    })
    .filter((s) => s.perspectiveType === type && s.status !== "settled")
    .sort((a, b) => Date.parse(a.scheduledDate) - Date.parse(b.scheduledDate))
    .slice(0, 6)
}
