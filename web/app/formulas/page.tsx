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
import { FormulaFilters, filterLabels, type StatusFilter } from "@/components/formulas/formula-filters"
import { getFormulasByCompany } from "@/lib/mock-data"
import { cn, formatCurrency } from "@/lib/utils"
import type { Formula } from "@/lib/types"

type SortKey = "recent" | "profit" | "value"
type ViewMode = "table" | "cards"

function matchesStatus(f: Formula, status: StatusFilter) {
  switch (status) {
    case "all":
      return true
    case "loss":
      return f.realizedProfit < 0
    case "profit":
      return f.realizedProfit > 0
    case "closeable":
      return f.closeable
    case "receivable":
      return f.receivable > 0
    case "payable":
      return f.payable > 0
    case "unmatched":
      return f.invoiceStatus === "unmatched"
    case "attention":
      return Boolean(f.attention)
    default:
      return f.status === status
  }
}

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

/** Contextual empty-state copy per active filter. */
const EMPTY_STATES: Record<StatusFilter, { title: string; description: string }> = {
  all: { title: "No formulas yet", description: "Create your first formula to start tracking deals." },
  active: { title: "No active formulas", description: "Nothing is currently in progress for this company." },
  invoicing: { title: "No formulas awaiting invoicing", description: "All invoices are up to date." },
  closeable: { title: "No formulas ready to close", description: "Formulas appear here once fully settled." },
  closed: { title: "No closed formulas", description: "Completed formulas will be listed here." },
  loss: { title: "No loss-making formulas", description: "Great — nothing is currently running at a loss." },
  profit: { title: "No profitable formulas yet", description: "Realized profit appears here after settlement." },
  receivable: { title: "No outstanding receivables", description: "Every counterparty is paid up." },
  payable: { title: "No outstanding payables", description: "You have no pending payments to make." },
  unmatched: { title: "All invoices matched", description: "No invoice discrepancies to resolve." },
  attention: { title: "Nothing needs attention", description: "All formulas are healthy right now." },
}

function FormulasContent() {
  const { selected } = useCompany()
  const params = useSearchParams()
  const initialFilter = params.get("filter") as StatusFilter | null
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>(
    initialFilter && VALID_FILTERS.includes(initialFilter) ? initialFilter : "all",
  )
  const [sort, setSort] = useState<SortKey>("recent")
  const [view, setView] = useState<ViewMode>("table")

  const all = useMemo(() => getFormulasByCompany(selected.id), [selected.id])

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: all.length,
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
    for (const f of all) {
      if (f.status === "active") c.active++
      if (f.status === "invoicing") c.invoicing++
      if (f.closeable) c.closeable++
      if (f.status === "closed") c.closed++
      if (f.realizedProfit < 0) c.loss++
      if (f.realizedProfit > 0) c.profit++
      if (f.receivable > 0) c.receivable++
      if (f.payable > 0) c.payable++
      if (f.invoiceStatus === "unmatched") c.unmatched++
      if (f.attention) c.attention++
    }
    return c
  }, [all])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = all.filter((f) => matchesStatus(f, status))
    if (q) {
      list = list.filter(
        (f) =>
          f.number.toLowerCase().includes(q) ||
          f.item.toLowerCase().includes(q) ||
          f.participants.some((p) => p.name.toLowerCase().includes(q)),
      )
    }
    list = [...list].sort((a, b) => {
      if (sort === "recent") return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
      if (sort === "profit") return b.realizedProfit - a.realizedProfit
      return b.totalSell - a.totalSell
    })
    return list
  }, [all, status, query, sort])

  const totalValue = filtered.reduce((s, f) => s + f.totalSell, 0)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Formulas"
        description="Every transaction as a formula. Filter, search, and drill into any deal."
        actions={<CreateFormulaButton />}
      />

      <FormulaFilters query={query} onQuery={setQuery} status={status} onStatus={setStatus} counts={counts} />

      {status !== "all" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Filtered by</span>
          <button
            type="button"
            onClick={() => setStatus("all")}
            className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/15"
          >
            {filterLabels[status]}
            <span className="tabular-nums text-accent/70">{counts[status] ?? 0}</span>
            <X className="size-3" />
          </button>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{filtered.length}</span> formulas ·{" "}
          <span className="font-semibold text-foreground">{formatCurrency(totalValue, { compact: true })}</span> total value
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="size-3.5 text-muted-foreground" />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-foreground outline-none focus:border-accent"
            >
              <option value="recent">Most recent</option>
              <option value="profit">Highest profit</option>
              <option value="value">Largest value</option>
            </select>
          </div>
          <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
            <button
              type="button"
              onClick={() => setView("table")}
              aria-label="Table view"
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
              aria-label="Card view"
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
            <FormulaTable formulas={filtered} />
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((f) => (
              <FormulaCard key={f.id} formula={f} />
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
              {query ? "No formulas match your search" : EMPTY_STATES[status].title}
            </p>
            <p className="text-sm text-muted-foreground">
              {query ? `Nothing matches “${query}”. Try a different term.` : EMPTY_STATES[status].description}
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
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export default function FormulasPage() {
  return (
    <Suspense fallback={<div className="animate-fade-in" />}>
      <FormulasContent />
    </Suspense>
  )
}
