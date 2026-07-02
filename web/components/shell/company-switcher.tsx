"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Building2 } from "lucide-react"
import { useCompany } from "@/components/company-context"
import { cn } from "@/lib/utils"

export function CompanySwitcher() {
  const { companies, selected, setCompany, isSuperAdmin } = useCompany()
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const visible = isSuperAdmin ? companies : companies.filter((c) => c.id !== "all")

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        <span
          className="flex size-5 items-center justify-center rounded-md text-[10px] font-bold text-white"
          style={{ backgroundColor: selected.color }}
        >
          {selected.id === "all" ? <Building2 className="size-3" /> : selected.shortName}
        </span>
        <span className="max-w-[7rem] truncate sm:max-w-[10rem]">{selected.name}</span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-50 w-64 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-popover p-1.5 shadow-[var(--shadow-lifted)] animate-fade-in">
          <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Company scope</p>
          {visible.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setCompany(c.id)
                setOpen(false)
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-2 text-sm transition-colors hover:bg-secondary",
                c.id === selected.id && "bg-secondary",
              )}
            >
              <span
                className="flex size-6 items-center justify-center rounded-md text-[10px] font-bold text-white"
                style={{ backgroundColor: c.color }}
              >
                {c.id === "all" ? <Building2 className="size-3.5" /> : c.shortName}
              </span>
              <span className="flex-1 text-left font-medium">{c.name}</span>
              {c.id === selected.id && <Check className="size-4 text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
