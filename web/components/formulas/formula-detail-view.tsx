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
  CheckCircle2,
  Ban,
  AlertTriangle,
  LayoutDashboard,
  PieChart,
  GitCommitVertical,
  Scale,
} from "lucide-react"
import { formatCurrency, formatRelative, cn } from "@/lib/utils"
import { statusConfig, tradeTypeConfig } from "@/lib/status"
import { deriveSettlement, buildTimeline } from "@/lib/formula-math"
import { StatusBadge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { FormulaEquation } from "./formula-equation"
import {
  ParticipantsPanel,
  ParticipantConfirmedKpiPanel,
  PaymentsPanel,
  InvoicesPanel,
  LogisticsPanel,
  OverviewPanel,
  SharesPanel,
  SettlementPanel,
} from "./detail-panels"
import { VersionsPanel } from "./versions-panel"
import { VersionTriggerFieldsPanel } from "./version-trigger-fields-panel"
import { useFormulaWorkflow } from "./workflows/formula-workflow-context"
import {
  PaymentWorkflowActions,
  ParticipantWorkflowActions,
  InvoiceWorkflowActions,
  LogisticsWorkflowActions,
  SixStatusControls,
  InvoiceCompletionChecklist,
  CloseFormulaDialog,
  CancelFormulaDialog,
  ShareWorkflowActions,
  triggerPaymentRecordCancel,
  ClosedPaymentsBanner,
  SettlementRecordCancelSection,
} from "./workflows/workflow-modals"
import {
  MetadataWorkflowActions,
  InvoiceStatusActions,
  SettlementWorkflowActions,
  SettlementLifecycleNote,
  ClosedSettlementBanner,
  TimelineWorkflowChrome,
} from "./workflows/batch-2-workflows"

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

export function FormulaDetailView() {
  const { formula, versionHistory, caps } = useFormulaWorkflow()
  const [tab, setTab] = useState("overview")
  const [closeOpen, setCloseOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const status = statusConfig[formula.status]
  const settlement = deriveSettlement(formula)
  const timelineCount = buildTimeline(formula, versionHistory).length

  return (
    <div className="animate-fade-in pb-6">
      <Link
        href="/formulas"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to Formulas
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-bold text-foreground">{formula.number}</h1>
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
              v{formula.latestVersionNo}
            </span>
            {formula.canceledAt && <StatusBadge tone="danger">Canceled (preview)</StatusBadge>}
          </div>
          <p className="mt-1.5 text-muted-foreground">
            {formula.item} · {tradeTypeConfig[formula.tradeType].label} · updated {formatRelative(formula.updatedAt)}
          </p>
        </div>
        {/* V0-HDR-01: Cancel/Close are COMPANY_ADMIN+ only (cancel:cancel, close:close).
            Hidden entirely — not disabled — for MANAGER/VIEWER and for closed/canceled formulas. */}
        {caps.canCloseOrCancel && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setCancelOpen(true)}>
              <Ban className="size-4" />
              Cancel Formula
            </Button>
            <Button
              variant="accent"
              className="gap-2"
              disabled={!formula.closeable || formula.isClosed}
              onClick={() => setCloseOpen(true)}
            >
              <CheckCircle2 className="size-4" />
              {formula.isClosed ? "Closed" : formula.closeable ? "Close Formula" : "Not Closeable"}
            </Button>
          </div>
        )}
      </div>

      {formula.attention && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          <AlertTriangle className="size-4 shrink-0" />
          {formula.attention}
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <FormulaEquation formula={formula} />
        <div className="grid grid-cols-2 gap-3 self-start">
          <MetricPill label="Actual Receipts" value={formatCurrency(settlement.actualReceipts)} tone="pos" />
          <MetricPill label="Actual Payments" value={formatCurrency(settlement.actualPayments)} />
          <MetricPill label="Receivable" value={formatCurrency(settlement.remainingReceivable)} />
          <MetricPill label="Payable" value={formatCurrency(settlement.remainingPayable)} />
        </div>
      </div>

      <div className="mt-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="overview">
              <LayoutDashboard className="size-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="timeline" count={timelineCount}>
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
            <TabsTrigger value="shares" count={(formula.shares ?? []).length}>
              <PieChart className="size-4" />
              Shares
            </TabsTrigger>
            <TabsTrigger value="versions" count={Math.max(1, formula.latestVersionNo)}>
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
              <div className="space-y-4">
                <SixStatusControls onNavigate={setTab} />
                <InvoiceCompletionChecklist onNavigate={setTab} />
                <MetadataWorkflowActions />
                <OverviewPanel formula={formula} />
              </div>
            </TabsContent>
            <TabsContent value="timeline">
              <TimelineWorkflowChrome formula={formula} versionHistory={versionHistory} onNavigate={setTab} />
            </TabsContent>
            <TabsContent value="participants">
              <ParticipantWorkflowActions />
              <div className="space-y-5">
                <ParticipantConfirmedKpiPanel formula={formula} />
                <ParticipantsPanel formula={formula} />
              </div>
            </TabsContent>
            <TabsContent value="payments">
              {formula.isClosed ? (
                <ClosedPaymentsBanner />
              ) : (
                <PaymentWorkflowActions onCancelRecord={triggerPaymentRecordCancel} />
              )}
              <PaymentsPanel
                formula={formula}
                canWrite={caps.canCancelPayment && !formula.isClosed}
                onCancelRecord={triggerPaymentRecordCancel}
              />
            </TabsContent>
            <TabsContent value="invoices">
              <InvoiceWorkflowActions />
              <InvoicesPanel
                formula={formula}
                renderInvoiceActions={(inv) => <InvoiceStatusActions invoice={inv} />}
              />
            </TabsContent>
            <TabsContent value="logistics">
              <LogisticsWorkflowActions />
              <LogisticsPanel formula={formula} />
            </TabsContent>
            <TabsContent value="shares">
              <ShareWorkflowActions />
              <SharesPanel formula={formula} />
            </TabsContent>
            <TabsContent value="versions">
              <div className="space-y-6">
                <VersionsPanel formula={formula} versionHistory={versionHistory} />
                <VersionTriggerFieldsPanel formula={formula} />
              </div>
            </TabsContent>
            <TabsContent value="settlement">
              <ClosedSettlementBanner />
              <SettlementLifecycleNote />
              <SettlementRecordCancelSection />
              <SettlementWorkflowActions />
              <SettlementPanel formula={formula} />
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <CloseFormulaDialog open={closeOpen} onClose={() => setCloseOpen(false)} />
      <CancelFormulaDialog open={cancelOpen} onClose={() => setCancelOpen(false)} />
    </div>
  )
}
