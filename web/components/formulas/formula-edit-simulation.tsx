"use client"

import { useMemo, useState } from "react"
import { ArrowRight, RotateCcw, Wand2, GitBranch, AlertTriangle, Info } from "lucide-react"
import type { Formula } from "@/lib/types"
import { simulateFormulaEdit, type EditSimResult } from "@/lib/derive"
import { formatCurrency, formatNumber, cn } from "@/lib/utils"
import { Input } from "@/components/ui/field"
import { Button } from "@/components/ui/button"

/** Fields that create a new Formula Version + Snapshot after backend integration. */
const VERSION_TRIGGER_FIELDS = [
  "Formula quantity",
  "Participant added / deleted",
  "Participant quantity",
  "Buy Unit Price",
  "Sell Unit Price",
  "Contract Exchange Rate",
  "Adjusted Exchange Rate",
  "Logistics Cost",
  "Share Amount",
  "Share Rate",
]

/** Fields that never trigger a version. */
const NON_VERSION_FIELDS = ["sequenceOrder", "roleGroup", "natureGroup", "paymentGroup", "memo fields"]

type Row = { label: string; before: number; after: number; strong?: boolean }

export function FormulaEditSimulation({ formula }: { formula: Formula }) {
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

  const qtyChanged = quantity !== baseQty
  const priceChanged = sellUnitPrice !== baseSellUnit
  const dirty = qtyChanged || priceChanged

  // Both editable inputs (quantity, sell unit price) are version-triggering fields.
  const triggeredFields = [
    qtyChanged && "Formula Quantity",
    priceChanged && "Sell Unit Price",
  ].filter(Boolean) as string[]

  function reset() {
    setQuantity(baseQty)
    setSellUnitPrice(baseSellUnit)
  }

  const expectedRows: Row[] = [
    { label: "Total Sell", before: before.totalSell, after: after.totalSell },
    { label: "Total Buy", before: before.totalBuy, after: after.totalBuy },
    { label: "Costs", before: before.cost, after: after.cost },
    { label: "Share", before: before.share, after: after.share },
    { label: "Expected Net Profit", before: before.expectedProfit, after: after.expectedProfit, strong: true },
  ]

  const settlementRows: Row[] = [
    { label: "Scheduled Receipts", before: before.scheduledReceipts, after: after.scheduledReceipts },
    { label: "Actual Receipts", before: before.actualReceipts, after: after.actualReceipts },
    { label: "Receivable", before: before.receivable, after: after.receivable },
    { label: "Scheduled Payments", before: before.scheduledPayments, after: after.scheduledPayments },
    { label: "Actual Payments", before: before.actualPayments, after: after.actualPayments },
    { label: "Payable", before: before.payable, after: after.payable },
    { label: "Realized Net Profit", before: before.realizedProfit, after: after.realizedProfit, strong: true },
  ]

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-1 flex items-center gap-2">
        <Wand2 className="size-4 text-accent" />
        <h3 className="text-sm font-semibold text-foreground">Preview Edit Impact</h3>
      </div>
      <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
        Adjust the quantity or sell price to preview how derived values could change. Frontend only previews the impact.
        Versions are created by backend services.
      </p>

      {/* Endpoint resolution warning (P0-4) */}
      {!after.endpointsResolved && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-xs leading-relaxed text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Chain endpoints are not fully defined (missing <span className="font-medium">Start</span> /{" "}
            <span className="font-medium">End</span> participant). Total Buy falls back to the stored value instead of
            deriving from the start participant — endpoints are not inferred.
          </span>
        </div>
      )}

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

      {/* Version trigger indicator (P0-1) */}
      {dirty && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2.5 text-xs leading-relaxed text-accent">
          <GitBranch className="mt-0.5 size-4 shrink-0" />
          <span>
            This change would create a new Version + Snapshot after backend integration.
            {triggeredFields.length > 0 && (
              <span className="text-muted-foreground">
                {" "}
                Version-triggering fields edited: {triggeredFields.join(", ")}.
              </span>
            )}
          </span>
        </div>
      )}

      {/* Before / After — Expected (trade definition) */}
      <div className="mt-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Expected · Trade Definition
        </p>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span>Before</span>
            <span />
            <span className="text-right">After</span>
          </div>
          <DiffRow
            label={`Quantity (${formula.unit})`}
            before={formatNumber(before.quantity)}
            after={formatNumber(after.quantity)}
            changed={after.quantity !== before.quantity}
          />
          <DiffRow
            label="Sell Unit Price"
            before={formatCurrency(before.sellUnitPrice)}
            after={formatCurrency(after.sellUnitPrice)}
            changed={after.sellUnitPrice !== before.sellUnitPrice}
          />
          {expectedRows.map((r) => (
            <DiffRow
              key={r.label}
              label={r.label}
              before={formatCurrency(r.before)}
              after={formatCurrency(r.after)}
              changed={r.after !== r.before}
              strong={r.strong}
            />
          ))}
        </div>
      </div>

      {/* Before / After — Settlement (schedules & records only) */}
      <div className="mt-4">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Settlement · From Schedules &amp; Records
          <Info className="size-3" />
        </p>
        <div className="space-y-2">
          {settlementRows.map((r) => (
            <DiffRow
              key={r.label}
              label={r.label}
              before={formatCurrency(r.before)}
              after={formatCurrency(r.after)}
              changed={r.after !== r.before}
              strong={r.strong}
            />
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          Settlement values derive only from Payment Schedules and Records, so they are unaffected by a trade-definition
          preview edit.
        </p>
      </div>

      {/* Field legend */}
      <div className="mt-4 grid gap-2 rounded-lg border border-border bg-secondary/40 p-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-foreground">
            Version-triggering fields
          </p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{VERSION_TRIGGER_FIELDS.join(" · ")}</p>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Non-version fields
          </p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{NON_VERSION_FIELDS.join(" · ")}</p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Preview only. Authoritative recalculation and versioning are performed by backend services after integration.
        </p>
        <Button variant="ghost" type="button" onClick={reset} disabled={!dirty}>
          <RotateCcw className="size-4" />
          Reset
        </Button>
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
