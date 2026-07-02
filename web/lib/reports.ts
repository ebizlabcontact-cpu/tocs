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
  getFormulasByCompany,
  getProfitSeries,
  getRangeFactor,
} from "./mock-data"
import { statusConfig, tradeTypeConfig } from "./status"

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

function metricValue(f: Formula, metric: MetricKey): number {
  switch (metric) {
    case "realized":
      return f.realizedProfit
    case "expected":
      return f.expectedProfit
    case "revenue":
      return f.totalSell
    case "cost":
      return f.totalBuy
    case "receivable":
      return f.receivable
    case "payable":
      return f.payable
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
  companyId: string,
  metric: MetricKey,
  dimension: DimensionKey,
  range: DateRange,
): { rows: ReportRow[]; total: number } {
  const list = getFormulasByCompany(companyId)
  const factor = getRangeFactor(range)
  const map = new Map<string, { value: number; count: number }>()

  for (const f of list) {
    const label = dimensionLabel(f, dimension)
    const prev = map.get(label) ?? { value: 0, count: 0 }
    prev.value += metricValue(f, metric)
    prev.count += 1
    map.set(label, prev)
  }

  const rows: ReportRow[] = [...map.entries()]
    .map(([label, v]) => ({ label, value: Math.round(v.value * factor), count: v.count }))
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

export function getExecutiveSummary(companyId: string, range: DateRange): ExecutiveSummary {
  const list = getFormulasByCompany(companyId)
  const factor = getRangeFactor(range)
  const scale = (v: number) => Math.round(v * factor)

  return {
    realizedProfit: scale(list.reduce((s, f) => s + f.realizedProfit, 0)),
    expectedProfit: scale(list.reduce((s, f) => s + f.expectedProfit, 0)),
    receivable: scale(list.reduce((s, f) => s + f.receivable, 0)),
    payable: scale(list.reduce((s, f) => s + f.payable, 0)),
    revenue: scale(list.reduce((s, f) => s + f.totalSell, 0)),
    formulaCount: list.length,
    profitSeries: getProfitSeries(companyId, range),
    topFormulas: [...list]
      .sort((a, b) => b.realizedProfit - a.realizedProfit)
      .slice(0, 6)
      .map((f) => ({ number: f.number, item: f.item, realized: scale(f.realizedProfit) })),
  }
}

export type OperationalSummary = {
  byStatus: ReportRow[]
  byTradeType: ReportRow[]
  invoiceUnmatched: number
  logisticsInTransit: number
  closeable: number
  attention: { number: string; item: string; note: string }[]
}

export function getOperationalSummary(companyId: string): OperationalSummary {
  const list = getFormulasByCompany(companyId)

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
    closeable: list.filter((f) => f.closeable).length,
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
export function getTrendSummary(companyId: string, range: DateRange): TrendPoint[] {
  const list = getFormulasByCompany(companyId)
  const realizedSeries = getProfitSeries(companyId, range)
  const totalRealized = realizedSeries.reduce((s, p) => s + p.profit, 0) || 1
  const totalExpected = list.reduce((s, f) => s + f.expectedProfit, 0) * getRangeFactor(range)

  return realizedSeries.map((p) => ({
    month: p.month,
    realized: p.profit,
    expected: Math.round((p.profit / totalRealized) * totalExpected),
  }))
}
