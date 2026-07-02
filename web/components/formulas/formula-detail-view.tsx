"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Users,
  CalendarClock,
  FileText,
  Ship,
  History,
  Pencil,
  CheckCircle2,
  Share2,
  AlertTriangle,
  LayoutDashboard,
  PieChart,
  GitCommitVertical,
  Scale,
} from "lucide-react"
import type { Formula } from "@/lib/types"
import { formatCurrency, formatRelative, cn } from "@/lib/utils"
import { statusConfig, tradeTypeConfig } from "@/lib/status"
import { StatusBadge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { FormulaEquation } from "./formula-equation"
import {
  ParticipantsPanel,
  SchedulePanel,
  InvoicesPanel,
  LogisticsPanel,
  TimelinePanel,
  OverviewPanel,
  SharesPanel,
  VersionsPanel,
  SettlementPanel,
} from "./detail-panels"

function MetricPill({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-mono text-sm font-semibold tabular-nums",
          tone === "pos" && "text-success",
          tone === "neg" && "text-danger",
          !tone && "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  )
}

export function FormulaDetailView({ formula }: { formula: Formula }) {
  const [tab, setTab] = useState("overview")
  const status = statusConfig[formula.status]

  return (
    <div className="animate-fade-in pb-6">
      <Link
        href="/formulas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Formulas
      </Link>

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-bold text-foreground">{formula.number}</h1>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
              v{formula.version}
            </span>
          </div>
          <p className="mt-1.5 text-muted-foreground">
            {formula.item} · {tradeTypeConfig[formula.tradeType].label} · updated {formatRelative(formula.updatedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline">
            <Share2 className="size-4" />
            Share
          </Button>
          <Link href={`/formulas/${formula.id}/edit`} className={cn(buttonVariants({ variant: "outline" }))}>
            <Pencil className="size-4" />
            Edit
          </Link>
          <Button variant="accent" disabled={!formula.closeable}>
            <CheckCircle2 className="size-4" />
            {formula.closeable ? "Close Formula" : "Not Closeable"}
          </Button>
        </div>
      </div>

      {formula.attention && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <AlertTriangle className="size-4 shrink-0" />
          {formula.attention}
        </div>
      )}

      {/* Financials */}
      <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <FormulaEquation formula={formula} />
        <div className="grid grid-cols-2 gap-3 self-start">
          <MetricPill label="Actual Receipts" value={formatCurrency(formula.actualReceipts)} tone="pos" />
          <MetricPill label="Actual Payments" value={formatCurrency(formula.actualPayments)} />
          <MetricPill label="Receivable" value={formatCurrency(formula.receivable)} />
          <MetricPill label="Payable" value={formatCurrency(formula.payable)} />
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview">
              <LayoutDashboard className="size-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="timeline" count={formula.timeline.length}>
              <History className="size-4" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="participants" count={formula.participants.length}>
              <Users className="size-4" />
              Participants
            </TabsTrigger>
            <TabsTrigger value="payments" count={formula.schedule.length}>
              <CalendarClock className="size-4" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="invoices" count={formula.invoices.length}>
              <FileText className="size-4" />
              Invoices
            </TabsTrigger>
            <TabsTrigger value="logistics" count={formula.logistics.length}>
              <Ship className="size-4" />
              Logistics
            </TabsTrigger>
            <TabsTrigger value="shares" count={formula.participants.filter((p) => (p.sharePct ?? 0) > 0).length}>
              <PieChart className="size-4" />
              Shares
            </TabsTrigger>
            <TabsTrigger value="versions" count={Math.max(1, formula.version)}>
              <GitCommitVertical className="size-4" />
              Versions
            </TabsTrigger>
            <TabsTrigger value="settlement">
              <Scale className="size-4" />
              Settlement
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="overview">
              <OverviewPanel formula={formula} />
            </TabsContent>
            <TabsContent value="timeline">
              <TimelinePanel formula={formula} />
            </TabsContent>
            <TabsContent value="participants">
              <ParticipantsPanel formula={formula} />
            </TabsContent>
            <TabsContent value="payments">
              <SchedulePanel formula={formula} />
            </TabsContent>
            <TabsContent value="invoices">
              <InvoicesPanel formula={formula} />
            </TabsContent>
            <TabsContent value="logistics">
              <LogisticsPanel formula={formula} />
            </TabsContent>
            <TabsContent value="shares">
              <SharesPanel formula={formula} />
            </TabsContent>
            <TabsContent value="versions">
              <VersionsPanel formula={formula} />
            </TabsContent>
            <TabsContent value="settlement">
              <SettlementPanel formula={formula} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
