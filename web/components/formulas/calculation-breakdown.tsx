"use client"

import { useState } from "react"
import { ChevronDown, Calculator } from "lucide-react"
import type { Formula } from "@/lib/types"
import { formatCurrency, cn } from "@/lib/utils"

function ValueRow({
  label,
  value,
  tone,
  strong,
}: {
  label: string
  value: number
  tone?: "pos" | "neg" | "muted"
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className={cn("text-sm", strong ? "font-semibold text-foreground" : "text-muted-foreground")}>
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-sm tabular-nums",
          strong && "font-bold",
          tone === "pos" && "text-success",
          tone === "neg" && "text-danger",
          tone === "muted" && "text-muted-foreground",
          !tone && "text-foreground",
        )}
      >
        {formatCurrency(value)}
      </span>
    </div>
  )
}

/** A single line in the expandable equation: operator + label + amount. */
function EqLine({ op, label, value, result }: { op?: string; label: string; value: number; result?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-md px-3 py-2",
        result ? "bg-accent-soft" : "bg-secondary/40",
      )}
    >
      <span className="flex items-center gap-2 text-sm">
        <span className="w-4 text-center font-mono text-muted-foreground">{op ?? ""}</span>
        <span className={cn(result ? "font-semibold text-foreground" : "text-muted-foreground")}>{label}</span>
      </span>
      <span
        className={cn(
          "font-mono text-sm tabular-nums",
          result ? "font-bold text-foreground" : "text-foreground",
        )}
      >
        {formatCurrency(value)}
      </span>
    </div>
  )
}

export function CalculationBreakdown({ formula }: { formula: Formula }) {
  const [open, setOpen] = useState(false)

  const expectedRevenue = formula.totalSell
  const expectedCost = formula.totalBuy
  const logisticsCost = formula.cost
  const share = formula.share
  const expectedNet = formula.expectedProfit

  return (
    <div className="space-y-4">
      {/* Full transparency grid */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expected</p>
          <div className="divide-y divide-border">
            <ValueRow label="Expected Revenue" value={expectedRevenue} tone="pos" />
            <ValueRow label="Expected Cost" value={expectedCost} tone="muted" />
            <ValueRow label="Logistics Cost" value={logisticsCost} tone="muted" />
            <ValueRow label="Share" value={share} tone="muted" />
            <ValueRow label="Expected Net Profit" value={expectedNet} tone={expectedNet >= 0 ? "pos" : "neg"} strong />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Realized</p>
          <div className="divide-y divide-border">
            <ValueRow label="Actual Receipts" value={formula.actualReceipts} tone="pos" />
            <ValueRow label="Actual Payments" value={formula.actualPayments} tone="muted" />
            <ValueRow
              label="Realized Profit"
              value={formula.realizedProfit}
              tone={formula.realizedProfit >= 0 ? "pos" : "neg"}
              strong
            />
            <ValueRow label="Receivable" value={formula.receivable} />
            <ValueRow label="Payable" value={formula.payable} />
          </div>
        </div>
      </div>

      {/* Expandable equation */}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
          aria-expanded={open}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Calculator className="size-4 text-accent" />
            Calculation Breakdown
          </span>
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Expected Net Profit
              </p>
              <EqLine label="Expected Revenue" value={expectedRevenue} />
              <EqLine op="−" label="Expected Cost" value={expectedCost} />
              <EqLine op="−" label="Logistics Cost" value={logisticsCost} />
              <EqLine op="−" label="Share" value={share} />
              <EqLine op="=" label="Expected Net Profit" value={expectedNet} result />
            </div>
            <div className="space-y-1.5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Realized Profit
              </p>
              <EqLine label="Actual Receipts" value={formula.actualReceipts} />
              <EqLine op="−" label="Actual Payments" value={formula.actualPayments} />
              <EqLine op="=" label="Realized Profit" value={formula.realizedProfit} result />
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Figures are illustrative mock calculations. Realized profit is recognized at settlement.
      </p>
    </div>
  )
}
