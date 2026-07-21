"use client"

import { Search, X } from "lucide-react"
import { t, type TranslationKey } from "@/lib/i18n"
import { cn } from "@/lib/utils"

export type StatusFilter =
  | "all"
  | "active"
  | "invoicing"
  | "closeable"
  | "closed"
  | "loss"
  | "profit"
  | "receivable"
  | "payable"
  | "unmatched"
  | "attention"

/** Stable filter IDs remain separate from their translated labels. */
const FILTERS: StatusFilter[] = ["all", "active", "invoicing", "closeable", "closed", "loss"]

const FILTER_LABEL_KEYS: Record<StatusFilter, TranslationKey> = {
  all: "formulas.list.filters.allFormulas",
  active: "formulas.list.filters.active",
  invoicing: "formulas.list.filters.invoicing",
  closeable: "formulas.list.filters.closeable",
  closed: "formulas.list.filters.closed",
  loss: "formulas.list.filters.lossMaking",
  profit: "formulas.list.filters.profitable",
  receivable: "formulas.list.filters.hasReceivable",
  payable: "formulas.list.filters.hasPayable",
  unmatched: "formulas.list.filters.invoiceUnmatched",
  attention: "formulas.list.filters.needsAttention",
}

export function filterLabel(filter: StatusFilter, short = false): string {
  if (short && filter === "all") return t("formulas.list.filters.all")
  if (short && filter === "loss") return t("formulas.list.filters.loss")
  return t(FILTER_LABEL_KEYS[filter])
}

export function FormulaFilters({
  query,
  onQuery,
  status,
  onStatus,
  counts,
}: {
  query: string
  onQuery: (v: string) => void
  status: StatusFilter
  onStatus: (v: StatusFilter) => void
  counts: Partial<Record<StatusFilter, number>>
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t("formulas.list.filters.searchPlaceholder")}
          className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        {query && (
          <button
            onClick={() => onQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={t("formulas.list.filters.clearSearch")}
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const active = status === filter
          return (
            <button
              key={filter}
              onClick={() => onStatus(filter)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground",
              )}
            >
              {filterLabel(filter, true)}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] tabular-nums",
                  active ? "bg-accent-foreground/20 text-accent-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {counts[filter] ?? 0}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
