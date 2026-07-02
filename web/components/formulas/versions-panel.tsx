"use client"

import { useMemo, useState } from "react"
import { ArrowRight, ChevronRight, Sparkles } from "lucide-react"
import type { Formula, VersionEntry } from "@/lib/types"
import { getVersionHistory, companies } from "@/lib/mock-data"
import { deriveChainFinancials } from "@/lib/derive"
import { tradeTypeConfig } from "@/lib/status"
import { formatCurrency, formatDate, formatNumber, cn } from "@/lib/utils"
import { StatusBadge } from "@/components/ui/badge"
import { SidePanel } from "@/components/ui/side-panel"
import { FormulaEditSimulation } from "./formula-edit-simulation"

/** A version plus the Formula state it represents (for the snapshot view). */
type SnapshotVersion = VersionEntry & {
  isSimulated?: boolean
  /** Overrides applied to the base formula for this version's snapshot. */
  snapshot?: {
    quantity: number
    expectedRevenue: number
    expectedCost: number
    grossMargin: number
    expectedProfit: number
  }
}

/** The five snapshot sections captured for a Formula version. */
function useSnapshotSections(formula: Formula) {
  return useMemo(() => {
    const company = companies.find((c) => c.id === formula.companyId)
    const chain = formula.participants
    const derived = deriveChainFinancials(chain, { logisticsCost: formula.cost, share: formula.share })
    const revenue = derived?.expectedRevenue ?? formula.totalSell
    const cost = derived?.expectedCost ?? formula.totalBuy
    const margin = derived?.grossMargin ?? formula.totalSell - formula.totalBuy
    return {
      company,
      chain,
      base: {
        quantity: formula.quantity,
        expectedRevenue: revenue,
        expectedCost: cost,
        grossMargin: margin,
        expectedProfit: formula.expectedProfit,
      },
    }
  }, [formula])
}

