"use client"

import { useMemo, useState } from "react"
import { ArrowDownLeft, ArrowUpRight, Landmark } from "lucide-react"
import { formatCurrency, cn } from "@/lib/utils"

/** A single planned money-flow line in a settlement scenario. */
type ScenarioRow = {
  label: string
  flow: "receipt" | "payment"
  /** Portion of the expected total this line represents (0–1). */
  portion: number
  /** Portion of this line that has actually settled so far (0–1). */
  settled: number
}

type Scenario = {
  id: string
  label: string
  note: string
  build: (receipts: number, payments: number) => ScenarioRow[]
}

/**
 * Demonstration-only TOCS settlement scenarios. Each scenario is a planned
 * schedule expressed as portions of the Formula's expected receipts/payments,
 * so every resulting figure still originates from Formula.
 */
const scenarios: Scenario[] = [
  {
    id: "advance",
    label: "Advance Payment",
    note: "Buyer prepays part of the order before delivery.",
    build: () => [
      { label: "Advance receipt", flow: "receipt", portion: 0.3, settled: 1 },
      { label: "Balance on delivery", flow: "receipt", portion: 0.7, settled: 0 },
      { label: "Supplier payment", flow: "payment", portion: 1, settled: 1 },
    ],
  },
  {
    id: "final",
    label: "Final Payment",
    note: "Whole amount settles at the end of the deal.",
    build: () => [
      { label: "Final receipt (on close)", flow: "receipt", portion: 1, settled: 0 },
      { label: "Final payment (on close)", flow: "payment", portion: 1, settled: 0 },
    ],
  },
  {
    id: "credit",
    label: "Credit Terms",
    note: "Buyer pays on Net-30 credit while we settle the supplier now.",
    build: () => [
      { label: "Receipt (Net-30, credit)", flow: "receipt", portion: 1, settled: 0 },
      { label: "Supplier payment (now)", flow: "payment", portion: 1, settled: 1 },
    ],
  },
  {
    id: "split",
    label: "Split Payments",
    note: "Both sides settle across two equal installments.",
    build: () => [
      { label: "Receipt installment 1", flow: "receipt", portion: 0.5, settled: 1 },
      { label: "Receipt installment 2", flow: "receipt", portion: 0.5, settled: 0 },
      { label: "Payment installment 1", flow: "payment", portion: 0.5, settled: 1 },
      { label: "Payment installment 2", flow: "payment", portion: 0.5, settled: 0 },
    ],
  },
  {
    id: "partial-receipt",
    label: "Partial Receipts",
    note: "Buyer has paid part of what they owe.",
    build: () => [
      { label: "Receipt (60% collected)", flow: "receipt", portion: 1, settled: 0.6 },
      { label: "Supplier payment", flow: "payment", portion: 1, settled: 1 },
    ],
  },
  {
    id: "partial-payment",
    label: "Partial Payments",
    note: "We have paid part of what we owe the supplier.",
    build: () => [
      { label: "Receipt", flow: "receipt", portion: 1, settled: 1 },
      { label: "Payment (60% paid)", flow: "payment", portion: 1, settled: 0.6 },
    ],
  },
]

export function SettlementScenarios({
  expectedReceipts,
  expectedPayments,
}: {
  expectedReceipts: number
  expectedPayments: number
}) {
  const [activeId, setActiveId] = useState(scenarios[0].id)
  const active = scenarios.find((s) => s.id === activeId)!

  const { rows, received, paid } = useMemo(() => {
    const built = active.build(expectedReceipts, expectedPayments)
    const rows = built.map((r) => {
      const base = r.flow === "receipt" ? expectedReceipts : expectedPayments
      const amount = Math.round(base * r.portion)
      return { ...r, amount, settledAmount: Math.round(amount * r.settled) }
    })
    const received = rows.filter((r) => r.flow === "receipt").reduce((s, r) => s + r.settledAmount, 0)
    const paid = rows.filter((r) => r.flow === "payment").reduce((s, r) => s + r.settledAmount, 0)
    return { rows, received, paid }
  }, [active, expectedReceipts, expectedPayments])

  const receivable = Math.max(0, expectedReceipts - received)
  const payable = Math.max(0, expectedPayments - paid)
  const realized = received - paid

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Landmark className="size-3.5 text-accent" />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Settlement Scenario</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Preview how a payment schedule eventually produces receivable, payable, and realized profit. Demonstration
        only — nothing here creates a real payment record.
      </p>

      {/* Scenario picker */}
      <div className="flex flex-wrap gap-2">
        {scenarios.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveId(s.id)}
            aria-pressed={s.id === activeId}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
              s.id === activeId
                ? "border-accent bg-accent-soft text-accent"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">{active.note}</p>

      {/* Schedule preview */}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Line</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2 text-right font-medium">Settled</th>
              <th className="px-3 py-2 text-right font-medium">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={i} className="bg-card">
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 font-medium",
                      r.flow === "receipt" ? "text-success" : "text-warning",
                    )}
                  >
                    {r.flow === "receipt" ? (
                      <ArrowDownLeft className="size-3.5" />
                    ) : (
                      <ArrowUpRight className="size-3.5" />
                    )}
                    {r.label}
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-foreground">
                  {formatCurrency(r.amount)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {formatCurrency(r.settledAmount)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">
                  {formatCurrency(r.amount - r.settledAmount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Derived outcomes */}
      <div className="grid grid-cols-3 gap-2">
        <Outcome label="Receivable" value={receivable} />
        <Outcome label="Payable" value={payable} />
        <Outcome label="Realized Profit" value={realized} tone={realized >= 0 ? "pos" : "neg"} />
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Receivables and payables originate from payment schedules. Realized profit is derived from actual receipts and
        payments.
      </p>
    </div>
  )
}

function Outcome({ label, value, tone }: { label: string; value: number; tone?: "pos" | "neg" }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
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
