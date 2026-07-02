"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Filter } from "lucide-react"
import { getAccessibleCompanies } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

/**
 * Analytical company filter for Dashboard / Reports.
 *
 * This is NOT the header company switcher (which sets operating / permission /
 * write / API scope). This filter only answers: "Show Formula-derived metrics
 * from this company's perspective." Its options are the companies appearing at
 * least once inside the currently accessible Formula set — never the full
 * company master.
 */
export function AnalyticsCompanyFilter({
  operatingId,
  value,
  onChange,
}: {
  operatingId: string
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  const accessible = React.useMemo(() => getAccessibleCompanies(operatingId), [operatingId])

  const options = React.useMemo(
    () => [
      { id: operatingId, label: "All in scope", perspective: false },
      ...accessible.map((c) => ({ id: c.id, label: c.name, color: c.color, short: c.shortName, perspective: true })),
    ],
    [operatingId, accessible],
  )

  const active = options.find((o) => o.id === value) ?? options[0]

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        <Filter className="size-3.5 text-muted-foreground" />
        <span className="max-w-[8rem] truncate">{active.label}</span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-popover p-1.5 shadow-[var(--shadow-lifted)] animate-fade-in">
          <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Analytics perspective</p>
          {options.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                onChange(o.id)
                setOpen(false)
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-2 text-sm transition-colors hover:bg-secondary",
                o.id === value && "bg-secondary",
              )}
            >
              <span className="flex-1 text-left font-medium">{o.label}</span>
              {o.id === value && <Check className="size-4 text-accent" />}
            </button>
          ))}
          <p className="px-2 pb-1 pt-2 text-[11px] leading-relaxed text-muted-foreground">
            Company filters analyze formulas from a selected company&apos;s perspective. Options come from the
            accessible formula set, not the company master.
          </p>
        </div>
      )}
    </div>
  )
}
