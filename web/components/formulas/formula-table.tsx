"use client"

import { useRouter } from "next/navigation"
import { AlertTriangle } from "lucide-react"
import type { Formula } from "@/lib/types"
import { statusConfig, tradeTypeConfig } from "@/lib/status"
import { StatusBadge } from "@/components/ui/badge"
import { cn, formatCurrency } from "@/lib/utils"

export function FormulaTable({ formulas }: { formulas: Formula[] }) {
  const router = useRouter()

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Formula No</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Item</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Expected Profit</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Realized Profit</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Receivable</th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Payable</th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {formulas.map((f) => {
              const status = statusConfig[f.status]
              const isLoss = f.realizedProfit < 0
              return (
                <tr
                  key={f.id}
                  onClick={() => router.push(`/formulas/${f.id}`)}
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
                      <span className="text-xs text-muted-foreground">{tradeTypeConfig[f.tradeType].label}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(f.expectedProfit, { compact: true })}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-3 text-right font-semibold tabular-nums",
                      f.realizedProfit === 0 ? "text-muted-foreground" : isLoss ? "text-danger" : "text-success",
                    )}
                  >
                    {f.realizedProfit === 0 ? "—" : formatCurrency(f.realizedProfit, { compact: true })}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {formatCurrency(f.receivable, { compact: true })}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-foreground">
                    {formatCurrency(f.payable, { compact: true })}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
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
