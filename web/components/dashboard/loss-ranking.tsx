import Link from "next/link"
import type { Formula } from "@/lib/types"
import { formatSignedCurrency } from "@/lib/utils"

export function LossRanking({ formulas }: { formulas: Formula[] }) {
  if (formulas.length === 0) {
    return (
      <div className="flex h-full min-h-40 flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium text-foreground">No loss formulas</p>
        <p className="text-xs text-muted-foreground">Every formula is currently profitable.</p>
      </div>
    )
  }

  const max = Math.max(...formulas.map((f) => Math.abs(f.realizedProfit)))

  return (
    <div className="flex flex-col gap-3">
      {formulas.map((f, i) => (
        <Link
          key={f.id}
          href={`/formulas/${f.id}`}
          className="group flex items-center gap-3 rounded-[var(--radius-md)] p-1.5 transition-colors hover:bg-secondary"
        >
          <span className="w-4 text-xs font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-foreground group-hover:text-accent">
                {f.number}
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-danger">
                {formatSignedCurrency(f.realizedProfit, { compact: true })}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-danger-soft">
              <div
                className="h-full rounded-full bg-danger"
                style={{ width: `${(Math.abs(f.realizedProfit) / max) * 100}%` }}
              />
            </div>
          </div>
        </Link>
      ))}
    </div>
  )
}
