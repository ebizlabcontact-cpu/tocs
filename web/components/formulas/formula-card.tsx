import Link from "next/link"
import { ArrowUpRight, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react"
import type { Formula } from "@/lib/types"
import { formulaStatusLabel, statusConfig } from "@/lib/status"
import { StatusBadge } from "@/components/ui/badge"
import { t } from "@/lib/i18n"
import { formulaListAttentionLabel, formulaListRelativeTime, formulaListTradeTypeLabel } from "@/lib/formula-list-labels"
import { cn, formatCurrency } from "@/lib/utils"
import { viewFormula } from "@/lib/formula-math"

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

export function FormulaCard({
  formula,
  operatingId,
  analyticsId,
  detailQuery = "",
}: {
  formula: Formula
  operatingId: string
  analyticsId?: string
  /** Query string carrying drill-down context into Formula Detail (P0-5). */
  detailQuery?: string
}) {
  const status = statusConfig[formula.status]
  const v = viewFormula(formula, operatingId, analyticsId)
  const isLoss = v.realizedProfit < 0
  const profitIsRealized = v.realizedProfit !== 0 || formula.status === "closed"
  const profitValue = profitIsRealized ? v.realizedProfit : v.expectedProfit

  return (
    <Link
      href={`/formulas/${formula.id}${detailQuery}`}
      className="group relative flex flex-col rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:border-accent/40 hover:shadow-[var(--shadow-lifted)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-foreground">{formula.number}</span>
            <StatusBadge tone={status.tone}>{formulaStatusLabel(formula.status)}</StatusBadge>
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {formula.item} · {formulaListTradeTypeLabel(formula.tradeType)}
          </p>
        </div>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-accent" />
      </div>

      {formula.attention && (
        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-danger/8 px-2.5 py-1.5 text-xs font-medium text-danger">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="truncate">{formulaListAttentionLabel(formula.attention)}</span>
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-3">
        <Metric label={t("formulas.list.card.sell")} value={formatCurrency(v.totalSell, { compact: true })} />
        <Metric label={t("formulas.list.card.buy")} value={formatCurrency(v.totalBuy, { compact: true })} />
        <Metric
          label={profitIsRealized ? t("formulas.list.card.realized") : t("formulas.list.card.expected")}
          value={formatCurrency(profitValue, { compact: true })}
          tone={isLoss ? "loss" : "profit"}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          {isLoss ? <TrendingDown className="size-3.5 text-danger" /> : <TrendingUp className="size-3.5 text-success" />}
          {t("formulas.list.card.receivable", { value: formatCurrency(v.receivable, { compact: true }) })}
        </span>
        <span>{formulaListRelativeTime(formula.updatedAt)}</span>
      </div>
    </Link>
  )
}
