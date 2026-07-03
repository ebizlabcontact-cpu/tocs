/**
 * Reports derivation layer.
 *
 * Formula First: every figure here is derived from the shared `formulas`
 * dataset. Reports never own an independent dataset or persistence — they are
 * pure projections of Formula data, scaled illustratively by the selected
 * period (mock only).
 */
import type { DateRange, Formula } from "./types"
import {
  companies,
  filterFormulasByRange,
  getAnalyticsFormulas,
  getProfitSeries,
} from "./mock-data"
import { statusConfig, tradeTypeConfig } from "./status"
import { type FormulaMetricsView, viewFormula } from "./formula-math"

export type MetricKey = "realized" | "expected" | "revenue" | "cost" | "receivable" | "payable"
export type DimensionKey = "company" | "tradeType" | "item" | "status"

export const METRICS: { key: MetricKey; label: string; currency: boolean }[] = [
  { key: "realized", label: "Realized Profit", currency: true },
  { key: "expected", label: "Expected Profit", currency: true },
  { key: "revenue", label: "Revenue (Sell)", currency: true },
  { key: "cost", label: "Cost (Buy)", currency: true },
  { key: "receivable", label: "Accounts Receivable", currency: true },
  { key: "payable", label: "Accounts Payable", currency: true },
]

export const DIMENSIONS: { key: DimensionKey; label: string }[] = [
  { key: "company", label: "Company" },
  { key: "tradeType", label: "Trade Type" },
  { key: "item", label: "Item" },
  { key: "status", label: "Status" },
]

function metricValue(v: FormulaMetricsView, metric: MetricKey): number {
  // All figures re-derive from the shared adapter — owner totals in "all in
  // scope" mode, participant-perspective figures otherwise.
  switch (metric) {
    case "realized":
      return v.realizedProfit
    case "expected":
      return v.expectedProfit
    case "revenue":
      return v.totalSell
    case "cost":
      return v.totalBuy
    case "receivable":
      return v.receivable
    case "payable":
      return v.payable
  }
}

const companyName = (id: string) => companies.find((c) => c.id === id)?.name ?? id

function dimensionLabel(f: Formula, dim: DimensionKey): string {
  switch (dim) {
    case "company":
      return companyName(f.companyId)
    case "tradeType":
      return tradeTypeConfig[f.tradeType].label
    case "item":
      return f.item
    case "status":
      return statusConfig[f.status].label
  }
}

export type ReportRow = { label: string; value: number; count: number }

/** Group a metric by a dimension, scaled by the selected period. */
export function buildGroupedReport(
  operatingId: string,
  metric: MetricKey,
  dimension: DimensionKey,
  range: DateRange,
  analyticsCompanyId?: string,
): { rows: ReportRow[]; total: number } {
  const list = filterFormulasByRange(getAnalyticsFormulas(operatingId, analyticsCompanyId), range)
  const map = new Map<string, { value: number; count: number }>()

  for (const f of list) {
    const label = dimensionLabel(f, dimension)
    const prev = map.get(label) ?? { value: 0, count: 0 }
    prev.value += metricValue(viewFormula(f, operatingId, analyticsCompanyId), metric)
    prev.count += 1
    map.set(label, prev)
  }

  const rows: ReportRow[] = [...map.entries()]
    .map(([label, v]) => ({ label, value: Math.round(v.value), count: v.count }))
    .sort((a, b) => b.value - a.value)

  const total = rows.reduce((s, r) => s + r.value, 0)
  return { rows, total }
}

export type ExecutiveSummary = {
  realizedProfit: number
  expectedProfit: number
  receivable: number
  payable: number
  revenue: number
  formulaCount: number
  profitSeries: { month: string; profit: number }[]
  topFormulas: { number: string; item: string; realized: number }[]
}

export function getExecutiveSummary(
  companyId: string,
  range: DateRange,
  analyticsCompanyId?: string,
): ExecutiveSummary {
  const list = filterFormulasByRange(getAnalyticsFormulas(companyId, analyticsCompanyId), range)
  const withView = list
    .map((f) => ({ f, v: viewFormula(f, companyId, analyticsCompanyId) }))
    .sort((a, b) => b.v.realizedProfit - a.v.realizedProfit)

  return {
    realizedProfit: withView.reduce((s, { v }) => s + v.realizedProfit, 0),
    expectedProfit: withView.reduce((s, { v }) => s + v.expectedProfit, 0),
    receivable: withView.reduce((s, { v }) => s + v.receivable, 0),
    payable: withView.reduce((s, { v }) => s + v.payable, 0),
    revenue: withView.reduce((s, { v }) => s + v.totalSell, 0),
    formulaCount: list.length,
    profitSeries: getProfitSeries(companyId, range, undefined, undefined, analyticsCompanyId),
    topFormulas: withView
      .slice(0, 6)
      .map(({ f, v }) => ({ number: f.number, item: f.item, realized: v.realizedProfit })),
  }
}

export type OperationalSummary = {
  byStatus: ReportRow[]
  byTradeType: ReportRow[]
  invoiceUnmatched: number
  logisticsInTransit: number
  /** Ready to close, awaiting manual approval: closeable === true && isClosed === false. */
  closeable: number
  /** Manually closed (persisted): isClosed === true. */
  closed: number
  attention: { number: string; item: string; note: string }[]
}

export function getOperationalSummary(companyId: string, analyticsCompanyId?: string): OperationalSummary {
  const list = getAnalyticsFormulas(companyId, analyticsCompanyId)

  const countBy = (fn: (f: Formula) => string): ReportRow[] => {
    const map = new Map<string, number>()
    for (const f of list) map.set(fn(f), (map.get(fn(f)) ?? 0) + 1)
    return [...map.entries()]
      .map(([label, count]) => ({ label, value: count, count }))
      .sort((a, b) => b.value - a.value)
  }

  return {
    byStatus: countBy((f) => statusConfig[f.status].label),
    byTradeType: countBy((f) => tradeTypeConfig[f.tradeType].label),
    invoiceUnmatched: list.filter((f) => f.invoiceStatus === "unmatched").length,
    logisticsInTransit: list.filter((f) => f.logisticsStatus === "in_transit").length,
    closeable: list.filter((f) => f.closeable && !f.isClosed).length,
    closed: list.filter((f) => f.isClosed).length,
    attention: list
      .filter((f) => f.attention)
      .slice(0, 6)
      .map((f) => ({ number: f.number, item: f.item, note: f.attention as string })),
  }
}

export type TrendPoint = { month: string; realized: number; expected: number }

/**
 * Realized vs expected profit trend across the period's buckets. Expected is
 * distributed proportionally to the realized series shape (illustrative).
 */
export function getTrendSummary(companyId: string, range: DateRange, analyticsCompanyId?: string): TrendPoint[] {
  const list = filterFormulasByRange(getAnalyticsFormulas(companyId, analyticsCompanyId), range)
  const realizedSeries = getProfitSeries(companyId, range, undefined, undefined, analyticsCompanyId)
  const totalRealized = realizedSeries.reduce((s, p) => s + p.profit, 0) || 1
  const totalExpected = list.reduce((s, f) => s + viewFormula(f, companyId, analyticsCompanyId).expectedProfit, 0)

  return realizedSeries.map((p) => ({
    month: p.month,
    realized: p.profit,
    expected: Math.round((p.profit / totalRealized) * totalExpected),
  }))
}
