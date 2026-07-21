/**
 * Build a mock-created Formula + backend-aligned CreateFormulaRequest from wizard state.
 */
import { deriveFormula, type WizardState } from "@/components/wizard/types"
import type { CreateFormulaRequest } from "./api-types"
import { recomputeFormulaPreview } from "./formula-preview-mutations"
import { toPrismaTradeType } from "./prisma-mapping"
import type { Formula, FormulaShare, LogisticsLeg, Participant, PaymentScheduleItem } from "./types"
import { uid } from "./utils"

function previewFormulaNumber(tradeDate: string): string {
  const d = new Date(tradeDate)
  const yymm = `${String(d.getFullYear()).slice(-2)}${String(d.getMonth() + 1).padStart(2, "0")}`
  return `FM-PREVIEW-${yymm}-${uid().slice(0, 5).toUpperCase()}`
}

export function buildCreateFormulaRequest(state: WizardState): CreateFormulaRequest {
  const cross = state.tradeType !== "domestic"
  return {
    item_id: state.itemId,
    trade_type: toPrismaTradeType(state.tradeType),
    quantity: state.quantity,
    unit: state.unit,
    base_currency: state.fx.baseCurrency || "KRW",
    foreign_currency: cross ? state.fx.txnCurrency : null,
    departure_country: cross ? state.fx.purchaseCountry || null : null,
    arrival_country: cross ? state.fx.salesCountry || null : null,
    contract_exchange_rate: cross ? state.fx.contractExchangeRate || null : null,
    adjusted_exchange_rate: cross ? state.fx.adjustedExchangeRate || null : null,
    content: state.specMemo || null,
    note: state.internalMemo || null,
  }
}

export function buildFormulaFromWizard(state: WizardState): Formula {
  const derived = deriveFormula(state)
  const now = new Date().toISOString()
  const cross = state.tradeType !== "domestic"
  const id = `f-preview-${uid()}`

  const participants: Participant[] = state.participants
    .filter((p) => p.company.trim())
    .map((p, i) => ({
      id: p.id,
      name: p.company,
      company: p.company,
      companyId: state.companyId,
      role: p.roleGroup === "supplier" ? "seller" : p.roleGroup === "buyer" ? "buyer" : "agent",
      roleGroup: p.roleGroup,
      natureGroup: p.natureGroup,
      paymentGroup: p.paymentGroup,
      quantity: p.quantity,
      buyPrice: p.buyPrice,
      sellPrice: p.sellPrice,
      buyUnitPrice: p.buyPrice,
      sellUnitPrice: p.sellPrice,
      sequenceOrder: i,
      isStart: p.startPoint,
      isEnd: p.endPoint,
    }))

  const schedule: PaymentScheduleItem[] = state.schedule.map((s) => ({
    id: s.id,
    type: s.type,
    counterparty: s.counterparty,
    amount: s.amount,
    scheduledDate: s.dueDate,
    status: "scheduled" as const,
    settledAmount: 0,
  }))

  const logisticsCost = state.costs.reduce((sum, c) => sum + (c.amount || 0), 0)
  const logistics: LogisticsLeg[] = state.logistics.map((leg, i) => ({
    id: leg.id,
    carrier: "Preview Carrier",
    mode: leg.mode,
    origin: leg.origin,
    destination: leg.destination,
    status: "booked",
    eta: leg.eta,
    actualArrival: null,
    actualDelivery: null,
    cost: i === 0 ? logisticsCost : 0,
    costBearer: state.tradeType === "export" ? "Seller (FOB)" : "Buyer (CIF)",
  }))

  const shares: FormulaShare[] =
    state.shareAmount > 0
      ? [{ id: "sh-preview", companyName: state.companyId, amount: state.shareAmount, note: "Wizard share (preview)" }]
      : []

  const base: Formula = {
    id,
    number: previewFormulaNumber(state.tradeDate),
    companyId: state.companyId,
    item: state.item,
    specMemo: state.specMemo,
    tradeType: state.tradeType,
    quantity: state.quantity,
    unit: state.unit,
    participants,
    baseCurrency: (state.fx.baseCurrency || "KRW") as Formula["baseCurrency"],
    transactionCurrency: (cross ? state.fx.txnCurrency : "KRW") as Formula["transactionCurrency"],
    contractExchangeRate: cross ? state.fx.contractExchangeRate : undefined,
    adjustedExchangeRate: cross ? state.fx.adjustedExchangeRate : undefined,
    totalSell: derived.expectedRevenue,
    totalBuy: derived.expectedCost,
    cost: logisticsCost,
    share: derived.share,
    expectedProfit: derived.expectedProfit,
    shares,
    realizedProfit: 0,
    actualReceipts: 0,
    actualPayments: 0,
    receivable: derived.expectedReceipts,
    payable: derived.expectedPayments,
    schedule,
    records: [],
    tradeStatus: "draft",
    cashInStatus: "pending",
    cashOutStatus: "pending",
    invoiceStatus: "unmatched",
    logisticsStatus: "not_started",
    deliveryStatus: "pending",
    isClosed: false,
    status: "active",
    closeable: false,
    tradeDate: state.tradeDate,
    contractDate: state.contractDate,
    createdAt: now,
    updatedAt: now,
    latestVersionNo: 1,
    invoices: [],
    logistics,
    vehicles: [],
    statusLogs: [],
    attention: "Mock-created formula — preview only, not persisted to backend.",
  }

  return recomputeFormulaPreview(base)
}
