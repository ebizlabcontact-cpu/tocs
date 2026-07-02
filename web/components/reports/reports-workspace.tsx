"use client"

import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Info, Activity, LayoutDashboard, SlidersHorizontal } from "lucide-react"
import { useCompany } from "@/components/company-context"
import { useDateRange } from "@/components/date-range-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/field"
import { DATE_RANGES } from "@/lib/mock-data"
import type { DateRange } from "@/lib/types"
import {
  METRICS,
  DIMENSIONS,
  type MetricKey,
  type DimensionKey,
  buildGroupedReport,
  getExecutiveSummary,
  getOperationalSummary,
  getTrendSummary,
} from "@/lib/reports"
import { cn, formatCurrency, formatNumber } from "@/lib/utils"

const AXIS = "#64748b"
const GRID = "#e5e7eb"
const COLORS = ["#3b82f6", "#7c3aed", "#10b981", "#f59e0b", "#ef4444", "#0ea5e9", "#64748b"]

const chartTooltip = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
    fontSize: 13,
  },
}

export function ReportsWorkspace() {
  const { selected } = useCompany()
  const { range: globalRange } = useDateRange()
  const companyId = selected.id

  const [view, setView] = useState<"default" | "custom">("default")
  const [period, setPeriod] = useState<DateRange>(globalRange === "Custom Range" ? "Last 30 Days" : globalRange)

  return (
    <>
      {/* Microcopy — Reports are a projection of Formula data. */}
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm text-accent">
        <Info className="size-4 shrink-0" />
        Reports are derived from Formula data.
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={view} onValueChange={(v) => setView(v as "default" | "custom")}>
          <TabsList>
            <TabsTrigger value="default">
              <LayoutDashboard className="size-4" />
              Default
            </TabsTrigger>
            <TabsTrigger value="custom">
              <SlidersHorizontal className="size-4" />
              Custom
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Period</span>
          <Select value={period} onChange={(e) => setPeriod(e.target.value as DateRange)} className="h-9 w-40">
            {DATE_RANGES.filter((r) => r !== "Custom Range").map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {view === "default" ? (
        <DefaultView companyId={companyId} period={period} />
      ) : (
        <CustomView companyId={companyId} period={period} setPeriod={setPeriod} />
      )}
    </>
  )
}

/* ---------------------------------- Default ---------------------------------- */

function DefaultView({ companyId, period }: { companyId: string; period: DateRange }) {
  const [tab, setTab] = useState("executive")
  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="mb-5">
        <TabsTrigger value="executive">Executive Summary</TabsTrigger>
        <TabsTrigger value="operational">Operational Summary</TabsTrigger>
        <TabsTrigger value="trend">Trend Summary</TabsTrigger>
      </TabsList>

      <TabsContent value="executive">
        <ExecutiveSummaryView companyId={companyId} period={period} />
      </TabsContent>
      <TabsContent value="operational">
        <OperationalSummaryView companyId={companyId} />
      </TabsContent>
      <TabsContent value="trend">
        <TrendSummaryView companyId={companyId} period={period} />
      </TabsContent>
    </Tabs>
  )
}

