import type { Formula } from "@/lib/types"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"

function Term({ label, value, tone }: { label: string; value: number; tone?: "pos" | "neg" | "neutral" }) {
  return (
    <div className="flex flex-col items-center gap-1 px-2">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono text-base font-semibold tabular-nums sm:text-lg",
          tone === "pos" && "text-success",
          tone === "neg" && "text-danger",
          (!tone || tone === "neutral") && "text-foreground",
        )}
      >
        {formatCurrency(value)}
      </span>
    </div>
  )
}

function Op({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-lg text-muted-foreground sm:text-xl">{children}</span>
}

export function FormulaEquation({ formula }: { formula: Formula }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Profit Formula</h2>
        <span className="text-xs text-muted-foreground">Expected vs Realized</span>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-y-3 rounded-lg bg-secondary/50 p-4">
        <Term label="Sell" value={formula.totalSell} tone="pos" />
        <Op>−</Op>
        <Term label="Buy" value={formula.totalBuy} />
        <Op>−</Op>
        <Term label="Cost" value={formula.cost} />
        <Op>×</Op>
        <Term label="Share" value={formula.share} tone="neutral" />
        <Op>=</Op>
        <Term
          label="Expected"
          value={formula.expectedProfit}
          tone={formula.expectedProfit >= 0 ? "pos" : "neg"}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Expected Profit</p>
          <p className="mt-1 font-mono text-xl font-bold tabular-nums text-foreground">
            {formatCurrency(formula.expectedProfit)}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Realized Profit</p>
          <p
            className={cn(
              "mt-1 font-mono text-xl font-bold tabular-nums",
              formula.realizedProfit >= 0 ? "text-success" : "text-danger",
            )}
          >
            {formatCurrency(formula.realizedProfit)}
          </p>
        </div>
      </div>
    </div>
  )
}
