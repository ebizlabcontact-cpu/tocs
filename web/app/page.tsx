"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useCompany } from "@/components/company-context"
import { PageHeader } from "@/components/page-header"
import { CreateFormulaButton } from "@/components/formulas/create-formula-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { ProfitChart } from "@/components/dashboard/profit-chart"
import { LossRanking } from "@/components/dashboard/loss-ranking"
import { CashflowTimeline } from "@/components/dashboard/cashflow-timeline"
import { FormulaMiniRow } from "@/components/dashboard/formula-mini-row"
import { QuickActions } from "@/components/dashboard/quick-actions"
import {
  getKpis,
  getMonthlyRealizedProfit,
  getLossRanking,
  getCashflowTimeline,
  getFormulasByCompany,
} from "@/lib/mock-data"

function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: { label: string; href: string }
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {action && (
          <Link
            href={action.href}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-accent"
          >
            {action.label}
            <ArrowRight className="size-3.5" />
          </Link>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { selected } = useCompany()
  const companyId = selected.id

  const kpis = getKpis(companyId)
  const profitData = getMonthlyRealizedProfit(companyId)
  const lossRanking = getLossRanking(companyId)
  const receipts = getCashflowTimeline(companyId, "receipt")
  const payments = getCashflowTimeline(companyId, "payment")
  const all = getFormulasByCompany(companyId)
  const recent = [...all].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 5)
  const attention = all.filter((f) => f.attention).slice(0, 5)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Command Center"
        description={`Realized performance for ${selected.name}. Understand your business at a glance.`}
        actions={<CreateFormulaButton />}
      />

      {/* 1. KPI cards — realized profit only */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.key} kpi={kpi} />
        ))}
      </div>

      {/* 2. Profit area */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="Monthly Realized Profit"
          className="lg:col-span-2"
          action={{ label: "Reports", href: "/reports" }}
        >
          <ProfitChart data={profitData} />
        </SectionCard>
        <SectionCard title="Loss Formula Ranking" action={{ label: "View losses", href: "/formulas?filter=loss" }}>
          <LossRanking formulas={lossRanking} />
        </SectionCard>
      </div>

      {/* 3. Cashflow area */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Upcoming Receipts" action={{ label: "All receipts", href: "/calendar?type=receipt" }}>
          <CashflowTimeline items={receipts} type="receipt" />
        </SectionCard>
        <SectionCard title="Upcoming Payments" action={{ label: "All payments", href: "/calendar?type=payment" }}>
          <CashflowTimeline items={payments} type="payment" />
        </SectionCard>
      </div>

      {/* 4. Formula area */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Recent Formulas" action={{ label: "All formulas", href: "/formulas" }}>
          <div className="flex flex-col gap-0.5">
            {recent.map((f) => (
              <FormulaMiniRow key={f.id} formula={f} />
            ))}
          </div>
        </SectionCard>
        <SectionCard
          title="Attention Required"
          action={{ label: "Review", href: "/formulas?filter=attention" }}
        >
          {attention.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {attention.map((f) => (
                <FormulaMiniRow key={f.id} formula={f} showAttention />
              ))}
            </div>
          ) : (
            <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
              Nothing needs attention right now.
            </div>
          )}
        </SectionCard>
      </div>

      {/* 5. Quick actions */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Quick Actions</h2>
        <QuickActions />
      </div>
    </div>
  )
}
