"use client"

import { useMemo, useState } from "react"
import { ArrowRight, ChevronRight, Info, GitBranch, FileText, AlertTriangle } from "lucide-react"
import type { Formula, VersionChange, VersionChangeValueType, VersionEntry } from "@/lib/types"
import { getVersionHistory, companies } from "@/lib/mock-data"
import { deriveChainFinancials } from "@/lib/derive"
import { deriveExpected, deriveRealized, deriveSettlement } from "@/lib/formula-math"
import { tradeTypeConfig } from "@/lib/status"
import { formatCurrency, formatDate, formatNumber, cn } from "@/lib/utils"
import { StatusBadge } from "@/components/ui/badge"
import { SidePanel } from "@/components/ui/side-panel"
import { FormulaEditSimulation } from "./formula-edit-simulation"

/** A version entry rendered in the snapshot preview. */
type SnapshotVersion = VersionEntry

/** Formats a raw diff value at render time based on its declared type (P0-3). */
function formatChangeValue(value: VersionChange["oldValue"], type: VersionChangeValueType): string {
  if (value === null || value === undefined) return "—"
  switch (type) {
    case "currency":
      return formatCurrency(Number(value))
    case "number":
      return formatNumber(Number(value))
    case "date":
      return formatDate(String(value), { month: "short", day: "numeric", year: "numeric" })
    case "status":
    case "text":
    default:
      return String(value)
  }
}

/** The five snapshot sections captured for a Formula version. */
function useSnapshotSections(formula: Formula) {
  return useMemo(() => {
    const company = companies.find((c) => c.id === formula.companyId)
    const chain = formula.participants
    const derived = deriveChainFinancials(chain, { logisticsCost: formula.cost, share: formula.share })
    const expected = deriveExpected(formula)
    const settlement = deriveSettlement(formula)
    const realized = deriveRealized(formula)
    return {
      company,
      chain,
      endpointsResolved: derived !== null,
      base: {
        quantity: formula.quantity,
        totalSell: expected.totalSell,
        totalBuy: expected.totalBuy,
        cost: expected.cost,
        share: expected.share,
        expectedProfit: expected.expectedProfit,
        scheduledReceipts: settlement.scheduledReceipts,
        actualReceipts: settlement.actualReceipts,
        receivable: settlement.remainingReceivable,
        scheduledPayments: settlement.scheduledPayments,
        actualPayments: settlement.actualPayments,
        payable: settlement.remainingPayable,
        realizedProfit: realized.realizedProfit,
      },
    }
  }, [formula])
}