export function VersionsPanel({ formula }: { formula: Formula }) {
  const baseVersions = useMemo(() => getVersionHistory(formula), [formula])
  const [simulated, setSimulated] = useState<SnapshotVersion[]>([])
  const [active, setActive] = useState<SnapshotVersion | null>(null)
  const { company, chain, base } = useSnapshotSections(formula)

  const versions: SnapshotVersion[] = [...simulated, ...baseVersions]
  const topVersionNo = versions.reduce((m, v) => Math.max(m, v.versionNo), 0)

  return (
    <div className="space-y-5">
      <FormulaEditSimulation
        formula={formula}
        onCapture={(edit, before, after) => {
          const versionNo = topVersionNo + 1
          setSimulated((prev) => [
            {
              versionNo,
              createdAt: new Date().toISOString(),
              createdBy: "You (simulated)",
              summary: "Simulated edit — quantity & pricing",
              isSimulated: true,
              snapshot: {
                quantity: after.quantity,
                expectedRevenue: after.expectedRevenue,
                expectedCost: after.expectedCost,
                grossMargin: after.grossMargin,
                expectedProfit: after.expectedProfit,
              },
              changes: [
                ...(after.quantity !== before.quantity
                  ? [{ label: "Quantity", from: `${formatNumber(before.quantity)} ${formula.unit}`, to: `${formatNumber(after.quantity)} ${formula.unit}` }]
                  : []),
                ...(after.sellUnitPrice !== before.sellUnitPrice
                  ? [{ label: "Sell Unit Price", from: formatCurrency(before.sellUnitPrice), to: formatCurrency(after.sellUnitPrice) }]
                  : []),
                { label: "Expected Revenue", from: formatCurrency(before.expectedRevenue), to: formatCurrency(after.expectedRevenue) },
                { label: "Expected Profit", from: formatCurrency(before.expectedProfit), to: formatCurrency(after.expectedProfit) },
              ],
            },
            ...prev,
          ])
        }}
      />

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Version History</p>
        <div className="space-y-3">
          {versions.map((v, i) => (
            <button
              key={`${v.isSimulated ? "sim" : "v"}-${v.versionNo}`}
              type="button"
              onClick={() => setActive(v)}
              className={cn(
                "flex w-full items-center gap-4 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/40",
                i === 0 ? "border-accent/40" : "border-border",
              )}
            >
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-semibold",
                  i === 0 ? "bg-accent-soft text-accent" : "bg-secondary text-muted-foreground",
                )}
              >
                v{v.versionNo}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{v.summary}</p>
                  {v.isSimulated ? (
                    <StatusBadge tone="info">Simulated</StatusBadge>
                  ) : (
                    i === 0 && <StatusBadge tone="success">Current</StatusBadge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDate(v.createdAt)} · {v.createdBy}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Versions are snapshots of Formula states. History is illustrative mock data for demonstration.
        </p>
      </div>

      <SidePanel
        open={active !== null}
        onClose={() => setActive(null)}
        title={active ? `Version v${active.versionNo}` : ""}
        description={active?.summary}
      >
        {active && (
          <div className="space-y-4">
            {active.isSimulated && (
              <div className="flex items-center gap-2 rounded-lg border border-info/30 bg-info-soft px-3 py-2 text-xs text-info">
                <Sparkles className="size-3.5 shrink-0" />
                Simulated snapshot — not persisted.
              </div>
            )}

            <div className="rounded-lg border border-border bg-card px-4">
              <MetaRow label="Version" value={`v${active.versionNo}`} mono border />
              <MetaRow
                label="Created At"
                value={formatDate(active.createdAt, { month: "short", day: "numeric", year: "numeric" })}
                border
              />
              <MetaRow label="Created By" value={active.createdBy} />
            </div>

            {/* Change comparison (before → after) */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Change Summary</p>
              <div className="space-y-2">
                {active.changes.map((c, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-card p-3">
                    <p className="text-sm font-medium text-foreground">{c.label}</p>
                    {c.from !== undefined && c.to !== undefined ? (
                      <div className="mt-1.5 flex items-center gap-2 font-mono text-sm">
                        <span className="rounded bg-danger-soft px-1.5 py-0.5 text-danger">{c.from}</span>
                        <ArrowRight className="size-3.5 text-muted-foreground" />
                        <span className="rounded bg-success/12 px-1.5 py-0.5 text-success">{c.to}</span>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">{c.note}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Snapshot sections */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Snapshot</p>
              <div className="space-y-2">
                <SnapshotSection title="Basic Information">
                  <SnapItem label="Company" value={company?.name ?? "—"} />
                  <SnapItem label="Item" value={formula.item} />
                  <SnapItem label="Trade Type" value={tradeTypeConfig[formula.tradeType].label} />
                  <SnapItem
                    label="Quantity"
                    value={`${formatNumber(active.snapshot?.quantity ?? base.quantity)} ${formula.unit}`}
                  />
                </SnapshotSection>

                <SnapshotSection title="Trade Chain">
                  <SnapItem label="Parties" value={`${chain.length}`} />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {chain.map((p) => p.company).join(" → ")}
                  </p>
                </SnapshotSection>

                <SnapshotSection title="Settlement Terms">
                  <SnapItem label="Expected Receipts" value={formatCurrency(formula.totalSell)} />
                  <SnapItem label="Expected Payments" value={formatCurrency(formula.totalBuy)} />
                  <SnapItem label="Share" value={formatCurrency(formula.share)} />
                </SnapshotSection>

                <SnapshotSection title="Logistics">
                  <SnapItem label="Shipment Legs" value={`${formula.logistics.length}`} />
                  {formula.logistics.length > 0 && (
                    <p className="text-xs capitalize text-muted-foreground">
                      {formula.logistics.map((l) => l.mode).join(", ")}
                    </p>
                  )}
                </SnapshotSection>

                <SnapshotSection title="Derived Financial Summary">
                  <SnapItem label="Expected Revenue" value={formatCurrency(active.snapshot?.expectedRevenue ?? base.expectedRevenue)} />
                  <SnapItem label="Expected Cost" value={formatCurrency(active.snapshot?.expectedCost ?? base.expectedCost)} />
                  <SnapItem label="Gross Margin" value={formatCurrency(active.snapshot?.grossMargin ?? base.grossMargin)} />
                  <SnapItem label="Expected Profit" value={formatCurrency(active.snapshot?.expectedProfit ?? base.expectedProfit)} strong />
                </SnapshotSection>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Every figure in this snapshot is derived from Formula. Versions are snapshots of Formula states.
            </p>
          </div>
        )}
      </SidePanel>
    </div>
  )
}

function MetaRow({ label, value, mono, border }: { label: string; value: string; mono?: boolean; border?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 py-2.5", border && "border-b border-border")}>
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium text-foreground", mono && "font-mono")}>{value}</span>
    </div>
  )
}

function SnapshotSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="mb-2 text-xs font-semibold text-foreground">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function SnapItem({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono text-xs tabular-nums text-foreground", strong && "text-sm font-semibold")}>
        {value}
      </span>
    </div>
  )
}
