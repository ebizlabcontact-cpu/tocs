import type { Formula } from "@/lib/types"
import { formatCurrency, formatDate, formatNumber, formatRelative, cn } from "@/lib/utils"
import { StatusBadge } from "@/components/ui/badge"
import { CalculationBreakdown } from "./calculation-breakdown"
import { FormulaChainView } from "./formula-chain"
import { SettlementScenarios } from "@/components/wizard/settlement-scenarios"
import { deriveSettlement, sixStatuses, isCloseable } from "@/lib/formula-math"
import {
  cashStatusConfig,
  deliveryStatusConfig,
  invoiceStatusConfig,
  logisticsStatusConfig,
  scheduleStatusConfig,
  statusConfig,
  tradeStatusConfig,
  tradeTypeConfig,
} from "@/lib/status"
import {
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Ship,
  Plane,
  Truck,
  Clock,
  GitCommitVertical,
  Handshake,
  StickyNote,
  Plus,
  PieChart,
  Scale,
  CheckCircle2,
  Circle,
} from "lucide-react"

function SectionEmpty({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}

/* ---------------- Participants ---------------- */
const roleLabels: Record<string, string> = {
  buyer: "Buyer",
  seller: "Seller",
  agent: "Agent",
  logistics: "Logistics",
  financier: "Financier",
}

export function ParticipantsPanel({ formula }: { formula: Formula }) {
  const chain = [...formula.participants].sort(
    (a, b) => (a.sequenceOrder ?? a.chainOrder ?? 0) - (b.sequenceOrder ?? b.chainOrder ?? 0),
  )
  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Operational roles belong to Formula Participants (not the Company Master). The same company may appear more than
        once with different roles.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {chain.map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-semibold text-accent">
              {(p.sequenceOrder ?? p.chainOrder ?? i) + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{p.company}</p>
              <p className="truncate text-xs text-muted-foreground">
                {p.natureGroup ? capitalize(p.natureGroup) : p.nature ?? "—"}
                {p.paymentGroup ? ` · ${capitalize(p.paymentGroup)}` : ""}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge tone="outline">{roleGroupLabel(p.roleGroup) ?? roleLabels[p.role]}</StatusBadge>
              {(p.isStart || p.isEnd) && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {p.isStart ? "Start" : "End"}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function roleGroupLabel(rg?: string) {
  if (!rg) return undefined
  const map: Record<string, string> = {
    supplier: "Supplier",
    buyer: "Buyer",
    carrier: "Carrier",
    financial: "Financial",
    other: "Other",
  }
  return map[rg] ?? capitalize(rg)
}

/* ---------------- Schedule ---------------- */
export function SchedulePanel({ formula }: { formula: Formula }) {
  if (formula.schedule.length === 0) return <SectionEmpty label="No payment schedule yet." />
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Type</th>
            <th className="px-4 py-2.5 font-medium">Counterparty</th>
            <th className="px-4 py-2.5 font-medium">Due</th>
            <th className="px-4 py-2.5 text-right font-medium">Amount</th>
            <th className="px-4 py-2.5 text-right font-medium">Progress</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {formula.schedule.map((s) => {
            const cfg = scheduleStatusConfig[s.status]
            const pct = Math.round((s.settledAmount / s.amount) * 100)
            return (
              <tr key={s.id} className="bg-card">
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 font-medium",
                      s.type === "receipt" ? "text-success" : "text-warning",
                    )}
                  >
                    {s.type === "receipt" ? (
                      <ArrowDownLeft className="size-4" />
                    ) : (
                      <ArrowUpRight className="size-4" />
                    )}
                    {s.type === "receipt" ? "Receipt" : "Payment"}
                  </span>
                </td>
                <td className="px-4 py-3 text-foreground">{s.counterparty}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(s.dueDate)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">
                  {formatCurrency(s.amount)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn("h-full rounded-full", s.type === "receipt" ? "bg-success" : "bg-warning")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-9 text-right font-mono text-xs text-muted-foreground">{pct}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge tone={cfg.tone}>{cfg.label}</StatusBadge>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ---------------- Invoices ---------------- */
export function InvoicesPanel({ formula }: { formula: Formula }) {
  if (formula.invoices.length === 0) return <SectionEmpty label="No invoices recorded." />
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {formula.invoices.map((inv) => {
        const cfg = invoiceStatusConfig[inv.status]
        return (
          <div key={inv.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <FileText className="size-4" />
                </div>
                <div>
                  <p className="font-mono text-sm font-semibold text-foreground">{inv.number}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {inv.direction} · {inv.counterparty}
                  </p>
                </div>
              </div>
              <StatusBadge tone={cfg.tone}>{cfg.label}</StatusBadge>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <span className="text-xs text-muted-foreground">{formatDate(inv.date)}</span>
              <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                {formatCurrency(inv.amount)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------------- Logistics ---------------- */
const modeIcons = { sea: Ship, air: Plane, land: Truck }

export function LogisticsPanel({ formula }: { formula: Formula }) {
  if (formula.logistics.length === 0) return <SectionEmpty label="No logistics legs planned." />
  return (
    <div className="space-y-3">
      {formula.logistics.map((leg) => {
        const Icon = modeIcons[leg.mode]
        const cfg = logisticsStatusConfig[leg.status]
        return (
          <div key={leg.id} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info">
              <Icon className="size-5" />
            </div>
            <div className="flex flex-1 items-center gap-2 text-sm">
              <span className="font-medium text-foreground">{leg.origin}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium text-foreground">{leg.destination}</span>
            </div>
            <div className="text-right">
              <StatusBadge tone={cfg.tone}>{cfg.label}</StatusBadge>
              <p className="mt-1 text-xs text-muted-foreground">ETA {formatDate(leg.eta)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------------- Timeline ---------------- */
const timelineIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  created: Plus,
  receipt: ArrowDownLeft,
  payment: ArrowUpRight,
  invoice: FileText,
  logistics: Ship,
  version: GitCommitVertical,
  note: StickyNote,
  share: Handshake,
}

export function TimelinePanel({ formula }: { formula: Formula }) {
  if (formula.timeline.length === 0) return <SectionEmpty label="No activity yet." />
  return (
    <ol className="relative space-y-5 pl-8">
      <span className="absolute left-[15px] top-1 bottom-1 w-px bg-border" aria-hidden />
      {formula.timeline.map((ev) => {
        const Icon = timelineIcons[ev.type] ?? Clock
        return (
          <li key={ev.id} className="relative">
            <span className="absolute -left-8 flex size-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
              <Icon className="size-4" />
            </span>
            <div className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{ev.title}</p>
                <time className="shrink-0 text-xs text-muted-foreground">{formatDate(ev.date)}</time>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{ev.description}</p>
              <p className="mt-1.5 text-xs text-muted-foreground">by {ev.actor}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/* ---------------- Overview ---------------- */
function OverviewStat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-sm font-semibold tabular-nums",
          tone === "pos" && "text-success",
          tone === "neg" && "text-danger",
          !tone && "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  )
}

/* ---------------- Six-status model (P0-6) ---------------- */
function SixStatusGrid({ formula }: { formula: Formula }) {
  const statuses = sixStatuses(formula)
  const done = statuses.filter((s) => s.done).length
  const closeable = isCloseable(formula)
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Formula Status</p>
        <span className="text-xs text-muted-foreground">
          {done}/6 matched ·{" "}
          <span className={formula.isClosed ? "text-success" : closeable ? "text-success" : "text-muted-foreground"}>
            {formula.isClosed ? "Closed" : closeable ? "Ready to close" : "Open"}
          </span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {statuses.map((s) => (
          <div
            key={s.key}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2",
              s.done ? "border-success/30 bg-success-soft" : "border-border bg-secondary/40",
            )}
          >
            {s.done ? (
              <CheckCircle2 className="size-4 shrink-0 text-success" />
            ) : (
              <Circle className="size-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0">
              <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className={cn("truncate text-sm font-medium", s.done ? "text-foreground" : "text-muted-foreground")}>
                {s.value}
              </p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Close condition: all six statuses must be completed / matched before a Formula can be closed. Authoritative close
        logic runs in backend services after integration.
      </p>
    </div>
  )
}

/* ---------------- Key dates (P0-2) ---------------- */
function KeyDates({ formula }: { formula: Formula }) {
  const dates: { label: string; value?: string }[] = [
    { label: "Trade Date", value: formula.tradeDate },
    { label: "Contract Date", value: formula.contractDate },
    { label: "Created", value: formula.createdAt },
    { label: "Updated", value: formula.updatedAt },
    { label: "Closed", value: formula.closedAt },
    { label: "Canceled", value: formula.canceledAt },
  ]
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Key Dates</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {dates.map((d) => (
          <div key={d.label} className="rounded-md bg-secondary/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{d.label}</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{d.value ? formatDate(d.value) : "—"}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function OverviewPanel({ formula }: { formula: Formula }) {
  const status = statusConfig[formula.status]
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
          <div className="mt-1.5">
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Trade Type</p>
          <p className="mt-1 text-sm font-medium text-foreground">{tradeTypeConfig[formula.tradeType].label}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Item</p>
          <p className="mt-1 truncate text-sm font-medium text-foreground">{formula.item}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Formula Quantity</p>
          <p className="mt-1 font-mono text-sm font-medium text-foreground">
            {formatNumber(formula.quantity)} {formula.unit}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Last Updated</p>
          <p className="mt-1 text-sm font-medium text-foreground">{formatRelative(formula.updatedAt)}</p>
        </div>
      </div>

      <SixStatusGrid formula={formula} />

      <KeyDates formula={formula} />

      <FormulaChainView formula={formula} />

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Profit Transparency
        </p>
        <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
          Expected profit is derived from formula inputs. Realized profit is derived from actual receipts and payments.
        </p>
        <CalculationBreakdown formula={formula} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewStat label="Participants" value={`${formula.participants.length}`} />
        <OverviewStat label="Schedule Items" value={`${formula.schedule.length}`} />
        <OverviewStat label="Invoices" value={`${formula.invoices.length}`} />
        <OverviewStat label="Logistics Legs" value={`${formula.logistics.length}`} />
      </div>

      {formula.specMemo && (
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Spec / Quality Memo
          </p>
          <p className="text-sm leading-relaxed text-foreground">{formula.specMemo}</p>
        </div>
      )}
    </div>
  )
}

/* ---------------- Shares ---------------- */
export function SharesPanel({ formula }: { formula: Formula }) {
  const shares = formula.shares ?? []
  if (shares.length === 0) return <SectionEmpty label="No formula share defined for this formula." />
  const total = shares.reduce((s, x) => s + x.amount, 0)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-4 py-2.5 text-sm text-muted-foreground">
        <PieChart className="size-4 shrink-0 text-accent" />
        Formula Share is a separate deal-level concept — {formatCurrency(total)} allocated across {shares.length}{" "}
        {shares.length === 1 ? "company" : "companies"}. It is not a participant percentage.
      </div>
      {shares.map((s) => {
        const pct = total > 0 ? Math.round((s.amount / total) * 100) : 0
        return (
          <div key={s.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{s.companyName}</p>
                {s.note && <p className="truncate text-xs text-muted-foreground">{s.note}</p>}
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-semibold text-foreground">{formatCurrency(s.amount)}</p>
                <p className="font-mono text-xs text-muted-foreground">{pct}% of share</p>
              </div>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          </div>
        )
      })}
      <p className="text-xs text-muted-foreground">
        Share amounts are illustrative and deducted from expected profit. Realized shares are settled by backend services
        after integration.
      </p>
    </div>
  )
}

/* ---------------- Settlement ---------------- */
function SettlementCheck({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-4 py-3 text-sm">
      {done ? (
        <CheckCircle2 className="size-4 shrink-0 text-success" />
      ) : (
        <Circle className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  )
}

function TierAmount({ label, value, tone }: { label: string; value: number; tone?: "pos" | "neg" | "muted" }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono text-sm tabular-nums",
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

export function SettlementPanel({ formula }: { formula: Formula }) {
  const s = deriveSettlement(formula)
  const activeRecords = (formula.records ?? []).filter((r) => !r.canceled)
  const canceledRecords = (formula.records ?? []).filter((r) => r.canceled)
  const receiptPct = formula.totalSell > 0 ? Math.round((s.actualReceipts / formula.totalSell) * 100) : 0
  const paymentPct = formula.totalBuy > 0 ? Math.round((s.actualPayments / formula.totalBuy) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        <Scale className="size-4 shrink-0 text-accent" />
        Two-tier settlement: <span className="font-medium text-foreground">Payment Schedule</span> is planned; the{" "}
        <span className="font-medium text-foreground">Payment Record</span> is actual. Realized profit derives from actual
        records only.
      </div>

      {/* Tier 1 (scheduled) vs Tier 2 (actual) */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Scheduled (Plan)
          </p>
          <div className="divide-y divide-border">
            <TierAmount label="Scheduled Receipts" value={s.scheduledReceipts} tone="muted" />
            <TierAmount label="Scheduled Payments" value={s.scheduledPayments} tone="muted" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Actual (Record)
          </p>
          <div className="divide-y divide-border">
            <TierAmount label="Actual Receipts" value={s.actualReceipts} tone="pos" />
            <TierAmount label="Actual Payments" value={s.actualPayments} />
          </div>
        </div>
      </div>

      {/* Settlement progress */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Receipts Settled</p>
            <span className="font-mono text-xs text-muted-foreground">{receiptPct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, receiptPct)}%` }} />
          </div>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {formatCurrency(s.actualReceipts)} / {formatCurrency(formula.totalSell)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Payments Settled</p>
            <span className="font-mono text-xs text-muted-foreground">{paymentPct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-warning" style={{ width: `${Math.min(100, paymentPct)}%` }} />
          </div>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {formatCurrency(s.actualPayments)} / {formatCurrency(formula.totalBuy)}
          </p>
        </div>
      </div>

      {/* Payment records (Tier 2) */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment Records</p>
        {activeRecords.length + canceledRecords.length === 0 ? (
          <SectionEmpty label="No actual payment records yet." />
        ) : (
          <div className="space-y-2">
            {[...activeRecords, ...canceledRecords].map((r) => (
              <div
                key={r.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3",
                  r.canceled && "opacity-60",
                )}
              >
                <span className={cn("font-medium", r.type === "receipt" ? "text-success" : "text-warning")}>
                  {r.type === "receipt" ? (
                    <ArrowDownLeft className="size-4" />
                  ) : (
                    <ArrowUpRight className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{r.counterparty}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(r.paidDate)}</p>
                </div>
                {r.canceled && <StatusBadge tone="danger">Canceled</StatusBadge>}
                <span
                  className={cn(
                    "font-mono text-sm tabular-nums",
                    r.canceled ? "text-muted-foreground line-through" : "text-foreground",
                  )}
                >
                  {formatCurrency(r.amount)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-secondary/40 p-4">
        <div className="flex items-center gap-2">
          <Scale className="size-4 text-accent" />
          <p className="text-sm font-semibold text-foreground">Net Position</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <OverviewStat label="Remaining Receivable" value={formatCurrency(s.remainingReceivable)} />
          <OverviewStat label="Remaining Payable" value={formatCurrency(s.remainingPayable)} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Settlement Checklist</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <SettlementCheck label="All receipts collected" done={s.remainingReceivable === 0} />
          <SettlementCheck label="All payments cleared" done={s.remainingPayable === 0} />
          <SettlementCheck label="Invoices matched" done={formula.invoiceStatus === "complete"} />
          <SettlementCheck label="Ready to close (6/6)" done={isCloseable(formula)} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <SettlementScenarios expectedReceipts={formula.totalSell} expectedPayments={formula.totalBuy} />
      </div>
    </div>
  )
}
