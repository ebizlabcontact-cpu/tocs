import type { Formula } from "@/lib/types"
import { formatCurrency, formatDate, cn } from "@/lib/utils"
import { StatusBadge } from "@/components/ui/badge"
import { invoiceStatusConfig, logisticsStatusConfig, scheduleStatusConfig } from "@/lib/status"
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
