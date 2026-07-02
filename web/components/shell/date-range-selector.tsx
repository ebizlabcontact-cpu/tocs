"use client"

import * as React from "react"
import { Calendar, ChevronDown } from "lucide-react"
import { cn, formatDate } from "@/lib/utils"
import { useDateRange } from "@/components/date-range-context"

export function DateRangeSelector() {
  const { ranges, range, setRange, customStart, customEnd, setCustomStart, setCustomEnd } = useDateRange()
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const isCustom = range === "Custom Range"
  const label =
    isCustom && customStart && customEnd
      ? `${formatDate(customStart, { month: "short", day: "numeric" })} – ${formatDate(customEnd, { month: "short", day: "numeric" })}`
      : range

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        <Calendar className="size-4 text-muted-foreground" />
        <span className="hidden sm:inline">{label}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-50 w-60 rounded-[var(--radius-lg)] border border-border bg-popover p-1.5 shadow-[var(--shadow-lifted)] animate-fade-in">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => {
                setRange(r)
                if (r !== "Custom Range") setOpen(false)
              }}
              className={cn(
                "flex w-full items-center rounded-[var(--radius-sm)] px-2 py-2 text-sm transition-colors hover:bg-secondary",
                r === range && "bg-secondary font-medium",
              )}
            >
              {r}
            </button>
          ))}

          {isCustom && (
            <div className="mt-1.5 space-y-2 border-t border-border px-2 pb-1 pt-2.5">
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Start Date
                </span>
                <input
                  type="date"
                  value={customStart}
                  max={customEnd || undefined}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full rounded-[var(--radius-sm)] border border-border bg-card px-2 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  End Date
                </span>
                <input
                  type="date"
                  value={customEnd}
                  min={customStart || undefined}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full rounded-[var(--radius-sm)] border border-border bg-card px-2 py-1.5 text-sm text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring/40"
                />
              </label>
              <button
                onClick={() => setOpen(false)}
                className="w-full rounded-[var(--radius-sm)] bg-accent px-2 py-1.5 text-xs font-semibold text-accent-foreground transition-colors hover:opacity-90"
              >
                Apply Range
              </button>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Prototype selector — UI state only. Authoritative period filtering runs in backend services after
                integration.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
