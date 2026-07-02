import Link from "next/link"
import { ArrowUpRight, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react"
import type { Formula } from "@/lib/types"
import { statusConfig, tradeTypeConfig } from "@/lib/status"
import { StatusBadge } from "@/components/ui/badge"
import { cn, formatCurrency, formatRelative } from "@/lib/utils"

function Metric({ label, value, tone }: { label: string; value: string; tone?: "profit" | "loss" | "muted" }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums",
          tone === "profit" && "text-success",
          tone === "loss" && "text-danger",
          (!tone || tone === "muted") && "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  )
}

export function FormulaCard({ formula }: { formula: Formula }) {
  const status = statusConfig[formula.status]
  const isLoss = formula.realizedProfit < 0
  const profitValue = formula.status === "closed" || formula.realizedProfit !== 0 ? formula.realizedProfit : formula.expectedProfit
  const profitIsRealized = formula.realizedProfit !== 0 || formula.status === "closed"

  return (
    <Link
      href={`/formulas/${formula.id}`}
      className="group relative flex flex-col rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:border-accent/40 hover:shadow-[var(--shadow-lifted)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-foreground">{formula.number}</span>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {formula.item} · {tradeTypeConfig[formula.tradeType].label}
          </p>
        </div>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-accent" />
      </div>

      {formula.attention && (
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-danger/8 px-2.5 py-1.5 text-xs font-medium text-danger">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="truncate">{formula.attention}</span>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
        <Metric label="Sell" value={formatCurrency(formula.totalSell, { compact: true })} />
        <Metric label="Buy" value={formatCurrency(formula.totalBuy, { compact: true })} />
        <Metric
          label={profitIsRealized ? "Realized" : "Expected"}
          value={formatCurrency(profitValue, { compact: true })}
          tone={isLoss ? "loss" : "profit"}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          {isLoss ? <TrendingDown className="size-3.5 text-danger" /> : <TrendingUp className="size-3.5 text-success" />}
          Receivable {formatCurrency(formula.receivable, { compact: true })}
        </span>
        <span>{formatRelative(formula.updatedAt)}</span>
      </div>
    </Link>
  )
}
