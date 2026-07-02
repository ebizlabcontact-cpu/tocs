"use client"

import { Suspense, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { useCompany } from "@/components/company-context"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/ui/badge"
import { SidePanel } from "@/components/ui/side-panel"
import { getCalendarEvents } from "@/lib/mock-data"
import type { CalendarEvent } from "@/lib/types"
import { cn, formatCurrency, formatDate } from "@/lib/utils"

type Flow = "all" | "receipt" | "payment"
type View = "month" | "week" | "agenda"

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function dayKey(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function startOfWeek(d: Date) {
  const date = new Date(d)
  date.setDate(date.getDate() - date.getDay())
  date.setHours(0, 0, 0, 0)
  return date
}

function CalendarContent() {
  const { selected } = useCompany()
  const params = useSearchParams()
  const initial = (params.get("type") as Flow | null) ?? "all"
  const [flow, setFlow] = useState<Flow>(["all", "receipt", "payment"].includes(initial) ? initial : "all")
  const [view, setView] = useState<View>("month")
  const [cursor, setCursor] = useState(() => new Date())
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null)

  const events = useMemo(() => {
    const type = flow === "all" ? undefined : flow
    return getCalendarEvents(selected.id, type)
  }, [selected.id, flow])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const key = dayKey(e.dueDate)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return map
  }, [events])

  const totalReceipt = events.filter((e) => e.flow === "receipt").reduce((s, e) => s + e.amount, 0)
  const totalPayment = events.filter((e) => e.flow === "payment").reduce((s, e) => s + e.amount, 0)

  const tabs: { key: Flow; label: string }[] = [
    { key: "all", label: "All" },
    { key: "receipt", label: "Receipts" },
    { key: "payment", label: "Payments" },
  ]
  const views: { key: View; label: string }[] = [
    { key: "month", label: "Month" },
    { key: "week", label: "Week" },
    { key: "agenda", label: "Agenda" },
  ]

  function shift(dir: -1 | 1) {
    setCursor((prev) => {
      const next = new Date(prev)
      if (view === "week") next.setDate(next.getDate() + dir * 7)
      else next.setMonth(next.getMonth() + dir)
      return next
    })
  }

  const periodLabel =
    view === "week"
      ? (() => {
          const s = startOfWeek(cursor)
          const e = new Date(s)
          e.setDate(e.getDate() + 6)
          return `${formatDate(s.toISOString(), { month: "short", day: "numeric" })} – ${formatDate(e.toISOString(), { month: "short", day: "numeric" })}`
        })()
      : formatDate(cursor.toISOString(), { month: "long", year: "numeric" })

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Calendar"
        description="Calendar events are derived from formula payment schedules — nothing here exists independently of a formula."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-success/12 text-success">
                <ArrowDownLeft className="size-4" />
              </span>
              <span className="text-sm font-medium text-muted-foreground">Expected receipts</span>
            </div>
            <span className="text-lg font-semibold tabular-nums text-success">
              {formatCurrency(totalReceipt, { compact: true })}
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-warning/12 text-warning">
                <ArrowUpRight className="size-4" />
              </span>
              <span className="text-sm font-medium text-muted-foreground">Scheduled payments</span>
            </div>
            <span className="text-lg font-semibold tabular-nums text-warning">
              {formatCurrency(totalPayment, { compact: true })}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          {views.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                view === v.key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setFlow(t.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                flow === t.key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Period navigation (month/week only) */}
      {view !== "agenda" && (
        <div className="mt-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">{periodLabel}</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shift(-1)}
              className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ChevronLeft className="size-4" />
              <span className="sr-only">Previous</span>
            </button>
            <button
              type="button"
              onClick={() => setCursor(new Date())}
              className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => shift(1)}
              className="flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ChevronRight className="size-4" />
              <span className="sr-only">Next</span>
            </button>
          </div>
        </div>
      )}

      <div className="mt-3">
        {view === "month" && (
          <MonthView cursor={cursor} eventsByDay={eventsByDay} onSelect={setActiveEvent} />
        )}
        {view === "week" && (
          <WeekView cursor={cursor} eventsByDay={eventsByDay} onSelect={setActiveEvent} />
        )}
        {view === "agenda" && <AgendaView events={events} onSelect={setActiveEvent} />}
      </div>

      <EventDetailPanel event={activeEvent} onClose={() => setActiveEvent(null)} />
    </div>
  )
}

