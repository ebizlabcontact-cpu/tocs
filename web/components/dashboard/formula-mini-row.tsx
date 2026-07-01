import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import type { Formula } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { statusConfig } from "@/lib/status"
import { cn, formatSignedCurrency, formatRelative } from "@/lib/utils"

export function FormulaMiniRow({ formula, showAttention }: { formula: Formula; showAttention?: boolean }) {
  const status = statusConfig[formula.status]
  const isLoss = formula.realizedProfit < 0

  return (
    <Link
      href={`/formulas/${formula.id}`}
      className={cn(
        "group flex items-center gap-3 rounded-[var(--radius-md)] border border-transparent p-2.5 transition-colors hover:bg-secondary",
        isLoss && "bg-danger-soft/40 hover:bg-danger-soft",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground group-hover:text-accent">{formula.number}</span>
          <Badge tone={status.tone as never}>{status.label}</Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {formula.item}
          {showAttention && formula.attention && (
            <span className="ml-1.5 inline-flex items-center gap-1 text-danger">
              <AlertTriangle className="size-3" />
              {formula.attention}
            </span>
          )}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("text-sm font-semibold tabular-nums", isLoss ? "text-danger" : "text-foreground")}>
          {formatSignedCurrency(formula.realizedProfit, { compact: true })}
        </p>
        <p className="text-xs text-muted-foreground">{formatRelative(formula.updatedAt)}</p>
      </div>
    </Link>
  )
}
