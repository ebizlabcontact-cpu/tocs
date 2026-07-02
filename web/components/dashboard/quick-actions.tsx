import Link from "next/link"
import { Plus, ArrowDownLeft, ArrowUpRight, ReceiptText } from "lucide-react"

const actions = [
  { label: "Create Formula", href: "/formulas/new", icon: Plus, accent: true },
  { label: "Record Receipt", href: "/payments?type=receipt", icon: ArrowDownLeft },
  { label: "Record Payment", href: "/payments?type=payment", icon: ArrowUpRight },
  { label: "Review Invoices", href: "/invoices", icon: ReceiptText },
]

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {actions.map((a) => (
        <Link
          key={a.label}
          href={a.href}
          className={`flex items-center gap-2.5 rounded-[var(--radius-lg)] border p-3 text-sm font-medium transition-all hover:shadow-[var(--shadow-soft)] ${
            a.accent
              ? "border-accent bg-accent text-accent-foreground hover:bg-accent/90"
              : "border-border bg-card text-foreground hover:border-accent/40"
          }`}
        >
          <span
            className={`flex size-8 items-center justify-center rounded-[var(--radius-md)] ${
              a.accent ? "bg-white/20" : "bg-secondary text-accent"
            }`}
          >
            <a.icon className="size-4" />
          </span>
          {a.label}
        </Link>
      ))}
    </div>
  )
}
