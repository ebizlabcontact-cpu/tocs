import type { Formula } from "@/lib/types"
import { formatCurrency, formatDate, formatNumber, formatRelative, cn } from "@/lib/utils"
import { StatusBadge } from "@/components/ui/badge"
import { CalculationBreakdown } from "./calculation-breakdown"
import { FormulaChainView } from "./formula-chain"
import { SettlementScenarios } from "@/components/wizard/settlement-scenarios"
import {
  invoiceStatusConfig,
  logisticsStatusConfig,
  scheduleStatusConfig,
  statusConfig,
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
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {formula.participants.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-foreground">
            {p.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
            <p className="truncate text-xs text-muted-foreground">{p.company}</p>
          </div>
          <div className="text-right">
            <StatusBadge tone="outline">{roleLabels[p.role]}</StatusBadge>
            {p.sharePct !== undefined && (
              <p className="mt-1 font-mono text-xs text-muted-foreground">{p.sharePct}% share</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
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
  const shared = formula.participants.filter((p) => p.sharePct !== undefined && p.sharePct > 0)
  if (shared.length === 0) return <SectionEmpty label="No profit shares defined for this formula." />
  const totalPct = shared.reduce((s, p) => s + (p.sharePct ?? 0), 0)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-4 py-2.5 text-sm text-muted-foreground">
        <PieChart className="size-4 shrink-0 text-accent" />
        Allocated {totalPct}% of gross margin across {shared.length} participant{shared.length === 1 ? "" : "s"}.
      </div>
      {shared.map((p) => {
        const pct = p.sharePct ?? 0
        const est = Math.round((formula.expectedProfit * pct) / 100)
        return (
          <div key={p.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                <p className="truncate text-xs capitalize text-muted-foreground">{p.role}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-semibold text-foreground">{pct}%</p>
                <p className="font-mono text-xs text-muted-foreground">≈ {formatCurrency(est)}</p>
              </div>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          </div>
        )
      })}
      <p className="text-xs text-muted-foreground">
        Estimated amounts are illustrative, based on expected profit. Realized shares are calculated at settlement.
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

export function SettlementPanel({ formula }: { formula: Formula }) {
  const receiptsSettled = formula.schedule
    .filter((s) => s.type === "receipt")
    .reduce((sum, s) => sum + s.settledAmount, 0)
  const receiptsTotal = formula.schedule.filter((s) => s.type === "receipt").reduce((sum, s) => sum + s.amount, 0)
  const paymentsSettled = formula.schedule
    .filter((s) => s.type === "payment")
    .reduce((sum, s) => sum + s.settledAmount, 0)
  const paymentsTotal = formula.schedule.filter((s) => s.type === "payment").reduce((sum, s) => sum + s.amount, 0)
  const receiptPct = receiptsTotal > 0 ? Math.round((receiptsSettled / receiptsTotal) * 100) : 0
  const paymentPct = paymentsTotal > 0 ? Math.round((paymentsSettled / paymentsTotal) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Receipts Settled</p>
            <span className="font-mono text-xs text-muted-foreground">{receiptPct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-success" style={{ width: `${receiptPct}%` }} />
          </div>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {formatCurrency(receiptsSettled)} / {formatCurrency(receiptsTotal)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Payments Settled</p>
            <span className="font-mono text-xs text-muted-foreground">{paymentPct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-warning" style={{ width: `${paymentPct}%` }} />
          </div>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {formatCurrency(paymentsSettled)} / {formatCurrency(paymentsTotal)}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-secondary/40 p-4">
        <div className="flex items-center gap-2">
          <Scale className="size-4 text-accent" />
          <p className="text-sm font-semibold text-foreground">Net Position</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <OverviewStat label="Outstanding Receivable" value={formatCurrency(formula.receivable)} />
          <OverviewStat label="Outstanding Payable" value={formatCurrency(formula.payable)} />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Settlement Checklist</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <SettlementCheck label="All receipts collected" done={receiptPct >= 100} />
          <SettlementCheck label="All payments cleared" done={paymentPct >= 100} />
          <SettlementCheck label="Invoices matched" done={formula.invoiceStatus === "complete"} />
          <SettlementCheck label="Ready to close" done={formula.closeable} />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <SettlementScenarios expectedReceipts={formula.totalSell} expectedPayments={formula.totalBuy} />
      </div>
    </div>
  )
}
