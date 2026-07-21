"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { useCompany } from "@/components/company-context"
import { useDateRange } from "@/components/date-range-context"
import { PageHeader } from "@/components/page-header"
import { CreateFormulaButton } from "@/components/formulas/create-formula-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { ProfitChart } from "@/components/dashboard/profit-chart"
import { LossRanking } from "@/components/dashboard/loss-ranking"
import { CashflowTimeline } from "@/components/dashboard/cashflow-timeline"
import { FormulaMiniRow } from "@/components/dashboard/formula-mini-row"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { DateRangeSelector } from "@/components/shell/date-range-selector"
import { AnalyticsCompanyFilter } from "@/components/shell/analytics-company-filter"
import { dateRangeLabel } from "@/lib/date-range-labels"
import { t } from "@/lib/i18n"
import {
  analyticsCompanyName,
  getKpis,
  getProfitSeries,
  getLossRanking,
  getCashflowTimeline,
  getAnalyticsFormulas,
  analyticsDrillContext,
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
  const { range, customStart, customEnd } = useDateRange()
  const rangeLabel = dateRangeLabel(range)
  const operatingId = selected.id

  // Analytical company filter — separate from the operating scope switcher.
  // Defaults to "all in scope" (the operating id) and resets when scope changes.
  const [analyticsId, setAnalyticsId] = React.useState(operatingId)
  React.useEffect(() => {
    setAnalyticsId(operatingId)
  }, [operatingId])

  const companyId = analyticsId
  const perspective = companyId !== operatingId
  // Undefined in "all in scope" mode so downstream adapters use owner totals.
  const analyticsArg = perspective ? analyticsId : undefined
  const ctx = analyticsDrillContext(operatingId, range, analyticsArg)

  const kpis = getKpis(operatingId, range, customStart, customEnd, analyticsArg)
  const profitData = getProfitSeries(operatingId, range, customStart, customEnd, analyticsArg, (count) =>
    t("dashboard.profit.weekLabel", { count }),
  )
  const lossRanking = getLossRanking(operatingId, analyticsArg)
  const receipts = getCashflowTimeline(operatingId, "receipt", analyticsArg)
  const payments = getCashflowTimeline(operatingId, "payment", analyticsArg)
  const all = getAnalyticsFormulas(operatingId, analyticsArg)
  const recent = [...all].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).slice(0, 5)
  const attention = all.filter((f) => f.attention).slice(0, 5)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t("dashboard.header.title")}
        description={
          perspective
            ? t("dashboard.header.perspectiveDescription", {
                company: selected.name,
                analyticsCompany: analyticsCompanyName(companyId),
                range: rangeLabel,
              })
            : t("dashboard.header.description", { company: selected.name, range: rangeLabel })
        }
        actions={
          <div className="flex items-center gap-2">
            <AnalyticsCompanyFilter operatingId={operatingId} value={analyticsId} onChange={setAnalyticsId} />
            <div className="md:hidden">
              <DateRangeSelector />
            </div>
            <CreateFormulaButton />
          </div>
        }
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
          title={t("dashboard.profit.title", { range: rangeLabel })}
          className="lg:col-span-2"
          action={{ label: t("dashboard.profit.reportsAction"), href: `/reports?${ctx.slice(1)}` }}
        >
          <ProfitChart data={profitData} />
        </SectionCard>
        <SectionCard
          title={t("dashboard.lossRanking.title")}
          action={{ label: t("dashboard.lossRanking.viewAction"), href: `/formulas?filter=loss${ctx}` }}
        >
          <LossRanking formulas={lossRanking} />
        </SectionCard>
      </div>

      {/* 3. Cashflow area */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard
          title={t("dashboard.cashflow.receiptsTitle")}
          action={{ label: t("dashboard.cashflow.allReceiptsAction"), href: `/calendar?type=receipt${ctx}` }}
        >
          <CashflowTimeline items={receipts} type="receipt" />
        </SectionCard>
        <SectionCard
          title={t("dashboard.cashflow.paymentsTitle")}
          action={{ label: t("dashboard.cashflow.allPaymentsAction"), href: `/calendar?type=payment${ctx}` }}
        >
          <CashflowTimeline items={payments} type="payment" />
        </SectionCard>
      </div>

      {/* 4. Formula area */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard
          title={t("dashboard.formulas.recentTitle")}
          action={{ label: t("dashboard.formulas.allAction"), href: `/formulas?${ctx.slice(1)}` }}
        >
          <div className="flex flex-col gap-0.5">
            {recent.map((f) => (
              <FormulaMiniRow key={f.id} formula={f} />
            ))}
          </div>
        </SectionCard>
        <SectionCard
          title={t("dashboard.formulas.attentionTitle")}
          action={{ label: t("dashboard.formulas.reviewAction"), href: `/formulas?filter=attention${ctx}` }}
        >
          {attention.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {attention.map((f) => (
                <FormulaMiniRow key={f.id} formula={f} showAttention />
              ))}
            </div>
          ) : (
            <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
              {t("dashboard.formulas.attentionEmpty")}
            </div>
          )}
        </SectionCard>
      </div>

      {/* 5. Quick actions */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">{t("dashboard.quickActions.title")}</h2>
        <QuickActions />
      </div>
    </div>
  )
}
