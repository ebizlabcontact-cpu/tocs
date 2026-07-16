"use client"

import { useState } from "react"
import { ChevronDown, Calculator } from "lucide-react"
import type { Formula } from "@/lib/types"
import { formatCurrency, cn } from "@/lib/utils"
import { deriveExpected, deriveRealized, deriveSettlement } from "@/lib/formula-math"
import { t } from "@/lib/i18n"

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

  const expected = deriveExpected(formula)
  const realized = deriveRealized(formula)
  const settlement = deriveSettlement(formula)
  const expectedRevenue = expected.totalSell
  const expectedCost = expected.totalBuy
  const logisticsCost = expected.cost
  const share = expected.share
  const expectedNet = expected.expectedProfit

  return (
    <div className="space-y-4">
      {/* Full transparency grid */}
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("formulas.detail.overview.expected")}</p>
          <div className="divide-y divide-border">
            <ValueRow label={t("formulas.detail.overview.expectedRevenue")} value={expectedRevenue} tone="pos" />
            <ValueRow label={t("formulas.detail.overview.expectedCost")} value={expectedCost} tone="muted" />
            <ValueRow label={t("formulas.detail.overview.logisticsCost")} value={logisticsCost} tone="muted" />
            <ValueRow label={t("formulas.detail.overview.share")} value={share} tone="muted" />
            <ValueRow label={t("formulas.detail.overview.expectedNetProfit")} value={expectedNet} tone={expectedNet >= 0 ? "pos" : "neg"} strong />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("formulas.detail.overview.realized")}</p>
          <div className="divide-y divide-border">
            <ValueRow label={t("formulas.detail.overview.actualReceipts")} value={realized.actualReceipts} tone="pos" />
            <ValueRow label={t("formulas.detail.overview.actualPayments")} value={realized.actualPayments} tone="muted" />
            <ValueRow
              label={t("formulas.detail.overview.realizedProfit")}
              value={realized.realizedProfit}
              tone={realized.realizedProfit >= 0 ? "pos" : "neg"}
              strong
            />
            <ValueRow label={t("formulas.detail.overview.receivable")} value={settlement.remainingReceivable} />
            <ValueRow label={t("formulas.detail.overview.payable")} value={settlement.remainingPayable} />
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
            {t("formulas.detail.overview.calculationBreakdown")}
          </span>
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("formulas.detail.overview.expectedNetProfit")}
              </p>
              <EqLine label={t("formulas.detail.overview.expectedRevenue")} value={expectedRevenue} />
              <EqLine op="−" label={t("formulas.detail.overview.expectedCost")} value={expectedCost} />
              <EqLine op="−" label={t("formulas.detail.overview.logisticsCost")} value={logisticsCost} />
              <EqLine op="−" label={t("formulas.detail.overview.share")} value={share} />
              <EqLine op="=" label={t("formulas.detail.overview.expectedNetProfit")} value={expectedNet} result />
            </div>
            <div className="space-y-1.5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("formulas.detail.overview.realizedProfit")}
              </p>
              <EqLine label={t("formulas.detail.overview.actualReceipts")} value={realized.actualReceipts} />
              <EqLine op="−" label={t("formulas.detail.overview.actualPayments")} value={realized.actualPayments} />
              <EqLine op="=" label={t("formulas.detail.overview.realizedProfit")} value={realized.realizedProfit} result />
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {t("formulas.detail.overview.calculationNote")}
      </p>
    </div>
  )
}
