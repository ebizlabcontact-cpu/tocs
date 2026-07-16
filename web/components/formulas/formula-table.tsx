"use client"

import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import type { Formula } from "@/lib/types"
import { formulaStatusLabel, statusConfig } from "@/lib/status"
import { StatusBadge } from "@/components/ui/badge"
import { t } from "@/lib/i18n"
import { formulaListTradeTypeLabel } from "@/lib/formula-list-labels"
import { cn, formatCurrency } from "@/lib/utils"
import { viewFormula } from "@/lib/formula-math"

export function FormulaTable({
  formulas,
  operatingId,
  analyticsId,
  detailQuery = "",
}: {
  formulas: Formula[]
  operatingId: string
  analyticsId?: string
  /** Query string carrying drill-down context into Formula Detail (P0-5). */
  detailQuery?: string
}) {
  const router = useRouter()

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("formulas.list.table.formulaNumber")}
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("formulas.list.table.item")}
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("formulas.list.table.expectedProfit")}
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("formulas.list.table.realizedProfit")}
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("formulas.list.table.receivable")}
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("formulas.list.table.payable")}
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("formulas.list.table.status")}
              </th>
            </tr>
          </thead>
          <tbody>
            {formulas.map((f) => {
              const status = statusConfig[f.status]
              const v = viewFormula(f, operatingId, analyticsId)
              const isLoss = v.realizedProfit < 0
              return (
                <tr
                  key={f.id}
                  onClick={() => router.push(`/formulas/${f.id}${detailQuery}`)}
                  className="cursor-pointer border-b border-border/70 transition-colors last:border-0 hover:bg-muted/40"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-foreground">{f.number}</span>
                      {f.attention && <AlertTriangle className="size-3.5 shrink-0 text-danger" />}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground">{f.item}</span>
                      <span className="text-xs text-muted-foreground">{formulaListTradeTypeLabel(f.tradeType)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(v.expectedProfit, { compact: true })}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-semibold tabular-nums",
                      v.realizedProfit === 0 ? "text-muted-foreground" : isLoss ? "text-danger" : "text-success",
                    )}
                  >
                    {v.realizedProfit === 0 ? "—" : formatCurrency(v.realizedProfit, { compact: true })}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {formatCurrency(v.receivable, { compact: true })}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {formatCurrency(v.payable, { compact: true })}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={status.tone}>{formulaStatusLabel(f.status)}</StatusBadge>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