/* ---------------- Month view ---------------- */
function MonthView({
  cursor,
  eventsByDay,
  onSelect,
}: {
  cursor: Date
  eventsByDay: Map<string, CalendarEvent[]>
  onSelect: (e: CalendarEvent) => void
}) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
  const gridStart = startOfWeek(first)
  const todayKey = dayKey(new Date())
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart)
    d.setDate(d.getDate() + i)
    return d
  })

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-secondary/50">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === cursor.getMonth()
          const dayEvents = eventsByDay.get(dayKey(d)) ?? []
          const isToday = dayKey(d) === todayKey
          return (
            <div
              key={i}
              className={cn(
                "min-h-24 border-b border-r border-border p-1.5 last:border-r-0 [&:nth-child(7n)]:border-r-0",
                !inMonth && "bg-muted/30",
              )}
            >
              <div className="mb-1 flex justify-end">
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-xs",
                    isToday ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground",
                    !inMonth && "opacity-40",
                  )}
                >
                  {d.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                {dayEvents.slice(0, 3).map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onSelect(e)}
                    className={cn(
                      "flex items-center gap-1 truncate rounded px-1.5 py-1 text-left text-[11px] font-medium transition-opacity hover:opacity-80",
                      e.flow === "receipt" ? "bg-success/12 text-success" : "bg-warning/12 text-warning",
                    )}
                  >
                    {e.flow === "receipt" ? (
                      <ArrowDownLeft className="size-3 shrink-0" />
                    ) : (
                      <ArrowUpRight className="size-3 shrink-0" />
                    )}
                    <span className="truncate">{formatCurrency(e.amount, { compact: true })}</span>
                  </button>
                ))}
                {dayEvents.length > 3 && (
                  <span className="px-1.5 text-[11px] text-muted-foreground">+{dayEvents.length - 3} more</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------- Week view ---------------- */
function WeekView({
  cursor,
  eventsByDay,
  onSelect,
}: {
  cursor: Date
  eventsByDay: Map<string, CalendarEvent[]>
  onSelect: (e: CalendarEvent) => void
}) {
  const start = startOfWeek(cursor)
  const todayKey = dayKey(new Date())
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d
  })

  return (
    <div className="grid gap-2 sm:grid-cols-7">
      {days.map((d, i) => {
        const dayEvents = eventsByDay.get(dayKey(d)) ?? []
        const isToday = dayKey(d) === todayKey
        return (
          <div key={i} className="flex flex-col rounded-lg border border-border bg-card">
            <div
              className={cn(
                "flex items-center justify-between border-b border-border px-2.5 py-2",
                isToday && "bg-accent-soft",
              )}
            >
              <span className="text-xs font-medium text-muted-foreground">{WEEKDAYS[d.getDay()]}</span>
              <span className={cn("text-sm font-semibold", isToday ? "text-accent" : "text-foreground")}>
                {d.getDate()}
              </span>
            </div>
            <div className="flex min-h-28 flex-col gap-1.5 p-2">
              {dayEvents.length === 0 ? (
                <span className="mt-2 text-center text-[11px] text-muted-foreground/60">—</span>
              ) : (
                dayEvents.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onSelect(e)}
                    className={cn(
                      "flex flex-col gap-0.5 rounded-md border p-1.5 text-left transition-colors hover:bg-muted/40",
                      e.flow === "receipt" ? "border-success/30" : "border-warning/30",
                    )}
                  >
                    <span className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                      {e.flow === "receipt" ? (
                        <ArrowDownLeft className="size-3 text-success" />
                      ) : (
                        <ArrowUpRight className="size-3 text-warning" />
                      )}
                      <span className="font-mono">{e.formula}</span>
                    </span>
                    <span
                      className={cn(
                        "font-mono text-xs font-semibold tabular-nums",
                        e.flow === "receipt" ? "text-success" : "text-warning",
                      )}
                    >
                      {formatCurrency(e.amount, { compact: true })}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---------------- Agenda view (existing grouped list) ---------------- */
function AgendaView({
  events,
  onSelect,
}: {
  events: CalendarEvent[]
  onSelect: (e: CalendarEvent) => void
}) {
  const groups = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const key = formatDate(e.dueDate)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return Array.from(map.entries())
  }, [events])

  if (groups.length === 0) {
    return (
      <div className="mt-12 flex flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm font-medium text-foreground">No scheduled cashflow</p>
        <p className="text-sm text-muted-foreground">There are no upcoming events for this filter.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map(([date, list]) => (
        <div key={date} className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <CalendarDays className="size-3.5" />
            {date}
          </div>
          <Card>
            <CardContent className="divide-y divide-border p-0">
              {list.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => onSelect(e)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg",
                        e.flow === "receipt" ? "bg-success/12 text-success" : "bg-warning/12 text-warning",
                      )}
                    >
                      {e.flow === "receipt" ? (
                        <ArrowDownLeft className="size-4" />
                      ) : (
                        <ArrowUpRight className="size-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        <span className="font-mono">{e.formula}</span> · {e.item}
                      </p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {e.flow} · {e.status}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      e.flow === "receipt" ? "text-success" : "text-warning",
                    )}
                  >
                    {formatCurrency(e.amount, { compact: true })}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  )
}

/* ---------------- Event detail panel ---------------- */
function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium text-foreground", mono && "font-mono tabular-nums")}>{value}</span>
    </div>
  )
}

function EventDetailPanel({ event, onClose }: { event: CalendarEvent | null; onClose: () => void }) {
  return (
    <SidePanel
      open={event !== null}
      onClose={onClose}
      title={event ? `${event.flow === "receipt" ? "Receipt" : "Payment"} detail` : ""}
      description={event?.formula}
    >
      {event && (
        <div className="space-y-4">
          <div
            className={cn(
              "flex items-center gap-3 rounded-lg border p-4",
              event.flow === "receipt" ? "border-success/30 bg-success/8" : "border-warning/30 bg-warning/8",
            )}
          >
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-lg",
                event.flow === "receipt" ? "bg-success/15 text-success" : "bg-warning/15 text-warning",
              )}
            >
              {event.flow === "receipt" ? (
                <ArrowDownLeft className="size-5" />
              ) : (
                <ArrowUpRight className="size-5" />
              )}
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Scheduled Amount</p>
              <p
                className={cn(
                  "font-mono text-xl font-bold tabular-nums",
                  event.flow === "receipt" ? "text-success" : "text-warning",
                )}
              >
                {formatCurrency(event.amount)}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card px-4">
            <DetailRow label="Formula No" value={<span className="font-mono">{event.formula}</span>} />
            <DetailRow label="Item" value={event.item} />
            <DetailRow label="Type" value={event.flow === "receipt" ? "Receipt" : "Payment"} />
            <DetailRow label="Scheduled Date" value={formatDate(event.dueDate)} />
            <DetailRow
              label="Status"
              value={<StatusBadge tone="outline">{event.status}</StatusBadge>}
            />
          </div>

          <Link
            href={`/formulas/${event.formulaId}`}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            View formula
            <ChevronRight className="size-4" />
          </Link>
        </div>
      )}
    </SidePanel>
  )
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="animate-fade-in" />}>
      <CalendarContent />
    </Suspense>
  )
}
