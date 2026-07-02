"use client"

import Link from "next/link"
import { ArrowRight, Building2, CheckCircle2 } from "lucide-react"
import { useCompany } from "@/components/company-context"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { companies, getFormulasByCompany } from "@/lib/mock-data"
import { cn, formatCurrency } from "@/lib/utils"

function companyStats(companyId: string) {
  const list = getFormulasByCompany(companyId)
  const realized = list.filter((f) => f.realizedProfit > 0).reduce((s, f) => s + f.realizedProfit, 0)
  const receivable = list.reduce((s, f) => s + f.receivable, 0)
  const payable = list.reduce((s, f) => s + f.payable, 0)
  const active = list.filter((f) => f.status === "active").length
  return { count: list.length, realized, receivable, payable, active }
}

export default function CompaniesPage() {
  const { selected, setCompany } = useCompany()
  const real = companies.filter((c) => c.id !== "all")

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Companies"
        description="Every legal entity you operate. Switch context or review each book of business."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {real.map((company) => {
          const stats = companyStats(company.id)
          const isActive = selected.id === company.id
          return (
            <Card key={company.id} className={cn("transition-colors", isActive && "border-accent/50")}>
              <CardContent className="flex flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
                      style={{ backgroundColor: company.color }}
                    >
                      {company.shortName}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">{company.name}</p>
                      <p className="text-xs text-muted-foreground">{stats.count} formulas · {stats.active} active</p>
                    </div>
                  </div>
                  {isActive && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                      <CheckCircle2 className="size-3" />
                      Current
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-border pt-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Realized</span>
                    <span className="text-sm font-semibold tabular-nums text-success">
                      {formatCurrency(stats.realized, { compact: true })}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Receivable</span>
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(stats.receivable, { compact: true })}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Payable</span>
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrency(stats.payable, { compact: true })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCompany(company.id)}
                    disabled={isActive}
                    className={cn(
                      "flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors",
                      isActive
                        ? "cursor-default bg-muted text-muted-foreground"
                        : "bg-accent text-accent-foreground hover:opacity-90",
                    )}
                  >
                    {isActive ? "Active context" : "Switch to company"}
                  </button>
                  <Link
                    href="/formulas"
                    className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:border-accent/40 hover:text-accent"
                  >
                    Formulas
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="mt-6 flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Building2 className="size-4 shrink-0 text-accent" />
        Use the company switcher in the header to enter <span className="font-medium text-foreground">All Companies</span> mode for a consolidated, read-only overview.
      </div>
    </div>
  )
}
