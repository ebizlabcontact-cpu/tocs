import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import type { Formula } from "@/lib/types"
import { Badge } from "@/components/ui/badge"
import { formulaStatusLabel, statusConfig } from "@/lib/status"
import { t } from "@/lib/i18n"
import { cn, formatDate, formatSignedCurrency } from "@/lib/utils"
import { deriveRealized } from "@/lib/formula-math"

function formatDashboardRelative(date: string | Date) {
  const value = typeof date === "string" ? new Date(date) : date
  const days = Math.floor((Date.now() - value.getTime()) / 86400000)
  if (days <= 0) return t("dashboard.relativeTime.today")
  if (days === 1) return t("dashboard.relativeTime.yesterday")
  if (days < 7) return t("dashboard.relativeTime.daysAgo", { count: days })
  if (days < 30) return t("dashboard.relativeTime.weeksAgo", { count: Math.floor(days / 7) })
  return formatDate(value)
}

function attentionLabel(attention: string) {
  const keys = {
    negativeProfit: "dashboard.attention.negativeProfit",
    invoiceUnmatched: "dashboard.attention.invoiceUnmatched",
    paymentOverdue: "dashboard.attention.paymentOverdue",
  } as const
  return attention in keys
    ? t(keys[attention as keyof typeof keys])
    : t("dashboard.attention.generic")
}

export function FormulaMiniRow({ formula, showAttention }: { formula: Formula; showAttention?: boolean }) {
  const status = statusConfig[formula.status]
  const realizedProfit = deriveRealized(formula).realizedProfit
  const isLoss = realizedProfit < 0

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
          <Badge tone={status.tone as never}>{formulaStatusLabel(formula.status)}</Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {formula.item}
          {showAttention && formula.attention && (
            <span className="ml-1.5 inline-flex items-center gap-1 text-danger">
              <AlertTriangle className="size-3" />
              {attentionLabel(formula.attention)}
            </span>
          )}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn("text-sm font-semibold tabular-nums", isLoss ? "text-danger" : "text-foreground")}>
          {formatSignedCurrency(realizedProfit, { compact: true })}
        </p>
        <p className="text-xs text-muted-foreground">{formatDashboardRelative(formula.updatedAt)}</p>
      </div>
    </Link>
  )
}