function ExecutiveSummaryView({ companyId, period }: { companyId: string; period: DateRange }) {
  const s = useMemo(() => getExecutiveSummary(companyId, period), [companyId, period])
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Realized Profit" value={formatCurrency(s.realizedProfit, { compact: true })} intent="success" />
        <Stat label="Expected Profit" value={formatCurrency(s.expectedProfit, { compact: true })} intent="info" />
        <Stat label="Accounts Receivable" value={formatCurrency(s.receivable, { compact: true })} />
        <Stat label="Accounts Payable" value={formatCurrency(s.payable, { compact: true })} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Realized Profit Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={s.profitSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rpFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: AXIS }} dy={8} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: AXIS }}
                    tickFormatter={(v) => formatCurrency(v, { compact: true })}
                    width={56}
                  />
                  <Tooltip {...chartTooltip} formatter={(v: number) => [formatCurrency(v), "Realized Profit"]} />
                  <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2.5} fill="url(#rpFill)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Formulas by Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleTable
              cols={["Formula", "Realized"]}
              rows={s.topFormulas.map((f) => [
                <span key="n" className="font-mono text-xs text-muted-foreground">{f.number}</span>,
                <span key="v" className={cn("tabular-nums font-medium", f.realized < 0 ? "text-danger" : "text-success")}>
                  {formatCurrency(f.realized, { compact: true })}
                </span>,
              ])}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function OperationalSummaryView({ companyId }: { companyId: string }) {
  const s = useMemo(() => getOperationalSummary(companyId), [companyId])
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Closeable" value={formatNumber(s.closeable)} intent="success" icon={<Activity className="size-4" />} />
        <Stat label="Invoice Unmatched" value={formatNumber(s.invoiceUnmatched)} intent="danger" />
        <Stat label="In Transit" value={formatNumber(s.logisticsInTransit)} intent="info" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Formulas by Status">
          <CountBarChart rows={s.byStatus} />
        </ChartCard>
        <ChartCard title="Formulas by Trade Type">
          <CountBarChart rows={s.byTradeType} />
        </ChartCard>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attention Required</CardTitle>
        </CardHeader>
        <CardContent>
          {s.attention.length > 0 ? (
            <SimpleTable
              cols={["Formula", "Item", "Note"]}
              rows={s.attention.map((a) => [
                <span key="n" className="font-mono text-xs text-muted-foreground">{a.number}</span>,
                <span key="i" className="text-foreground">{a.item}</span>,
                <span key="t" className="text-muted-foreground">{a.note}</span>,
              ])}
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Nothing needs attention.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TrendSummaryView({ companyId, period }: { companyId: string; period: DateRange }) {
  const data = useMemo(() => getTrendSummary(companyId, period), [companyId, period])
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Realized vs Expected Profit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="realizedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expectedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: AXIS }} dy={8} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: AXIS }}
                  tickFormatter={(v) => formatCurrency(v, { compact: true })}
                  width={56}
                />
                <Tooltip {...chartTooltip} formatter={(v: number, n) => [formatCurrency(v), n === "realized" ? "Realized" : "Expected"]} />
                <Area type="monotone" dataKey="expected" stroke="#3b82f6" strokeWidth={2} fill="url(#expectedFill)" dot={false} isAnimationActive={false} />
                <Area type="monotone" dataKey="realized" stroke="#10b981" strokeWidth={2.5} fill="url(#realizedFill)" dot={false} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center gap-5 text-xs text-muted-foreground">
            <Legend color="#10b981" label="Realized" />
            <Legend color="#3b82f6" label="Expected" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Period Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <SimpleTable
            cols={["Period", "Expected", "Realized"]}
            rows={data.map((d) => [
              <span key="m" className="text-foreground">{d.month}</span>,
              <span key="e" className="tabular-nums text-info">{formatCurrency(d.expected, { compact: true })}</span>,
              <span key="r" className="tabular-nums text-success">{formatCurrency(d.realized, { compact: true })}</span>,
            ])}
          />
        </CardContent>
      </Card>
    </div>
  )
}

/* ---------------------------------- Custom ---------------------------------- */

function CustomView({
  companyId,
  period,
  setPeriod,
}: {
  companyId: string
  period: DateRange
  setPeriod: (r: DateRange) => void
}) {
  const [metric, setMetric] = useState<MetricKey>("realized")
  const [dimension, setDimension] = useState<DimensionKey>("company")

  const { rows, total } = useMemo(
    () => buildGroupedReport(companyId, metric, dimension, period),
    [companyId, metric, dimension, period],
  )
  const metricMeta = METRICS.find((m) => m.key === metric)!

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Metric</span>
            <Select value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)}>
              {METRICS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Dimension</span>
            <Select value={dimension} onChange={(e) => setDimension(e.target.value as DimensionKey)}>
              {DIMENSIONS.map((d) => (
                <option key={d.key} value={d.key}>
                  {d.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Period</span>
            <Select value={period} onChange={(e) => setPeriod(e.target.value as DateRange)}>
              {DATE_RANGES.filter((r) => r !== "Custom Range").map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>
            {metricMeta.label} by {DIMENSIONS.find((d) => d.key === dimension)!.label}
          </CardTitle>
          <Badge tone="outline">Total {formatCurrency(total, { compact: true })}</Badge>
        </CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: AXIS }} dy={8} interval={0} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: AXIS }}
                  tickFormatter={(v) => formatCurrency(v, { compact: true })}
                  width={56}
                />
                <Tooltip {...chartTooltip} formatter={(v: number) => [formatCurrency(v), metricMeta.label]} cursor={{ fill: "#f1f5f9" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {rows.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <SimpleTable
            cols={[DIMENSIONS.find((d) => d.key === dimension)!.label, "Formulas", metricMeta.label, "Share"]}
            rows={rows.map((r) => [
              <span key="l" className="text-foreground">{r.label}</span>,
              <span key="c" className="tabular-nums text-muted-foreground">{r.count}</span>,
              <span key="v" className={cn("tabular-nums font-medium", r.value < 0 ? "text-danger" : "text-foreground")}>
                {formatCurrency(r.value, { compact: true })}
              </span>,
              <span key="s" className="tabular-nums text-muted-foreground">
                {total !== 0 ? `${Math.round((r.value / total) * 100)}%` : "—"}
              </span>,
            ])}
          />
        </CardContent>
      </Card>
    </div>
  )
}

/* ---------------------------------- Shared ---------------------------------- */

function Stat({
  label,
  value,
  intent = "neutral",
  icon,
}: {
  label: string
  value: string
  intent?: "neutral" | "success" | "info" | "danger"
  icon?: React.ReactNode
}) {
  const color =
    intent === "success"
      ? "text-success"
      : intent === "info"
        ? "text-info"
        : intent === "danger"
          ? "text-danger"
          : "text-foreground"
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={cn("mt-1.5 text-xl font-semibold tabular-nums", color)}>{value}</p>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function CountBarChart({ rows }: { rows: { label: string; value: number }[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: AXIS }} dy={8} interval={0} />
          <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: AXIS }} allowDecimals={false} width={28} />
          <Tooltip {...chartTooltip} formatter={(v: number) => [v, "Formulas"]} cursor={{ fill: "#f1f5f9" }} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {rows.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function SimpleTable({ cols, rows }: { cols: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            {cols.map((c, i) => (
              <th key={c} className={cn("pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground", i > 0 && "text-right")}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border/60 last:border-0">
              {row.map((cell, ci) => (
                <td key={ci} className={cn("py-2.5", ci > 0 && "text-right")}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
