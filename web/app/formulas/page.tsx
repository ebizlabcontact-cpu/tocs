"use client"

import { Suspense, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ArrowUpDown, LayoutGrid, Table2, X, FilterX } from "lucide-react"
import { useCompany } from "@/components/company-context"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { CreateFormulaButton } from "@/components/formulas/create-formula-button"
import { FormulaCard } from "@/components/formulas/formula-card"
import { FormulaTable } from "@/components/formulas/formula-table"
import { FormulaFilters, filterLabel, type StatusFilter } from "@/components/formulas/formula-filters"
import { getAnalyticsFormulas, filterFormulasByRange, analyticsCompanyName } from "@/lib/mock-data"
import { mergeFormulasForScope } from "@/lib/formula-preview-session"
import { viewFormula, type FormulaMetricsView } from "@/lib/formula-math"
import { t, type TranslationKey } from "@/lib/i18n"
import { cn, formatCurrency } from "@/lib/utils"
import type { DateRange, Formula } from "@/lib/types"
import { DATE_RANGE_IDS, dateRangeLabel } from "@/lib/date-range-labels"

type SortKey = "recent" | "profit" | "value"
type ViewMode = "table" | "cards"

/** Status matching uses the perspective-aware metrics view (P0-3), so filtering
 *  reconciles with the Dashboard/Reports figure the user drilled from. */
function matchesStatus(f: Formula, status: StatusFilter, v: FormulaMetricsView) {
  switch (status) {
    case "all":
      return true
    case "loss":
      return v.realizedProfit < 0
    case "profit":
      return v.realizedProfit > 0
    case "closeable":
      return f.closeable
    case "receivable":
      return v.receivable > 0
    case "payable":
      return v.payable > 0
    case "unmatched":
      return f.invoiceStatus === "unmatched"
    case "attention":
      return Boolean(f.attention)
    default:
      return f.status === status
  }
}

const VALID_RANGES: DateRange[] = [...DATE_RANGE_IDS]

const VALID_FILTERS: StatusFilter[] = [
  "all",
  "active",
  "invoicing",
  "closeable",
  "closed",
  "loss",
  "profit",
  "receivable",
  "payable",
  "unmatched",
  "attention",
]

/** Contextual empty-state keys per stable filter ID. */
const EMPTY_STATE_KEYS: Record<StatusFilter, { title: TranslationKey; description: TranslationKey }> = {
  all: { title: "formulas.list.empty.allTitle", description: "formulas.list.empty.allDescription" },
  active: { title: "formulas.list.empty.activeTitle", description: "formulas.list.empty.activeDescription" },
  invoicing: { title: "formulas.list.empty.invoicingTitle", description: "formulas.list.empty.invoicingDescription" },
  closeable: { title: "formulas.list.empty.closeableTitle", description: "formulas.list.empty.closeableDescription" },
  closed: { title: "formulas.list.empty.closedTitle", description: "formulas.list.empty.closedDescription" },
  loss: { title: "formulas.list.empty.lossTitle", description: "formulas.list.empty.lossDescription" },
  profit: { title: "formulas.list.empty.profitTitle", description: "formulas.list.empty.profitDescription" },
  receivable: { title: "formulas.list.empty.receivableTitle", description: "formulas.list.empty.receivableDescription" },
  payable: { title: "formulas.list.empty.payableTitle", description: "formulas.list.empty.payableDescription" },
  unmatched: { title: "formulas.list.empty.unmatchedTitle", description: "formulas.list.empty.unmatchedDescription" },
  attention: { title: "formulas.list.empty.attentionTitle", description: "formulas.list.empty.attentionDescription" },
}

