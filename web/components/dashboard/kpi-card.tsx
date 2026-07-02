import Link from "next/link"
import { ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react"
import type { Kpi } from "@/lib/types"
import { cn, formatCurrency, formatNumber } from "@/lib/utils"

const intentAccent: Record<Kpi["intent"], string> = {
  neutral: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
}

const intentDot: Record<Kpi["intent"], string> = {
  neutral: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
}

export function KpiCard({ kpi }: { kpi: Kpi }) {
  const display = kpi.count ? formatNumber(kpi.value) : formatCurrency(kpi.value, { compact: true })

  return (
    <Link
      href={kpi.drillTo}
      className="group relative flex flex-col justify-between rounded-[var(--radius-xl)] border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:border-accent/40 hover:shadow-[var(--shadow-lifted)]"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("size-1.5 rounded-full", intentDot[kpi.intent])} />
          <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
        </div>
        <ArrowUpRight className="size-4 text-muted-foreground/50 transition-colors group-hover:text-accent" />
      </div>

      <div className="mt-3">
        <p className={cn("text-xl font-semibold tracking-tight tabular-nums", intentAccent[kpi.intent])}>
          {display}
        </p>
        {kpi.delta !== undefined && (
          <p
            className={cn(
              "mt-1 flex items-center gap-1 text-xs font-medium",
              kpi.delta >= 0 ? "text-success" : "text-danger",
            )}
          >
            {kpi.delta >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {Math.abs(kpi.delta)}% vs prev.
          </p>
        )}
      </div>
    </Link>
  )
}
