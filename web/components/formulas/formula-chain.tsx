import type { Formula, Participant } from "@/lib/types"
import { formatCurrency, formatNumber, cn } from "@/lib/utils"
import { deriveChainFinancials } from "@/lib/derive"
import { ArrowRight } from "lucide-react"

const roleTone: Record<Participant["role"], string> = {
  seller: "bg-accent-soft text-accent border-accent/30",
  buyer: "bg-info-soft text-info border-info/30",
  agent: "bg-secondary text-foreground border-border",
  logistics: "bg-warning-soft text-warning border-warning/30",
  financier: "bg-success-soft text-success border-success/30",
}

function marginOf(p: Participant): number | null {
  if (p.buyPrice == null || p.sellPrice == null) return null
  if (p.sellPrice === 0 || p.buyPrice === 0) return null
  return (p.sellPrice - p.buyPrice) * (p.quantity ?? 1)
}

/**
 * Read-only visualization of a formula's participant chain
 * (A → B → C → D → E). Renders both a horizontal flow of nodes and a
 * per-hop table with quantity, buy/sell price, and margin.
 */
export function FormulaChainView({ formula }: { formula: Formula }) {
  const chain = [...formula.participants]
    .filter((p) => p.chainOrder != null)
    .sort((a, b) => (a.chainOrder ?? 0) - (b.chainOrder ?? 0))

  // Only render the rich chain view when the formula carries ordered chain data.
  if (chain.length < 3) return null

  const derived = deriveChainFinancials(formula.participants, {
    logisticsCost: formula.cost,
    share: formula.share,
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Participant Chain
        </p>
        <span className="text-xs text-muted-foreground">
          {chain.length} parties · {formatNumber(formula.quantity)} {formula.unit}
        </span>
      </div>

      {/* Visual flow */}
      <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
        {chain.map((p, i) => (
          <div key={p.id} className="flex items-stretch gap-2">
            <div className="flex w-40 shrink-0 flex-col rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between">
                <span className="flex size-6 items-center justify-center rounded-md bg-secondary font-mono text-xs font-semibold text-muted-foreground">
                  {String.fromCharCode(65 + i)}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize",
                    roleTone[p.role],
                  )}
                >
                  {p.role}
                </span>
              </div>
              <p className="mt-2 truncate text-sm font-semibold text-foreground" title={p.company}>
                {p.company}
              </p>
              {p.nature && <p className="truncate text-xs text-muted-foreground">{p.nature}</p>}
              {p.sellPrice != null && p.sellPrice > 0 && (
                <p className="mt-2 font-mono text-xs text-foreground">
                  {formatCurrency(p.sellPrice)}
                </p>
              )}
            </div>
            {i < chain.length - 1 && (
              <div className="flex items-center text-muted-foreground">
                <ArrowRight className="size-4" aria-hidden="true" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Per-hop table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">Participant chain pricing by party</caption>
          <thead>
            <tr className="border-b border-border bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-3 py-2 font-medium">Party</th>
              <th scope="col" className="px-3 py-2 font-medium">Role</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Quantity</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Buy Price</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Sell Price</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Margin</th>
            </tr>
          </thead>
          <tbody>
            {chain.map((p) => {
              const margin = marginOf(p)
              return (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <span className="font-medium text-foreground">{p.company}</span>
                    {p.nature && (
                      <span className="ml-1 text-xs text-muted-foreground">· {p.nature}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 capitalize text-muted-foreground">{p.role}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {p.quantity != null ? formatNumber(p.quantity) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {p.buyPrice ? formatCurrency(p.buyPrice) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs">
                    {p.sellPrice ? formatCurrency(p.sellPrice) : "—"}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-mono text-xs",
                      margin != null && margin > 0 ? "text-success" : "text-muted-foreground",
                    )}
                  >
                    {margin != null ? formatCurrency(margin) : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {derived && (
        <div className="rounded-lg border border-border bg-secondary/40 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Derived from Chain
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <DerivedStat label="Expected Revenue" value={derived.expectedRevenue} tone="pos" />
            <DerivedStat label="Expected Cost" value={derived.expectedCost} />
            <DerivedStat
              label="Gross Margin"
              value={derived.grossMargin}
              tone={derived.grossMargin >= 0 ? "pos" : "neg"}
            />
            <DerivedStat
              label="Expected Profit"
              value={derived.expectedProfit}
              tone={derived.expectedProfit >= 0 ? "pos" : "neg"}
            />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Illustrative preview — figures are derived from Formula inputs (revenue from the end buyer, cost from the
            origin, margin from the chain spread). Authoritative values come from backend services after integration.
          </p>
        </div>
      )}
    </div>
  )
}

function DerivedStat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: "pos" | "neg"
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-mono text-sm font-semibold tabular-nums",
          tone === "pos" && "text-success",
          tone === "neg" && "text-danger",
          !tone && "text-foreground",
        )}
      >
        {formatCurrency(value)}
      </p>
    </div>
  )
}