export function VersionsPanel({ formula }: { formula: Formula }) {
  const versions = useMemo(() => getVersionHistory(formula), [formula])
  const [active, setActive] = useState<SnapshotVersion | null>(null)
  const { company, chain, base, endpointsResolved } = useSnapshotSections(formula)
  // The newest version is the live/current state; older versions render their
  // frozen immutable snapshot instead of a live recomputation (P0-3).
  const latestVersionNo = versions[0]?.versionNo
  const isLatestActive = active?.versionNo === latestVersionNo
  const snap = active?.snapshot ?? null
  // Historical versions read their frozen snapshot; the latest reads live figures.
  const useSnap = snap != null && !isLatestActive
  const fin = {
    totalSell: useSnap ? snap!.totalSell : base.totalSell,
    totalBuy: useSnap ? snap!.totalBuy : base.totalBuy,
    cost: useSnap ? snap!.totalCost : base.cost,
    share: useSnap ? snap!.totalShare : base.share,
    expectedProfit: useSnap ? snap!.expectedProfit : base.expectedProfit,
    realizedProfit: useSnap ? snap!.realizedProfit : base.realizedProfit,
    actualReceipts: useSnap ? snap!.actualReceipts : base.actualReceipts,
    actualPayments: useSnap ? snap!.actualPayments : base.actualPayments,
    receivable: useSnap ? snap!.receivable : base.receivable,
    payable: useSnap ? snap!.payable : base.payable,
    scheduledReceipts: base.scheduledReceipts,
    scheduledPayments: base.scheduledPayments,
  }

  return (
    <div className="space-y-5">
      <FormulaEditSimulation formula={formula} />

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Version History</p>
        <div className="space-y-3">
          {versions.map((v, i) => (
            <button
              key={`v-${v.versionNo}`}
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
                  {i === 0 && <StatusBadge tone="success">Latest</StatusBadge>}
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
          Versions are created and persisted by backend services. This screen previews how snapshots could appear after
          integration — the values shown are illustrative mock data, not generated or stored in the frontend.
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
            <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info-soft px-3 py-2 text-xs text-info">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {isLatestActive ? (
                <span>
                  <span className="font-semibold">Current live preview.</span> The latest version&apos;s figures are
                  recomputed from the current Formula. Authoritative snapshots are captured by backend services.
                </span>
              ) : (
                <span>
                  <span className="font-semibold">Historical immutable snapshot.</span> These figures are frozen from
                  when this version was created — not recomputed from the current Formula.
                </span>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card px-4">
              <MetaRow label="Version" value={`v${active.versionNo}`} mono border />
              <MetaRow
                label="Created At"
                value={formatDate(active.createdAt, { month: "short", day: "numeric", year: "numeric" })}
                border
              />
              <MetaRow label="Created By" value={active.createdBy} />
            </div>

            {/* Change comparison (before → after), grouped by version-trigger (P0-3) */}
            <ChangeGroups changes={active.changes} />

            {/* Snapshot sections */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Snapshot</p>
              <div className="space-y-2">
                <SnapshotSection title="Basic Information">
                  <SnapItem label="Company" value={company?.name ?? "—"} />
                  <SnapItem label="Item" value={formula.item} />
                  <SnapItem label="Trade Type" value={tradeTypeConfig[formula.tradeType].label} />
                  <SnapItem label="Quantity" value={`${formatNumber(base.quantity)} ${formula.unit}`} />
                </SnapshotSection>

                <SnapshotSection title="Trade Chain">
                  <SnapItem label="Parties" value={`${chain.length}`} />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {chain.map((p) => p.company).join(" → ")}
                  </p>
                </SnapshotSection>

                <SnapshotSection title="Settlement Terms">
                  <SnapItem label="Scheduled Receipts" value={formatCurrency(fin.scheduledReceipts)} />
                  <SnapItem label="Actual Receipts" value={formatCurrency(fin.actualReceipts)} />
                  <SnapItem label="Receivable" value={formatCurrency(fin.receivable)} />
                  <SnapItem label="Scheduled Payments" value={formatCurrency(fin.scheduledPayments)} />
                  <SnapItem label="Actual Payments" value={formatCurrency(fin.actualPayments)} />
                  <SnapItem label="Payable" value={formatCurrency(fin.payable)} />
                  <SnapItem label="Share" value={formatCurrency(fin.share)} />
                </SnapshotSection>

                <SnapshotSection title="Logistics">
                  <SnapItem label="Shipment Legs" value={`${formula.logistics.length}`} />
                  {formula.logistics.length > 0 && (
                    <p className="text-xs capitalize text-muted-foreground">
                      {formula.logistics.map((l) => l.mode).join(", ")}
                    </p>
                  )}
                </SnapshotSection>

                <SnapshotSection title={useSnap ? "Snapshot Financial Summary (Frozen)" : "Derived Financial Summary (Live)"}>
                  <SnapItem label="Total Sell" value={formatCurrency(fin.totalSell)} />
                  <SnapItem label="Total Buy" value={formatCurrency(fin.totalBuy)} />
                  <SnapItem label="Costs" value={formatCurrency(fin.cost)} />
                  <SnapItem label="Share" value={formatCurrency(fin.share)} />
                  <SnapItem label="Expected Net Profit" value={formatCurrency(fin.expectedProfit)} strong />
                  <SnapItem label="Realized Net Profit" value={formatCurrency(fin.realizedProfit)} strong />
                  {useSnap && (
                    <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
                      Frozen at version creation (formula_calculation_snapshots). Current live figures may differ.
                    </p>
                  )}
                  {!useSnap && !endpointsResolved && (
                    <p className="flex items-start gap-1.5 pt-1 text-[11px] leading-relaxed text-warning">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                      Chain endpoints (Start / End) not fully defined — figures fall back to stored totals rather than
                      chain derivation.
                    </p>
                  )}
                </SnapshotSection>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Illustrative preview only. Authoritative snapshots are captured and persisted by backend services after
              integration.
            </p>
          </div>
        )}
      </SidePanel>
    </div>
  )
}

function ChangeGroups({ changes }: { changes: VersionChange[] }) {
  const triggering = changes.filter((c) => c.versionTriggering)
  const nonVersion = changes.filter((c) => !c.versionTriggering)
  return (
    <div className="space-y-3">
      {triggering.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
            <GitBranch className="size-3.5" />
            Version-triggering changes
          </p>
          <div className="space-y-2">
            {triggering.map((c) => (
              <ChangeCard key={c.field} change={c} />
            ))}
          </div>
        </div>
      )}
      {nonVersion.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <FileText className="size-3.5" />
            Non-version notes
          </p>
          <div className="space-y-2">
            {nonVersion.map((c) => (
              <ChangeCard key={c.field} change={c} muted />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ChangeCard({ change, muted }: { change: VersionChange; muted?: boolean }) {
  const hasBefore = change.oldValue !== null && change.oldValue !== undefined
  const before = formatChangeValue(change.oldValue, change.valueType)
  const after = formatChangeValue(change.newValue, change.valueType)
  return (
    <div className={cn("rounded-lg border bg-card p-3", muted ? "border-dashed border-border" : "border-border")}>
      <p className="text-sm font-medium text-foreground">{change.label}</p>
      {hasBefore ? (
        <div className="mt-1.5 flex items-center gap-2 font-mono text-sm">
          <span className="rounded bg-danger-soft px-1.5 py-0.5 text-danger">{before}</span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span className="rounded bg-success/12 px-1.5 py-0.5 text-success">{after}</span>
        </div>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">{after}</p>
      )}
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
