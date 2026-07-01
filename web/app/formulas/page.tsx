"use client"

import { Suspense, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Plus, ArrowUpDown } from "lucide-react"
import { useCompany } from "@/components/company-context"
import { PageHeader } from "@/components/page-header"
import { buttonVariants } from "@/components/ui/button"
import { FormulaCard } from "@/components/formulas/formula-card"
import { FormulaFilters, type StatusFilter } from "@/components/formulas/formula-filters"
import { getFormulasByCompany } from "@/lib/mock-data"
import { cn, formatCurrency } from "@/lib/utils"
import type { Formula } from "@/lib/types"

type SortKey = "recent" | "profit" | "value"

function matchesStatus(f: Formula, status: StatusFilter) {
  if (status === "all") return true
  if (status === "loss") return f.realizedProfit < 0
  if (status === "closeable") return f.closeable
  return f.status === status
}

const VALID_FILTERS: StatusFilter[] = ["all", "active", "invoicing", "closeable", "closed", "loss"]

function FormulasContent() {
  const { selected } = useCompany()
  const params = useSearchParams()
  const initialFilter = params.get("filter") as StatusFilter | null
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>(
    initialFilter && VALID_FILTERS.includes(initialFilter) ? initialFilter : "all",
  )
  const [sort, setSort] = useState<SortKey>("recent")

  const all = useMemo(() => getFormulasByCompany(selected.id), [selected.id])

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: all.length, active: 0, invoicing: 0, closeable: 0, closed: 0, loss: 0 }
    for (const f of all) {
      if (f.status === "active") c.active++
      if (f.status === "invoicing") c.invoicing++
      if (f.closeable) c.closeable++
      if (f.status === "closed") c.closed++
      if (f.realizedProfit < 0) c.loss++
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
        actions={
          <Link href="/formulas/new" className={cn(buttonVariants({ variant: "accent" }), "gap-2")}>
            <Plus className="size-4" />
            Create Formula
          </Link>
        }
      />

      <FormulaFilters query={query} onQuery={setQuery} status={status} onStatus={setStatus} counts={counts} />

      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{filtered.length}</span> formulas ·{" "}
          <span className="font-semibold text-foreground">{formatCurrency(totalValue, { compact: true })}</span> total value
        </p>
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
      </div>

      {filtered.length > 0 ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((f) => (
            <FormulaCard key={f.id} formula={f} />
          ))}
        </div>
      ) : (
        <div className="mt-16 flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm font-medium text-foreground">No formulas match your filters</p>
          <p className="text-sm text-muted-foreground">Try adjusting your search or status filter.</p>
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
