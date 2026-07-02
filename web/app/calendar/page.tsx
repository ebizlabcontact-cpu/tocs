"use client"

import { Suspense, useMemo, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowDownLeft, ArrowUpRight, CalendarDays } from "lucide-react"
import { useCompany } from "@/components/company-context"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getCashflowTimeline } from "@/lib/mock-data"
import { cn, formatCurrency, formatDate } from "@/lib/utils"

type Flow = "all" | "receipt" | "payment"

function CalendarContent() {
  const { selected } = useCompany()
  const params = useSearchParams()
  const initial = (params.get("type") as Flow | null) ?? "all"
  const [flow, setFlow] = useState<Flow>(["all", "receipt", "payment"].includes(initial) ? initial : "all")

  const receipts = useMemo(() => getCashflowTimeline(selected.id, "receipt"), [selected.id])
  const payments = useMemo(() => getCashflowTimeline(selected.id, "payment"), [selected.id])

  const events = useMemo(() => {
    const merged = [
      ...(flow !== "payment" ? receipts.map((r) => ({ ...r, flow: "receipt" as const })) : []),
      ...(flow !== "receipt" ? payments.map((p) => ({ ...p, flow: "payment" as const })) : []),
    ].sort((a, b) => Date.parse(a.dueDate) - Date.parse(b.dueDate))

    const groups = new Map<string, typeof merged>()
    for (const e of merged) {
      const key = formatDate(e.dueDate)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(e)
    }
    return Array.from(groups.entries())
  }, [receipts, payments, flow])

  const totalReceipt = receipts.reduce((s, r) => s + (r.amount - r.settledAmount), 0)
  const totalPayment = payments.reduce((s, p) => s + (p.amount - p.settledAmount), 0)

  const tabs: { key: Flow; label: string }[] = [
    { key: "all", label: "All" },
    { key: "receipt", label: "Receipts" },
    { key: "payment", label: "Payments" },
  ]

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Calendar"
        description="Upcoming settlement schedule across your active formulas."
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

      <div className="mt-4 inline-flex rounded-lg border border-border bg-card p-1">
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

      {events.length > 0 ? (
        <div className="mt-4 flex flex-col gap-4">
          {events.map(([date, list]) => (
            <div key={date} className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <CalendarDays className="size-3.5" />
                {date}
              </div>
              <Card>
                <CardContent className="divide-y divide-border p-0">
                  {list.map((e, idx) => (
                    <Link
                      key={`${e.formula}-${idx}`}
                      href="/formulas"
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-lg",
                            e.flow === "receipt" ? "bg-success/12 text-success" : "bg-warning/12 text-warning",
                          )}
                        >
                          {e.flow === "receipt" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            <span className="font-mono">{e.formula}</span> · {e.item}
                          </p>
                          <p className="text-xs capitalize text-muted-foreground">{e.flow} · {e.status}</p>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 text-sm font-semibold tabular-nums",
                          e.flow === "receipt" ? "text-success" : "text-warning",
                        )}
                      >
                        {formatCurrency(e.amount - e.settledAmount, { compact: true })}
                      </span>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-16 flex flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm font-medium text-foreground">No scheduled cashflow</p>
          <p className="text-sm text-muted-foreground">There are no upcoming events for this filter.</p>
        </div>
      )}
    </div>
  )
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="animate-fade-in" />}>
      <CalendarContent />
    </Suspense>
  )
}