function FormulasContent() {
  const { selected } = useCompany()
  const params = useSearchParams()

  // Full drill-down context (P0-1). Operating scope prefers the URL `company`
  // param, else the header operating scope. Analytical company comes from
  // `analytics` (ignored when it equals the operating scope).
  const operatingId = params.get("company") ?? selected.id
  const analyticsParam = params.get("analytics")
  const analyticsId = analyticsParam && analyticsParam !== operatingId ? analyticsParam : undefined
  const perspective = Boolean(analyticsId)
  const rangeParam = params.get("range") as DateRange | null
  const range = rangeParam && VALID_RANGES.includes(rangeParam) ? rangeParam : undefined
  const metric = params.get("metric") ?? undefined

  const initialFilter = params.get("filter") as StatusFilter | null
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>(
    initialFilter && VALID_FILTERS.includes(initialFilter) ? initialFilter : "all",
  )
  const [sort, setSort] = useState<SortKey>("recent")
  const [view, setView] = useState<ViewMode>("table")

  // Scope + perspective aware set (P0-2), narrowed by the drilled date window
  // (P0-4). Each row carries its perspective metrics view (P0-3).
  const rows = useMemo(() => {
    let list = mergeFormulasForScope(getAnalyticsFormulas(operatingId, analyticsId), operatingId)
    if (range) list = filterFormulasByRange(list, range)
    return list.map((f) => ({ f, v: viewFormula(f, operatingId, analyticsId) }))
  }, [operatingId, analyticsId, range])

  // Query string that carries the active context into Formula Detail (P0-5).
  const detailQuery = useMemo(() => {
    const p = new URLSearchParams()
    p.set("company", operatingId)
    if (analyticsId) p.set("analytics", analyticsId)
    if (range) p.set("range", range)
    if (status !== "all") p.set("filter", status)
    if (metric) p.set("metric", metric)
    const s = p.toString()
    return s ? `?${s}` : ""
  }, [operatingId, analyticsId, range, status, metric])

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: rows.length,
      active: 0,
      invoicing: 0,
      closeable: 0,
      closed: 0,
      loss: 0,
      profit: 0,
      receivable: 0,
      payable: 0,
      unmatched: 0,
      attention: 0,
    }
    for (const { f, v } of rows) {
      if (f.status === "active") c.active++
      if (f.status === "invoicing") c.invoicing++
      if (f.closeable) c.closeable++
      if (f.status === "closed") c.closed++
      if (v.realizedProfit < 0) c.loss++
      if (v.realizedProfit > 0) c.profit++
      if (v.receivable > 0) c.receivable++
      if (v.payable > 0) c.payable++
      if (f.invoiceStatus === "unmatched") c.unmatched++
      if (f.attention) c.attention++
    }
    return c
  }, [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = rows.filter(({ f, v }) => matchesStatus(f, status, v))
    if (q) {
      list = list.filter(
        ({ f }) =>
          f.number.toLowerCase().includes(q) ||
          f.item.toLowerCase().includes(q) ||
          f.participants.some((p) => p.name.toLowerCase().includes(q)),
      )
    }
    list = [...list].sort((a, b) => {
      if (sort === "recent") return Date.parse(b.f.updatedAt) - Date.parse(a.f.updatedAt)
      if (sort === "profit") return b.v.realizedProfit - a.v.realizedProfit
      return b.v.totalSell - a.v.totalSell
    })
    return list
  }, [rows, status, query, sort])

  const totalValue = filtered.reduce((s, { v }) => s + v.totalSell, 0)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t("formulas.list.header.title")}
        description={t("formulas.list.header.description")}
        actions={<CreateFormulaButton />}
      />

      <FormulaFilters query={query} onQuery={setQuery} status={status} onStatus={setStatus} counts={counts} />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{t("formulas.list.context.label")}</span>
        <ContextChip label={t("formulas.list.context.scope")} value={analyticsCompanyName(operatingId)} />
        {perspective && (
          <ContextChip label={t("formulas.list.context.perspective")} value={analyticsCompanyName(analyticsId as string)} />
        )}
        {range && <ContextChip label={t("formulas.list.context.range")} value={dateRangeLabel(range)} />}
        {metric && <ContextChip label={t("formulas.list.context.metric")} value={metric} />}
        {status !== "all" && (
          <button
            type="button"
            onClick={() => setStatus("all")}
            className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/15"
          >
            {filterLabel(status)}
            <span className="tabular-nums text-accent/70">{counts[status] ?? 0}</span>
            <X className="size-3" />
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t("formulas.list.results.summary", {
            count: filtered.length,
            value: formatCurrency(totalValue, { compact: true }),
          })}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="size-3.5 text-muted-foreground" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground outline-none focus:border-accent"
            >
              <option value="recent">{t("formulas.list.sort.recent")}</option>
              <option value="profit">{t("formulas.list.sort.highestProfit")}</option>
              <option value="value">{t("formulas.list.sort.largestValue")}</option>
            </select>
          </div>
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            <button
              type="button"
              onClick={() => setView("table")}
              aria-label={t("formulas.list.view.table")}
              aria-pressed={view === "table"}
              className={cn(
                "flex size-7 items-center justify-center rounded-md transition-colors",
                view === "table" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Table2 className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("cards")}
              aria-label={t("formulas.list.view.cards")}
              aria-pressed={view === "cards"}
              className={cn(
                "flex size-7 items-center justify-center rounded-md transition-colors",
                view === "cards" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {filtered.length > 0 ? (
        view === "table" ? (
          <div className="mt-4">
            <FormulaTable
              formulas={filtered.map((r) => r.f)}
              operatingId={operatingId}
              analyticsId={analyticsId}
              detailQuery={detailQuery}
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map(({ f }) => (
              <FormulaCard
                key={f.id}
                formula={f}
                operatingId={operatingId}
                analyticsId={analyticsId}
                detailQuery={detailQuery}
              />
            ))}
          </div>
        )
      ) : (
        <div className="mt-16 flex flex-col items-center justify-center gap-3 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <FilterX className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {query ? t("formulas.list.empty.noResultsTitle") : t(EMPTY_STATE_KEYS[status].title)}
            </p>
            <p className="text-sm text-muted-foreground">
              {query
                ? t("formulas.list.empty.noResultsDescription", { query })
                : t(EMPTY_STATE_KEYS[status].description)}
            </p>
          </div>
          {(status !== "all" || query) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStatus("all")
                setQuery("")
              }}
            >
              {t("formulas.list.filters.clear")}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

/** Compact read-only context badge (P0-6). */
function ContextChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
      <span className="font-medium text-foreground/70">{label}</span>
      <span className="text-foreground">{value}</span>
    </span>
  )
}

export default function FormulasPage() {
  return (
    <Suspense fallback={<div className="animate-fade-in" />}>
      <FormulasContent />
    </Suspense>
  )
}
