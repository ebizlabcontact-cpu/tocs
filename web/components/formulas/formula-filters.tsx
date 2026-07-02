"use client"

import { Search, X } from "lucide-react"
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

/** Primary filter tabs shown in the bar. Other filters arrive via KPI drill-down. */
const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "invoicing", label: "Invoicing" },
  { key: "closeable", label: "Closeable" },
  { key: "closed", label: "Closed" },
  { key: "loss", label: "Loss" },
]

/** Human labels for every filter, including drill-down-only ones. */
export const filterLabels: Record<StatusFilter, string> = {
  all: "All formulas",
  active: "Active",
  invoicing: "Invoicing",
  closeable: "Closeable",
  closed: "Closed",
  loss: "Loss-making",
  profit: "Profitable",
  receivable: "Has receivable",
  payable: "Has payable",
  unmatched: "Invoice unmatched",
  attention: "Needs attention",
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
          placeholder="Search by number, item, or counterparty..."
          className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-10 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        {query && (
          <button
            onClick={() => onQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = status === f.key
          return (
            <button
              key={f.key}
              onClick={() => onStatus(f.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                active
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-accent/40 hover:text-foreground",
              )}
            >
              {f.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] tabular-nums",
                  active ? "bg-accent-foreground/20 text-accent-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {counts[f.key] ?? 0}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
