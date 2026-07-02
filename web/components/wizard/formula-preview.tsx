import { formatCurrency, formatNumber, cn } from "@/lib/utils"
import { deriveFormula, type WizardState } from "./types"
import { Sparkles } from "lucide-react"

export function FormulaPreview({ state }: { state: WizardState }) {
  const d = deriveFormula(state)

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Sparkles className="size-4" />
        </span>
        <h3 className="text-sm font-semibold text-foreground">Live Formula</h3>
      </div>

      {/* Construction counters */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        <Counter
          label="Formula Qty"
          value={state.quantity ? `${formatNumber(state.quantity)} ${state.unit}` : `0 ${state.unit}`}
        />
        <Counter label="Participants" value={String(d.participantCount)} />
      </div>
      {d.totalQuantity !== state.quantity && d.totalQuantity > 0 && (
        <p className="mb-3 -mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Participant quantities total {formatNumber(d.totalQuantity)} {state.unit} — individual involvement may differ
          from the formula quantity.
        </p>
      )}

      {/* Progressive money flow */}
      <div className="space-y-2.5">
        <Row label="Expected Revenue" value={d.expectedRevenue} tone="pos" />
        <Row label="Expected Cost" value={d.expectedCost} minus />
        <Row label="Costs" value={d.costs} minus />
        <div className="border-t border-dashed border-border pt-2.5">
          <Row label="Gross Margin" value={d.grossMargin} tone={d.grossMargin >= 0 ? "pos" : "neg"} bold />
        </div>
        <Row label={`Share (${state.sharePct}%)`} value={d.retainedShare} tone={d.retainedShare >= 0 ? "pos" : "neg"} />
      </div>

      <div className="mt-4 rounded-lg bg-secondary/60 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Expected Profit</p>
        <p
          className={cn(
            "mt-1 font-mono text-2xl font-bold tabular-nums",
            d.expectedProfit >= 0 ? "text-success" : "text-danger",
          )}
        >
          {formatCurrency(d.expectedProfit)}
        </p>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        Every figure is <span className="font-medium text-foreground">derived from your Formula inputs</span>.
        Realized profit is calculated only from actual receipts and payments after settlement.
      </p>
    </div>
  )
}

function Counter({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">{value}</p>
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
