import { formatCurrency, cn } from "@/lib/utils"
import type { WizardState } from "./types"
import { Sparkles } from "lucide-react"

export function FormulaPreview({ state }: { state: WizardState }) {
  const sell = state.lines.reduce((s, l) => s + (l.sell || 0), 0)
  const buy = state.lines.reduce((s, l) => s + (l.buy || 0), 0)
  const cost = state.costs.reduce((s, c) => s + (c.amount || 0), 0)
  const gross = sell - buy - cost
  const share = gross * (state.sharePct / 100)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Sparkles className="size-4" />
        </span>
        <h3 className="text-sm font-semibold text-foreground">Live Formula</h3>
      </div>

      <div className="space-y-2.5">
        <Row label="Sell total" value={sell} tone="pos" />
        <Row label="Buy total" value={buy} minus />
        <Row label="Costs" value={cost} minus />
        <div className="border-t border-dashed border-border pt-2.5">
          <Row label="Gross margin" value={gross} tone={gross >= 0 ? "pos" : "neg"} bold />
        </div>
        <Row label={`Your share (${state.sharePct}%)`} value={share} tone={share >= 0 ? "pos" : "neg"} />
      </div>

      <div className="mt-4 rounded-lg bg-secondary/60 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Expected Profit</p>
        <p
          className={cn(
            "mt-1 font-mono text-2xl font-bold tabular-nums",
            share >= 0 ? "text-success" : "text-danger",
          )}
        >
          {formatCurrency(share)}
        </p>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        This is an <span className="font-medium text-foreground">estimate</span>. Realized profit is
        calculated only from actual receipts and payments after settlement.
      </p>
    </div>
  )
}

function Row({
  label,
  value,
  tone,
  minus,
  bold,
}: {
  label: string
  value: number
  tone?: "pos" | "neg"
  minus?: boolean
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums",
          bold ? "font-bold" : "font-medium",
          tone === "pos" && "text-success",
          tone === "neg" && "text-danger",
          !tone && "text-foreground",
        )}
      >
        {minus && value > 0 ? "−" : ""}
        {formatCurrency(Math.abs(value))}
      </span>
    </div>
  )
}
