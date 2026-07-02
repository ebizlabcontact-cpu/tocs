"use client"

import { useMemo, useState } from "react"
import { ArrowRight, RotateCcw, Wand2, GitCommitVertical } from "lucide-react"
import type { Formula } from "@/lib/types"
import { simulateFormulaEdit, type EditSimResult } from "@/lib/derive"
import { formatCurrency, formatNumber, cn } from "@/lib/utils"
import { Input } from "@/components/ui/field"
import { Button } from "@/components/ui/button"

/** Fields the user can tweak in the simulation. */
export type SimEdit = {
  quantity: number
  sellUnitPrice: number
}

export function FormulaEditSimulation({
  formula,
  onCapture,
}: {
  formula: Formula
  onCapture?: (edit: SimEdit, before: EditSimResult, after: EditSimResult) => void
}) {
  const baseQty = formula.quantity || 1
  const baseSellUnit = Math.round(formula.totalSell / baseQty)

  const [quantity, setQuantity] = useState(baseQty)
  const [sellUnitPrice, setSellUnitPrice] = useState(baseSellUnit)

  const before = useMemo(
    () => simulateFormulaEdit(formula, { quantity: baseQty, sellUnitPrice: baseSellUnit }),
    [formula, baseQty, baseSellUnit],
  )
  const after = useMemo(
    () => simulateFormulaEdit(formula, { quantity, sellUnitPrice }),
    [formula, quantity, sellUnitPrice],
  )

  const dirty = quantity !== baseQty || sellUnitPrice !== baseSellUnit

  function reset() {
    setQuantity(baseQty)
    setSellUnitPrice(baseSellUnit)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-1 flex items-center gap-2">
        <Wand2 className="size-4 text-accent" />
        <h3 className="text-sm font-semibold text-foreground">Simulate a Formula Edit</h3>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        Changing Formula inputs changes all derived values. Adjust the quantity or sell price to preview the impact —
        this is a simulation and nothing is saved.
      </p>

      {/* Editable inputs */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Quantity ({formula.unit})
            <span className="font-mono normal-case tracking-normal text-muted-foreground">
              was {formatNumber(baseQty)}
            </span>
          </span>
          <Input type="number" value={quantity || ""} onChange={(e) => setQuantity(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="mb-1 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Sell Unit Price
            <span className="font-mono normal-case tracking-normal text-muted-foreground">
              was {formatCurrency(baseSellUnit)}
            </span>
          </span>
          <Input
            type="number"
            value={sellUnitPrice || ""}
            onChange={(e) => setSellUnitPrice(Number(e.target.value))}
          />
        </label>
      </div>

      {/* Before / After */}
      <div className="mt-4 space-y-2">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          <span>Before</span>
          <span />
          <span className="text-right">After</span>
        </div>
        <DiffRow label="Quantity" before={`${formatNumber(before.quantity)} ${formula.unit}`} after={`${formatNumber(after.quantity)} ${formula.unit}`} changed={after.quantity !== before.quantity} />
        <DiffRow label="Sell Unit Price" before={formatCurrency(before.sellUnitPrice)} after={formatCurrency(after.sellUnitPrice)} changed={after.sellUnitPrice !== before.sellUnitPrice} />
        <DiffRow label="Expected Revenue" before={formatCurrency(before.expectedRevenue)} after={formatCurrency(after.expectedRevenue)} changed={after.expectedRevenue !== before.expectedRevenue} />
        <DiffRow label="Expected Cost" before={formatCurrency(before.expectedCost)} after={formatCurrency(after.expectedCost)} changed={after.expectedCost !== before.expectedCost} />
        <DiffRow label="Gross Margin" before={formatCurrency(before.grossMargin)} after={formatCurrency(after.grossMargin)} changed={after.grossMargin !== before.grossMargin} />
        <DiffRow
          label="Expected Profit"
          before={formatCurrency(before.expectedProfit)}
          after={formatCurrency(after.expectedProfit)}
          changed={after.expectedProfit !== before.expectedProfit}
          strong
        />
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="ghost" type="button" onClick={reset} disabled={!dirty}>
          <RotateCcw className="size-4" />
          Reset
        </Button>
        {onCapture && (
          <Button
            variant="accent"
            type="button"
            disabled={!dirty}
            onClick={() => onCapture({ quantity, sellUnitPrice }, before, after)}
          >
            <GitCommitVertical className="size-4" />
            Capture as Version
          </Button>
        )}
      </div>
    </div>
  )
}

function DiffRow({
  label,
  before,
  after,
  changed,
  strong,
}: {
  label: string
  before: string
  after: string
  changed?: boolean
  strong?: boolean
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
      <div className="rounded-md border border-border bg-secondary/40 px-2.5 py-1.5">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("font-mono text-xs tabular-nums text-muted-foreground", strong && "font-semibold")}>{before}</p>
      </div>
      <ArrowRight className={cn("size-4 shrink-0", changed ? "text-accent" : "text-muted-foreground/40")} aria-hidden />
      <div
        className={cn(
          "rounded-md border px-2.5 py-1.5 text-right",
          changed ? "border-accent/40 bg-accent-soft" : "border-border bg-secondary/40",
        )}
      >
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={cn(
            "font-mono text-xs tabular-nums",
            changed ? "text-accent" : "text-foreground",
            strong && "font-semibold",
          )}
        >
          {after}
        </p>
      </div>
    </div>
  )
}
