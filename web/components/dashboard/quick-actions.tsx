"use client"

import Link from "next/link"
import { Plus, ArrowDownLeft, ArrowUpRight, ReceiptText } from "lucide-react"
import { useCompany } from "@/components/company-context"
import { Tooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const actions = [
  { label: "Create Formula", href: "/formulas/new", icon: Plus, accent: true },
  { label: "Upcoming Receipts", href: "/calendar?type=receipt", icon: ArrowDownLeft },
  { label: "Upcoming Payments", href: "/calendar?type=payment", icon: ArrowUpRight },
  { label: "Review Invoicing", href: "/formulas?filter=invoicing", icon: ReceiptText },
]

const ALL_COMPANIES_HINT = "Switch to a specific company to use quick actions."

export function QuickActions() {
  const { isAllCompanies } = useCompany()

  const cardClass = (accent?: boolean) =>
    cn(
      "flex items-center gap-2.5 rounded-[var(--radius-lg)] border p-3 text-sm font-medium transition-all",
      accent ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-foreground",
    )

  const iconClass = (accent?: boolean) =>
    cn(
      "flex size-8 items-center justify-center rounded-[var(--radius-md)]",
      accent ? "bg-white/20" : "bg-secondary text-accent",
    )

  if (isAllCompanies) {
    return (
      <Tooltip content={ALL_COMPANIES_HINT} className="block w-full">
        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4" aria-disabled="true">
          {actions.map((a) => (
            <div key={a.label} className={cn(cardClass(a.accent), "cursor-not-allowed opacity-50")}>
              <span className={iconClass(a.accent)}>
                <a.icon className="size-4" />
              </span>
              {a.label}
            </div>
          ))}
        </div>
      </Tooltip>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {actions.map((a) => (
        <Link
          key={a.label}
          href={a.href}
          className={cn(
            cardClass(a.accent),
            "hover:shadow-[var(--shadow-soft)]",
            a.accent ? "hover:bg-accent/90" : "hover:border-accent/40",
          )}
        >
          <span className={iconClass(a.accent)}>
            <a.icon className="size-4" />
          </span>
          {a.label}
        </Link>
      ))}
    </div>
  )
}
