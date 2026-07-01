import { ArrowDownLeft, ArrowUpRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { scheduleStatusConfig } from "@/lib/status"
import { formatCurrency, formatDate } from "@/lib/utils"

type Item = {
  id: string
  counterparty: string
  amount: number
  settledAmount: number
  dueDate: string
  status: string
  formula: string
  item: string
}

export function CashflowTimeline({ items, type }: { items: Item[]; type: "receipt" | "payment" }) {
  const isReceipt = type === "receipt"

  if (items.length === 0) {
    return (
      <div className="flex h-full min-h-40 items-center justify-center text-sm text-muted-foreground">
        No upcoming {isReceipt ? "receipts" : "payments"}.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {items.map((it) => {
        const cfg = scheduleStatusConfig[it.status] ?? scheduleStatusConfig.scheduled
        return (
          <div
            key={`${it.formula}-${it.id}`}
            className="flex items-center gap-3 rounded-[var(--radius-md)] p-2 transition-colors hover:bg-secondary"
          >
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] ${
                isReceipt ? "bg-info-soft text-info" : "bg-warning-soft text-warning"
              }`}
            >
              {isReceipt ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{it.counterparty}</p>
              <p className="truncate text-xs text-muted-foreground">
                {it.formula} · {it.item}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold tabular-nums text-foreground">
                {formatCurrency(it.amount - it.settledAmount, { compact: true })}
              </p>
              <p className="text-xs text-muted-foreground">{formatDate(it.dueDate, { month: "short", day: "numeric" })}</p>
            </div>
            <Badge tone={cfg.tone as never} className="hidden shrink-0 sm:inline-flex">
              {cfg.label}
            </Badge>
          </div>
        )
      })}
    </div>
  )
}
