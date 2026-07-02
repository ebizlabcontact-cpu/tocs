"use client"

import * as React from "react"
import { Calendar, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDateRange } from "@/components/date-range-context"

export function DateRangeSelector() {
  const { ranges, range, setRange } = useDateRange()
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

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
        <Calendar className="size-4 text-muted-foreground" />
        <span className="hidden sm:inline">{range}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-50 w-44 rounded-[var(--radius-lg)] border border-border bg-popover p-1.5 shadow-[var(--shadow-lifted)] animate-fade-in">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => {
                setRange(r)
                setOpen(false)
              }}
              className={cn(
                "flex w-full items-center rounded-[var(--radius-sm)] px-2 py-2 text-sm transition-colors hover:bg-secondary",
                r === range && "bg-secondary font-medium",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
