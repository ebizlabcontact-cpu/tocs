"use client"

import type { Formula } from "@/lib/types"
import type { VersionEntry } from "@/lib/types"
import { type ReactNode, useState } from "react"
import { formatCurrency, formatDate, formatNumber, cn } from "@/lib/utils"
import { t, type TranslationKey } from "@/lib/i18n"
import {
  detailRelativeTime,
  sixStatusLabel,
  sixStatusValue,
  detailTradeTypeLabel,
} from "@/lib/formula-detail-labels"
import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"
import { StatusBadge, type BadgeTone } from "@/components/ui/badge"
import { CalculationBreakdown } from "./calculation-breakdown"
import { FormulaChainView } from "./formula-chain"
import { SettlementScenarios } from "@/components/wizard/settlement-scenarios"
import {
  deriveSettlement,
  deriveExpected,
  deriveRealized,
  scheduleFulfillment,
  sixStatuses,
  isCloseable,
  isFormulaCanceled,
  deriveInvoiceVerification,
  deriveInvoiceClose,
  buildTimeline,
  chainOrderOf,
  deriveParticipantConfirmedKpi,
} from "@/lib/formula-math"
import type { StatusLogType } from "@/lib/types"
import { getVersionHistory } from "@/lib/mock-data"
import {
  cashStatusConfig,
  deliveryStatusConfig,
  invoiceStatusConfig,
  logisticsStatusConfig,
  formulaLogisticsStatusConfig,
  scheduleStatusConfig,
  statusConfig,
  formulaStatusLabel,
  tradeStatusConfig,
  tradeTypeConfig,
} from "@/lib/status"
import {
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Ship,
  Plane,
  Truck,
  PackageCheck,
  Clock,
  GitCommitVertical,
  Handshake,
  StickyNote,
  Plus,
  PieChart,
  Scale,
  CheckCircle2,
  Circle,
  Ban,
  Lock,
  MessageSquare,
  Link2,
  AlertTriangle,
  Info,
  CalendarClock,
  Repeat,
  ChevronRight,
  ChevronDown,
  Container,
  Activity,
  LayoutDashboard,
  Users,
} from "lucide-react"

function SectionEmpty({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
      {label}
    </div>
  )
}

/* ---------------- Formula Lifecycle Guide (P1-1) ---------------- */

type LifecycleStep = {
  n: number
  labelKey: TranslationKey
  tab: string | null
  icon: React.ComponentType<{ className?: string }>
}

const LIFECYCLE_STEPS: LifecycleStep[] = [
  { n: 1, labelKey: "formulas.detail.lifecycle.formula", tab: "overview", icon: LayoutDashboard },
  { n: 2, labelKey: "formulas.detail.lifecycle.participants", tab: "participants", icon: Users },
  { n: 3, labelKey: "formulas.detail.lifecycle.payments", tab: "payments", icon: CalendarClock },
  { n: 4, labelKey: "formulas.detail.lifecycle.invoices", tab: "invoices", icon: FileText },
  { n: 5, labelKey: "formulas.detail.lifecycle.logistics", tab: "logistics", icon: Ship },
  { n: 6, labelKey: "formulas.detail.lifecycle.shares", tab: "shares", icon: PieChart },
  { n: 7, labelKey: "formulas.detail.lifecycle.versions", tab: "versions", icon: GitCommitVertical },
  { n: 8, labelKey: "formulas.detail.lifecycle.settlement", tab: "settlement", icon: Scale },
  { n: 9, labelKey: "formulas.detail.lifecycle.close", tab: null, icon: CheckCircle2 },
]

function lifecycleStepDone(f: Formula, step: LifecycleStep): boolean {
  switch (step.tab) {
    case "overview":
      return true
    case "participants":
      return f.participants.length >= 2
    case "payments":
      return f.schedule.length >= 1
    case "invoices":
      return f.invoices.length >= 1
    case "logistics":
      return f.logistics.length >= 1
    case "shares":
      return (f.shares ?? []).length >= 1
    case "versions":
      return f.latestVersionNo >= 1
    case "settlement":
      return (f.records ?? []).length >= 1
    case null:
      return f.isClosed
    default:
      return false
  }
}

function lifecycleStepChip(f: Formula, step: LifecycleStep): string {
  const statuses = sixStatuses(f)
  const doneCount = statuses.filter((s) => s.done).length
  switch (step.tab) {
    case "overview":
      return t("formulas.detail.lifecycle.statusesReady", { count: doneCount })
    case "participants":
      return t("formulas.detail.lifecycle.participantCount", { count: f.participants.length })
    case "payments":
      return t("formulas.detail.lifecycle.paymentCounts", {
        schedules: f.schedule.length,
        records: (f.records ?? []).length,
      })
    case "invoices":
      return deriveInvoiceClose(f).done ? t("formulas.detail.lifecycle.matched") : t("formulas.detail.lifecycle.incomplete")
    case "logistics":
      return f.logisticsStatus === "delivered"
        ? t("formulas.detail.lifecycle.complete")
        : sixStatusValue(f, "logistics", formulaLogisticsStatusConfig[f.logisticsStatus]?.label ?? f.logisticsStatus)
    case "shares":
      return String((f.shares ?? []).length)
    case "versions":
      return t("formulas.detail.header.version", { version: f.latestVersionNo })
    case "settlement":
      return (f.records ?? []).length > 0 ? t("formulas.detail.lifecycle.reviewed") : t("formulas.detail.lifecycle.pending")
    case null:
      return f.isClosed
        ? t("status.closed")
        : f.closeable
          ? t("formulas.detail.lifecycle.ready")
          : t("formulas.detail.lifecycle.blockedCount", { count: 6 - doneCount })
    default:
      return ""
  }
}

/**
 * P1-1 Formula Lifecycle Guide. Recommended operating sequence on the Overview
 * tab. Each step navigates to its tab; the Close step opens the existing Close
 * dialog. Full status lifecycle (complete/revoke/re-complete) lives in Formula
 * Status controls — this strip is guidance only. Hidden when canceled.
 */
export function FormulaLifecycleGuide({
  formula,
  activeTab,
  onNavigate,
  onRequestClose,
}: {
  formula: Formula
  activeTab: string
  onNavigate: (tab: string) => void
  onRequestClose: () => void
}) {
  if (formula.canceledAt) return null
  const closed = formula.isClosed
  const doneCount = sixStatuses(formula).filter((s) => s.done).length

  function stepState(step: LifecycleStep): "done" | "current" | "pending" | "blocked" {
    if (closed) return "done"
    if (step.tab === null) {
      if (formula.isClosed) return "done"
      return formula.closeable ? "current" : "blocked"
    }
    if (lifecycleStepDone(formula, step)) return "done"
    if (step.tab === activeTab) return "current"
    return "pending"
  }

  const stateClass: Record<string, string> = {
    done: "border-success/30 bg-success-soft text-success",
    current: "border-accent bg-accent-soft text-accent",
    pending: "border-border bg-secondary/40 text-muted-foreground hover:border-accent/40",
    blocked: "border-warning/30 bg-warning-soft text-warning",
  }

  function handleClick(step: LifecycleStep) {
    if (closed) return
    if (step.tab === null) onRequestClose()
    else onNavigate(step.tab)
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("formulas.detail.lifecycle.title")}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {t("formulas.detail.lifecycle.description")}
      </p>

      {/* Desktop horizontal stepper */}
      <div className="mt-4 hidden items-stretch gap-1 sm:flex">
        {LIFECYCLE_STEPS.map((step, i) => {
          const state = stepState(step)
          const Icon = step.icon
          const Tag = closed ? "span" : "button"
          return (
            <div key={step.n} className="flex min-w-0 flex-1 items-center gap-1">
              <Tag
                type={closed ? undefined : "button"}
                onClick={() => handleClick(step)}
                className={cn(
                  "flex min-w-0 flex-1 flex-col gap-1 rounded-lg border px-2 py-2 text-left transition-colors",
                  stateClass[state],
                  closed && "cursor-default",
                )}
                title={step.tab === "overview" ? t("formulas.detail.lifecycle.statusTooltip") : undefined}
              >
                <span className="flex items-center gap-1.5">
                  {state === "done" ? <CheckCircle2 className="size-3.5 shrink-0" /> : <Icon className="size-3.5 shrink-0" />}
                  <span className="truncate text-xs font-medium">{t(step.labelKey)}</span>
                </span>
                <span className="truncate text-[10px] opacity-80">{lifecycleStepChip(formula, step)}</span>
              </Tag>
              {i < LIFECYCLE_STEPS.length - 1 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
            </div>
          )
        })}
      </div>

      {/* Mobile vertical list */}
      <div className="mt-4 flex flex-col gap-2 sm:hidden">
        {LIFECYCLE_STEPS.map((step) => {
          const state = stepState(step)
          const Icon = step.icon
          const Tag = closed ? "span" : "button"
          const chipLabel =
            state === "done"
              ? t("formulas.detail.lifecycle.done")
              : state === "current"
                ? t("formulas.detail.lifecycle.next")
                : state === "blocked"
                  ? t("formulas.detail.lifecycle.blocked")
                  : t("formulas.detail.lifecycle.pending")
          return (
            <Tag
              key={step.n}
              type={closed ? undefined : "button"}
              onClick={() => handleClick(step)}
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                stateClass[state],
                closed && "cursor-default",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                {state === "done" ? <CheckCircle2 className="size-4 shrink-0" /> : <Icon className="size-4 shrink-0" />}
                <span className="truncate text-sm font-medium">{t(step.labelKey)}</span>
              </span>
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide opacity-80">{chipLabel}</span>
            </Tag>
          )
        })}
      </div>

      {!closed && !formula.closeable && (
        <p className="mt-3 text-xs leading-relaxed text-warning">
          {t("formulas.detail.lifecycle.closeHint")}
        </p>
      )}
      {!closed && (
        <p className="sr-only">{t("formulas.detail.lifecycle.srProgress", { count: doneCount })}</p>
      )}
    </div>
  )
}

/* ---------------- Close Readiness Panel (P1-4) ---------------- */

/**
 * P1-03/P1-4 shared close-blocking lifecycle hints. Single source of truth for
 * both `CloseReadinessPanel` (Overview) and `CloseFormulaDialog` blocking list.
 */
export const CLOSE_LIFECYCLE_HINTS: Record<string, { notDoneKey: TranslationKey; tab: string }> = {
  trade: { notDoneKey: "formulas.detail.closeReadiness.tradeHint", tab: "overview" },
  cashIn: { notDoneKey: "formulas.detail.closeReadiness.cashInHint", tab: "overview" },
  cashOut: { notDoneKey: "formulas.detail.closeReadiness.cashOutHint", tab: "overview" },
  invoice: { notDoneKey: "formulas.detail.closeReadiness.invoiceHint", tab: "invoices" },
  logistics: { notDoneKey: "formulas.detail.closeReadiness.logisticsHint", tab: "logistics" },
  delivery: { notDoneKey: "formulas.detail.closeReadiness.deliveryHint", tab: "overview" },
}

/**
 * P1-03 shared blocking-status list. Rendered inside both `CloseReadinessPanel`
 * and `CloseFormulaDialog` so the G1–G4 guidance stays in sync. Read-only; each
 * row's Go button calls `onNavigate` with the target tab.
 */
export function CloseBlockingList({
  formula,
  onNavigate,
}: {
  formula: Formula
  onNavigate: (tab: string) => void
}) {
  const blocking = sixStatuses(formula).filter((s) => !s.done)
  return (
    <>
      <ul className="space-y-2">
        {blocking.map((s) => {
          const hint = CLOSE_LIFECYCLE_HINTS[s.key]
          return (
            <li
              key={s.key}
              className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {sixStatusLabel(s.key)}{" "}
                  <span className="font-normal text-muted-foreground">· {sixStatusValue(formula, s.key, s.value)}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{hint ? t(hint.notDoneKey) : null}</p>
              </div>
              {hint && (
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1 text-xs"
                  onClick={() => onNavigate(hint.tab)}
                >
                  {hint.tab === "overview"
              ? t("formulas.detail.closeReadiness.fixOverview")
              : t("formulas.detail.closeReadiness.openTab", {
                  tab: t(`formulas.detail.header.${hint.tab}` as TranslationKey),
                })}
                </Button>
              )}
            </li>
          )
        })}
      </ul>

      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {t("formulas.detail.closeReadiness.reviewOnly")}
      </p>
    </>
  )
}

/**
 * P1-4 Close Readiness. Explains why a Formula cannot close, which statuses
 * block it, and the lifecycle action for each. Uses `sixStatuses()` only — no
 * new close rules. Visible to all roles (read-only); Close stays admin-only.
 */
export function CloseReadinessPanel({
  formula,
  onNavigate,
}: {
  formula: Formula
  onNavigate: (tab: string) => void
}) {
  if (formula.isClosed) {
    return (
      <div className="rounded-lg border border-success/30 bg-success-soft p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          {t("formulas.detail.closeReadiness.closedTitle")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {formula.closedAt
            ? `${t("formulas.detail.closeReadiness.closedAt", { date: formatDate(formula.closedAt) })} `
            : ""}
          {t("formulas.detail.closeReadiness.closedDescription")}
        </p>
      </div>
    )
  }

  if (formula.canceledAt) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger-soft/40 p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-danger">
          <Ban className="size-4 shrink-0" />
          {t("formulas.detail.closeReadiness.canceledTitle")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t("formulas.detail.closeReadiness.canceledDescription")}
        </p>
      </div>
    )
  }

  if (formula.closeable) {
    return (
      <div className="rounded-lg border border-success/30 bg-success-soft p-4">
        <p className="flex items-center gap-2 text-sm font-medium text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          {t("formulas.detail.closeReadiness.readyTitle")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {t("formulas.detail.closeReadiness.readyDescription")}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-warning/30 bg-warning-soft p-4">
      <p className="text-sm font-semibold text-foreground">{t("formulas.detail.closeReadiness.blockedTitle")}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {t("formulas.detail.closeReadiness.blockedDescription")}
      </p>

      <div className="mt-3">
        <CloseBlockingList formula={formula} onNavigate={onNavigate} />
      </div>
    </div>
  )
}

/* ---------------- Participants ---------------- */
const roleLabels: Record<string, TranslationKey> = {
  buyer: "formulas.detail.participants.buyer",
  seller: "formulas.detail.participants.seller",
  agent: "formulas.detail.participants.agent",
  logistics: "formulas.detail.participants.logistics",
  financier: "formulas.detail.participants.financier",
}

function participantMargin(p: Formula["participants"][number]): number | null {
  const buy = p.buyUnitPrice ?? p.buyPrice
  const sell = p.sellUnitPrice ?? p.sellPrice
  // Endpoints (origin buy = 0, final sell = 0) carry no spread, so no margin.
  if (buy == null || sell == null || buy === 0 || sell === 0) return null
  return (sell - buy) * (p.quantity ?? 1)
}

/**
 * Primary chain-understanding screen (P1-2). Surfaces per-hop economics
 * (quantity, buy/sell unit price, margin) that used to live only in Overview,
 * ordered by the single canonical `sequenceOrder` concept (P1-3).
 */
export function ParticipantsPanel({ formula }: { formula: Formula }) {
  const chain = [...formula.participants].sort((a, b) => chainOrderOf(a) - chainOrderOf(b))
  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        The full participant chain in sequence. Operational roles belong to Formula Participants (not the Company
        Master); the same company may appear more than once with different roles. Prices and margins are illustrative
        previews — authoritative figures come from backend services after integration.
      </p>

      {/* Card view (mobile) */}
      <div className="grid gap-3 sm:hidden">
        {chain.map((p) => {
          const buy = p.buyUnitPrice ?? p.buyPrice
          const sell = p.sellUnitPrice ?? p.sellPrice
          const margin = participantMargin(p)
          return (
            <div key={p.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-semibold text-accent">
                  {chainOrderOf(p) + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{p.company}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.natureGroup ? capitalize(p.natureGroup) : p.nature ?? "—"}
                    {p.paymentGroup ? ` · ${capitalize(p.paymentGroup)}` : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge tone="outline">{roleGroupLabel(p.roleGroup) ?? (roleLabels[p.role] ? t(roleLabels[p.role]) : capitalize(p.role))}</StatusBadge>
                  {(p.isStart || p.isEnd) && (
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {p.isStart ? t("formulas.detail.participants.start") : t("formulas.detail.participants.end")}
                    </span>
                  )}
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <ParticipantStat label={t("formulas.detail.participants.quantity")} value={p.quantity != null ? formatNumber(p.quantity) : "—"} />
                <ParticipantStat label={t("formulas.detail.participants.margin")} value={margin != null ? formatCurrency(margin) : "—"} tone={margin != null && margin > 0 ? "pos" : undefined} />
                <ParticipantStat label={t("formulas.detail.participants.buyUnitPrice")} value={buy ? formatCurrency(buy) : "—"} />
                <ParticipantStat label={t("formulas.detail.participants.sellUnitPrice")} value={sell ? formatCurrency(sell) : "—"} />
              </dl>
            </div>
          )
        })}
      </div>

      {/* Table view (sm+) */}
      <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
        <table className="w-full min-w-[820px] text-sm">
          <caption className="sr-only">Participant chain with roles and per-hop economics</caption>
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2.5 font-medium">Seq</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Company</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Role Group</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Nature Group</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Payment Group</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Quantity</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Buy Unit Price</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Sell Unit Price</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Margin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {chain.map((p) => {
              const buy = p.buyUnitPrice ?? p.buyPrice
              const sell = p.sellUnitPrice ?? p.sellPrice
              const margin = participantMargin(p)
              return (
                <tr key={p.id} className="bg-card">
                  <td className="px-3 py-3">
                    <span className="inline-flex size-6 items-center justify-center rounded-md bg-secondary font-mono text-xs font-semibold text-muted-foreground">
                      {chainOrderOf(p) + 1}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-medium text-foreground">{p.company}</span>
                    {(p.isStart || p.isEnd) && (
                      <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {p.isStart ? t("formulas.detail.participants.start") : t("formulas.detail.participants.end")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge tone="outline">{roleGroupLabel(p.roleGroup) ?? (roleLabels[p.role] ? t(roleLabels[p.role]) : capitalize(p.role))}</StatusBadge>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {p.natureGroup ? capitalize(p.natureGroup) : p.nature ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {p.paymentGroup ? capitalize(p.paymentGroup) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-foreground">
                    {p.quantity != null ? formatNumber(p.quantity) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-foreground">
                    {buy ? formatCurrency(buy) : "—"}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-foreground">
                    {sell ? formatCurrency(sell) : "—"}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-3 text-right font-mono tabular-nums",
                      margin != null && margin > 0 ? "text-success" : "text-muted-foreground",
                    )}
                  >
                    {margin != null ? formatCurrency(margin) : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ParticipantStat({ label, value, tone }: { label: string; value: string; tone?: "pos" }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 font-mono tabular-nums", tone === "pos" ? "text-success" : "text-foreground")}>
        {value}
      </dd>
    </div>
  )
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function roleGroupLabel(rg?: string) {
  if (!rg) return undefined
  const map: Record<string, TranslationKey> = {
    supplier: "formulas.detail.participants.supplier",
    buyer: "formulas.detail.participants.buyer",
    carrier: "formulas.detail.participants.carrier",
    financial: "formulas.detail.participants.financial",
    other: "formulas.detail.participants.other",
  }
  return map[rg] ? t(map[rg]) : capitalize(rg)
}

/* ---------------- Participant Confirmed KPI (P1 Feature 1) ---------------- */

const kpiRoleLabels: Record<string, TranslationKey> = {
  supplier: "formulas.detail.participants.supplier",
  buyer: "formulas.detail.participants.buyer",
  carrier: "formulas.detail.participants.carrier",
  financial: "formulas.detail.participants.financial",
  other: "formulas.detail.participants.other",
  seller: "formulas.detail.participants.seller",
  agent: "formulas.detail.participants.agent",
  logistics: "formulas.detail.participants.logistics",
  financier: "formulas.detail.participants.financier",
}

/** P1-2 column definitions for the KPI explainer + header tooltips. */
const KPI_COLUMN_HELP: Record<string, TranslationKey> = {
  confirmedIn: "formulas.detail.participants.confirmedInHelp",
  confirmedOut: "formulas.detail.participants.confirmedOutHelp",
  scheduledIn: "formulas.detail.participants.scheduledInHelp",
  scheduledOut: "formulas.detail.participants.scheduledOutHelp",
  receivable: "formulas.detail.participants.receivableHelp",
  payable: "formulas.detail.participants.payableHelp",
  confirmedNet: "formulas.detail.participants.confirmedNetHelp",
}

/**
 * P1-01 Participant KPI Explainer (UX spec P1-2). Collapsible narrative that
 * explains Confirmed / Scheduled / Receivable / Payable and the relationship to
 * Settlement. Read-only; default collapsed; no KPI math changes. Block 5 links to
 * the Settlement tab via `onNavigate`.
 */
function ParticipantKpiExplainer({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-3 rounded-lg border border-border bg-secondary/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-xs font-medium text-foreground">
          <Info className="size-3.5 text-muted-foreground" />
          What do these numbers mean?
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-3 border-t border-border px-3 py-3 text-xs leading-relaxed text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Confirmed In / Out</span> — Sum of{" "}
            <span className="font-medium text-foreground">actual payment records</span> (bank movements) for this
            participant&apos;s company. Canceled records are excluded. This is cash-based, not planned.
          </p>
          <p>
            <span className="font-medium text-foreground">Scheduled In / Out</span> — Sum of{" "}
            <span className="font-medium text-foreground">payment schedules</span> (planned amounts) for this
            counterparty. Schedules are not confirmed money.
          </p>
          <p>
            <span className="font-medium text-foreground">Receivable</span> — Money still expected in
            (scheduled/receipts minus confirmed receipts). <span className="font-medium text-foreground">Payable</span>{" "}
            — Money still owed out. These are outstanding balances, not profit.
          </p>
          <p>
            <span className="font-medium text-foreground">Confirmed Net</span> — Confirmed In minus Confirmed Out for
            this participant hop. Illustrative per-participant cash result.
          </p>
          <div className="rounded-lg border border-border bg-secondary/30 p-3">
            <p>
              Formula-level <span className="font-medium text-foreground">Settlement</span> tab rolls up the same cash
              tiers for the whole Formula (scheduled vs actual, receivable, payable, close readiness). Participant KPI is{" "}
              <span className="font-medium text-foreground">per-hop detail</span>; Settlement is{" "}
              <span className="font-medium text-foreground">Formula-level totals and close gate</span>.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-1 text-xs"
              onClick={() => onNavigate?.("settlement")}
            >
              <Scale className="size-3.5" />
              View Formula Settlement
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Per-participant confirmed cash KPI (P1 Feature 1). Read-only mirror of
 * `v_participant_confirmed_kpi`. Confirmed figures derive from actual payment
 * records (cash), never schedules — computed locally as a preview.
 */
export function ParticipantConfirmedKpiPanel({
  formula,
  onNavigate,
}: {
  formula: Formula
  onNavigate?: (tab: string) => void
}) {
  const rows = deriveParticipantConfirmedKpi(formula)
  const canceled = isFormulaCanceled(formula)

  return (
    <div className="space-y-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Confirmed KPI by Participant
        </p>
        <div className="flex items-center gap-2">
          {canceled && <StatusBadge tone="outline">Canceled formula</StatusBadge>}
          <StatusBadge tone="info">Cash-based · Preview</StatusBadge>
        </div>
      </div>

      {rows.length > 0 && <ParticipantKpiExplainer onNavigate={onNavigate} />}

      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        Confirmed figures derive from actual payment records (cash movements), not schedules. Mirrors{" "}
        <code className="text-[10px]">v_participant_confirmed_kpi</code> — preview computed locally.
      </p>

      {rows.length === 0 ? (
        <SectionEmpty label="No participants — confirmed KPI unavailable." />
      ) : (
        <>
          {/* Card view (mobile) */}
          <div className="grid gap-3 sm:hidden">
            {rows.map((r) => (
              <div key={r.participantId} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-xs font-semibold text-muted-foreground">
                    {r.sequenceOrder + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{r.companyName}</p>
                  </div>
                  <StatusBadge tone="outline">{kpiRoleLabels[r.roleGroup] ? t(kpiRoleLabels[r.roleGroup]) : capitalize(r.roleGroup)}</StatusBadge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <KpiStat label="Confirmed In" value={formatCurrency(r.confirmedIn)} />
                  <KpiStat label="Confirmed Out" value={formatCurrency(r.confirmedOut)} />
                  <KpiStat label="Scheduled In" value={formatCurrency(r.scheduledIn)} />
                  <KpiStat label="Scheduled Out" value={formatCurrency(r.scheduledOut)} />
                  <KpiStat label="Receivable" value={formatCurrency(r.receivable)} />
                  <KpiStat label="Payable" value={formatCurrency(r.payable)} />
                  <KpiStat
                    label="Confirmed Net"
                    value={formatCurrency(r.confirmedNetProfit)}
                    tone={r.confirmedNetProfit >= 0 ? "pos" : "neg"}
                    strong
                  />
                </dl>
              </div>
            ))}
          </div>

          {/* Table view (sm+) */}
          <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
            <table className="w-full min-w-[1100px] text-sm">
              <caption className="sr-only">Per-participant confirmed cash KPI</caption>
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2.5 text-center font-medium">Seq</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Company</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Role</th>
                  <KpiHeaderCell label={t("formulas.detail.participants.confirmedIn")} help={t(KPI_COLUMN_HELP.confirmedIn)} />
                  <KpiHeaderCell label={t("formulas.detail.participants.confirmedOut")} help={t(KPI_COLUMN_HELP.confirmedOut)} />
                  <KpiHeaderCell label={t("formulas.detail.participants.scheduledIn")} help={t(KPI_COLUMN_HELP.scheduledIn)} muted />
                  <KpiHeaderCell label={t("formulas.detail.participants.scheduledOut")} help={t(KPI_COLUMN_HELP.scheduledOut)} muted />
                  <KpiHeaderCell label={t("formulas.detail.participants.receivable")} help={t(KPI_COLUMN_HELP.receivable)} />
                  <KpiHeaderCell label={t("formulas.detail.participants.payable")} help={t(KPI_COLUMN_HELP.payable)} />
                  <KpiHeaderCell label={t("formulas.detail.participants.confirmedNet")} help={t(KPI_COLUMN_HELP.confirmedNet)} />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.participantId} className="bg-card">
                    <td className="px-3 py-3 text-center">
                      <span className="inline-flex size-6 items-center justify-center rounded-md bg-secondary font-mono text-xs font-semibold text-muted-foreground">
                        {r.sequenceOrder + 1}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-medium text-foreground">{r.companyName}</td>
                    <td className="px-3 py-3">
                      <StatusBadge tone="outline">{kpiRoleLabels[r.roleGroup] ? t(kpiRoleLabels[r.roleGroup]) : capitalize(r.roleGroup)}</StatusBadge>
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-foreground">{formatCurrency(r.confirmedIn)}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-foreground">{formatCurrency(r.confirmedOut)}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-muted-foreground">{formatCurrency(r.scheduledIn)}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-muted-foreground">{formatCurrency(r.scheduledOut)}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-foreground">{formatCurrency(r.receivable)}</td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-foreground">{formatCurrency(r.payable)}</td>
                    <td
                      className={cn(
                        "px-3 py-3 text-right font-mono tabular-nums font-semibold",
                        r.confirmedNetProfit >= 0 ? "text-success" : "text-danger",
                      )}
                    >
                      {formatCurrency(r.confirmedNetProfit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function KpiHeaderCell({ label, help, muted }: { label: string; help: string; muted?: boolean }) {
  return (
    <th scope="col" className={cn("px-3 py-2.5 text-right font-medium", muted && "text-muted-foreground/70")}>
      <Tooltip content={help}>
        <span className="inline-flex cursor-help items-center gap-1 border-b border-dotted border-muted-foreground/40">
          {label}
          <Info className="size-3 text-muted-foreground/60" />
        </span>
      </Tooltip>
    </th>
  )
}

function KpiStat({
  label,
  value,
  tone,
  strong,
}: {
  label: string
  value: string
  tone?: "pos" | "neg"
  strong?: boolean
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 font-mono tabular-nums",
          strong && "font-semibold",
          tone === "pos" ? "text-success" : tone === "neg" ? "text-danger" : "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  )
}

/* ---------------- Payment Schedules (Tier 1 / planned) ---------------- */
export function SchedulePanel({ formula }: { formula: Formula }) {
  if (formula.schedule.length === 0) return <SectionEmpty label={t("formulas.detail.payments.scheduleEmpty")} />
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">{t("formulas.detail.payments.type")}</th>
            <th className="px-4 py-2.5 font-medium">{t("formulas.detail.payments.company")}</th>
            <th className="px-4 py-2.5 font-medium">{t("formulas.detail.payments.scheduledDate")}</th>
            <th className="px-4 py-2.5 text-right font-medium">{t("formulas.detail.payments.planned")}</th>
            <th className="px-4 py-2.5 text-right font-medium">{t("formulas.detail.payments.linkedActual")}</th>
            <th className="px-4 py-2.5 text-right font-medium">{t("formulas.detail.payments.remaining")}</th>
            <th className="px-4 py-2.5 font-medium">{t("formulas.detail.payments.status")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {formula.schedule.map((s) => {
            const cfg = scheduleStatusConfig[s.status]
            const fulfil = scheduleFulfillment(formula, s.id, s.amount)
            return (
              <tr key={s.id} className="bg-card">
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 font-medium",
                      s.type === "receipt" ? "text-success" : "text-warning",
                    )}
                  >
                    {s.type === "receipt" ? (
                      <ArrowDownLeft className="size-4" />
                    ) : (
                      <ArrowUpRight className="size-4" />
                    )}
                    {s.type === "receipt" ? t("formulas.detail.payments.receipt") : t("formulas.detail.payments.payment")}
                  </span>
                </td>
                <td className="px-4 py-3 text-foreground">{s.counterparty}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(s.scheduledDate)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">
                  {formatCurrency(s.amount)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-info">
                  {formatCurrency(fulfil.matchedTotal)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-warning">
                  {formatCurrency(fulfil.remaining)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge tone={cfg.tone}>{cfg.label}</StatusBadge>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/* ---------------- Payment Records (Tier 2 / actual) ---------------- */
export function PaymentRecordsPanel({
  formula,
  canWrite,
  onCancelRecord,
}: {
  formula: Formula
  canWrite?: boolean
  onCancelRecord?: (recordId: string) => void
}) {
  const records = formula.records ?? []
  if (records.length === 0) return <SectionEmpty label={t("formulas.detail.payments.recordsEmpty")} />
  const active = records.filter((r) => !r.canceled)
  const canceled = records.filter((r) => r.canceled)
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">{t("formulas.detail.payments.type")}</th>
            <th className="px-4 py-2.5 font-medium">{t("formulas.detail.payments.company")}</th>
            <th className="px-4 py-2.5 font-medium">{t("formulas.detail.payments.actualDate")}</th>
            <th className="px-4 py-2.5 font-medium">{t("formulas.detail.payments.linkedSchedule")}</th>
            <th className="px-4 py-2.5 text-right font-medium">{t("formulas.detail.payments.actualAmount")}</th>
            <th className="px-4 py-2.5 font-medium">{t("formulas.detail.payments.state")}</th>
            {onCancelRecord && <th className="px-4 py-2.5 font-medium">{t("formulas.detail.payments.actions")}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {[...active, ...canceled].map((r) => (
            <tr key={r.id} className={cn("bg-card", r.canceled && "opacity-60")}>
              <td className="px-4 py-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 font-medium",
                    r.type === "receipt" ? "text-success" : "text-warning",
                  )}
                >
                  {r.type === "receipt" ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                  {r.type === "receipt" ? t("formulas.detail.payments.receipt") : t("formulas.detail.payments.payment")}
                </span>
              </td>
              <td className="px-4 py-3 text-foreground">{r.counterparty}</td>
              <td className="px-4 py-3 text-muted-foreground">{formatDate(r.paidDate)}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {r.scheduleId ? (
                  <span className="inline-flex items-center gap-1 font-mono text-xs">
                    <Link2 className="size-3.5" />
                    {r.scheduleId}
                  </span>
                ) : (
                  <span className="text-xs text-warning">{t("formulas.detail.payments.unmatched")}</span>
                )}
              </td>
              <td
                className={cn(
                  "px-4 py-3 text-right font-mono tabular-nums",
                  r.canceled ? "text-muted-foreground line-through" : "text-foreground",
                )}
              >
                {formatCurrency(r.amount)}
              </td>
              <td className="px-4 py-3">
                {r.canceled ? (
                  <div className="flex flex-col gap-0.5">
                    <StatusBadge tone="danger">{t("formulas.detail.payments.canceled")}</StatusBadge>
                    {r.cancelReason && <span className="text-[11px] text-muted-foreground">{r.cancelReason}</span>}
                  </div>
                ) : (
                  <StatusBadge tone="success">{t("formulas.detail.payments.confirmed")}</StatusBadge>
                )}
              </td>
              {onCancelRecord && (
                <td className="px-4 py-3">
                  {!r.canceled && canWrite && (
                    <button
                      type="button"
                      onClick={() => onCancelRecord(r.id)}
                      className="inline-flex items-center gap-1 text-xs text-danger hover:underline"
                    >
                      <Ban className="size-3.5" />
                      {t("formulas.detail.payments.cancel")}
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ---------------- Payments Tab (P2) ---------------- */
export function PaymentsPanel({
  formula,
  canWrite,
  onCancelRecord,
}: {
  formula: Formula
  canWrite?: boolean
  onCancelRecord?: (recordId: string) => void
}) {
  return (
    <div className="space-y-5">
      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("formulas.detail.overview.paymentSummary")}
        </p>
        <PaymentSummary formula={formula} showRates />
      </section>

      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("formulas.detail.payments.schedulesPlanned")}
        </p>
        <SchedulePanel formula={formula} />
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("formulas.detail.payments.recordsActual")}
          </p>
          <span className="text-[11px] text-muted-foreground">{t("formulas.detail.payments.canceledExcluded")}</span>
        </div>
        <PaymentRecordsPanel formula={formula} canWrite={canWrite} onCancelRecord={onCancelRecord} />
      </section>
    </div>
  )
}

/* ---------------- Invoices ---------------- */
/** Per-invoice close impact copy driven by canonical status. */
function invoiceCloseImpact(status: ReturnType<typeof deriveInvoiceVerification>["status"]): {
  label: string
  tone: "success" | "warning" | "danger" | "outline"
} {
  switch (status) {
    case "amount_matched":
      return { label: "Allows close", tone: "success" }
    case "amount_mismatched":
      return { label: "Blocks close", tone: "danger" }
    case "pending":
      return { label: "Pending — blocks close", tone: "warning" }
    case "canceled":
      return { label: "Canceled — excluded", tone: "outline" }
    default:
      return { label: "Missing — blocks close", tone: "warning" }
  }
}

export function InvoicesPanel({
  formula,
  renderInvoiceActions,
}: {
  formula: Formula
  renderInvoiceActions?: (inv: Formula["invoices"][number]) => React.ReactNode
}) {
  if (formula.invoices.length === 0)
    return (
      <div className="space-y-3">
        <InvoiceCloseRuleNote />
        <SectionEmpty label="No invoices recorded — invoice is a close condition, so this Formula cannot close yet." />
      </div>
    )
  return (
    <div className="space-y-3">
      <InvoiceCloseRuleNote />
      <div className="grid gap-3 sm:grid-cols-2">
        {formula.invoices.map((inv) => {
          const v = deriveInvoiceVerification(inv)
          const cfg = invoiceStatusConfig[v.status]
          const impact = invoiceCloseImpact(v.status)
          return (
            <div key={inv.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                    <FileText className="size-4" />
                  </div>
                  <div>
                    <p className="font-mono text-sm font-semibold text-foreground">{inv.number}</p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {inv.direction} · {inv.counterparty}
                    </p>
                  </div>
                </div>
                <StatusBadge tone={cfg.tone}>{cfg.label}</StatusBadge>
              </div>

              {/* Amount verification: system-derived expected vs external (P0-1) */}
              <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Expected Amount</span>
                  <span className="font-mono tabular-nums text-foreground">{formatCurrency(v.expectedAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">External Invoice Amount</span>
                  <span className="font-mono tabular-nums text-foreground">
                    {v.externalAmount == null ? "—" : formatCurrency(v.externalAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Difference</span>
                  <span
                    className={cn(
                      "font-mono tabular-nums",
                      v.delta == null || v.delta === 0 ? "text-muted-foreground" : "text-danger",
                    )}
                  >
                    {v.delta == null ? "—" : `${v.delta > 0 ? "+" : ""}${formatCurrency(v.delta)}`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Amount Verified</span>
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      v.matched ? "text-success" : v.status === "canceled" ? "text-muted-foreground" : "text-danger",
                    )}
                  >
                    {v.status === "canceled" ? "N/A" : v.matched ? "Matched" : "Mismatched"}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs text-muted-foreground">Due {formatDate(inv.dueDate)}</span>
                <StatusBadge tone={impact.tone}>{impact.label}</StatusBadge>
              </div>
              {renderInvoiceActions?.(inv)}
            </div>
          )
        })}
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Amount verification is system-derived by comparing the external invoice amount with the expected amount.
        Authoritative verification runs in backend services after integration.
      </p>
    </div>
  )
}

function InvoiceCloseRuleNote() {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-accent" />
      <span>
        <span className="font-medium text-foreground">Invoice is a Formula close condition, not a transaction blocker.</span>{" "}
        A Formula can continue without invoice completion, but cannot close until the invoice amount is matched.
      </span>
    </div>
  )
}

/* ---------------- Logistics ---------------- */
const modeIcons = { sea: Ship, air: Plane, land: Truck }

export function LogisticsPanel({ formula }: { formula: Formula }) {
  const logisticsCfg = formulaLogisticsStatusConfig[formula.logisticsStatus]
  const deliveryCfg = deliveryStatusConfig[formula.deliveryStatus]
  return (
    <div className="space-y-4">
      {/* Formula-level statuses — Logistics (transport) vs Delivery (hand-off) (P0-1/P0-2) */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Truck className="size-4" />
            <p className="text-xs font-semibold uppercase tracking-wide">Logistics Status</p>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <StatusBadge tone={logisticsCfg.tone}>{logisticsCfg.label}</StatusBadge>
            <span className="text-xs text-muted-foreground">Transport / carrier movement</span>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <PackageCheck className="size-4" />
            <p className="text-xs font-semibold uppercase tracking-wide">Delivery Status</p>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <StatusBadge tone={deliveryCfg.tone}>{deliveryCfg.label}</StatusBadge>
            <span className="text-xs text-muted-foreground">Final delivery / hand-off</span>
          </div>
        </div>
      </div>

      {formula.logistics.length === 0 ? (
        <SectionEmpty label="No logistics legs planned." />
      ) : (
        <div className="space-y-3">
          {formula.logistics.map((leg) => {
            const Icon = modeIcons[leg.mode]
            const cfg = logisticsStatusConfig[leg.status]
            const vehicles = (formula.vehicles ?? []).filter((v) => v.logisticsId === leg.id)
            return (
              <div key={leg.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-info-soft text-info">
                    <Icon className="size-5" />
                  </div>
                  <div className="flex flex-1 items-center gap-2 text-sm">
                    <span className="font-medium text-foreground">{leg.origin}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium text-foreground">{leg.destination}</span>
                  </div>
                  <StatusBadge tone={cfg.tone}>{cfg.label}</StatusBadge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3 text-sm sm:grid-cols-3">
                  <LegField label="Carrier" value={leg.carrier} />
                  <LegField label="Mode" value={leg.mode} capitalize />
                  <LegField label="Cost Bearer" value={leg.costBearer} />
                  <LegField label="ETA" value={formatDate(leg.eta)} />
                  <LegField label="Actual Arrival" value={leg.actualArrival ? formatDate(leg.actualArrival) : "—"} />
                  <LegField
                    label="Actual Delivery"
                    value={leg.actualDelivery ? formatDate(leg.actualDelivery) : "—"}
                  />
                  <LegField label="Logistics Cost" value={formatCurrency(leg.cost)} mono />
                </dl>

                {/* Linked Logistics Vehicles (canonical formula_logistics_vehicles) */}
                <div className="mt-3 border-t border-border pt-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Container className="size-3.5" />
                    Vehicles
                    <span className="font-normal normal-case text-muted-foreground">({vehicles.length})</span>
                  </p>
                  {vehicles.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No vehicles assigned to this leg.</p>
                  ) : (
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {vehicles.map((v) => (
                        <li
                          key={v.id}
                          className="flex items-start justify-between gap-3 rounded-lg border border-border bg-secondary/40 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-mono text-xs font-medium text-foreground">{v.vehicleNo}</p>
                            {v.driverName && (
                              <p className="truncate text-[11px] text-muted-foreground">{v.driverName}</p>
                            )}
                            {v.memo && <p className="truncate text-[11px] text-muted-foreground">{v.memo}</p>}
                          </div>
                          {v.transportStatus && (
                            <StatusBadge tone="outline">{v.transportStatus.replace("_", " ")}</StatusBadge>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LegField({
  label,
  value,
  mono,
  capitalize,
}: {
  label: string
  value: string
  mono?: boolean
  capitalize?: boolean
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-sm text-foreground",
          mono && "font-mono tabular-nums",
          capitalize && "capitalize",
        )}
      >
        {value}
      </dd>
    </div>
  )
}

/* ---------------- Timeline (P1-1 / P1-4) ---------------- */
const timelineIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  created: Plus,
  contract: FileText,
  trade: Repeat,
  status: Activity,
  schedule: CalendarClock,
  receipt: ArrowDownLeft,
  payment: ArrowUpRight,
  invoice: FileText,
  invoice_matched: CheckCircle2,
  logistics: Ship,
  delivery: PackageCheck,
  version: GitCommitVertical,
  settlement: Scale,
  closed: Lock,
  note: StickyNote,
  share: Handshake,
}

const tabLabels: Record<string, string> = {
  overview: "Overview",
  payments: "Payments",
  invoices: "Invoices",
  logistics: "Logistics",
  versions: "Versions",
  settlement: "Settlement",
}

export function TimelinePanel({
  formula,
  onNavigate,
  versionHistory,
  eventFilter = "all",
}: {
  formula: Formula
  onNavigate?: (tab: string) => void
  versionHistory?: VersionEntry[]
  eventFilter?: string
}) {
  const events = buildTimeline(formula, versionHistory ?? getVersionHistory(formula))
  const filtered = eventFilter === "all" ? events : events.filter((e) => e.type === eventFilter)
  if (filtered.length === 0)
    return <SectionEmpty label={eventFilter === "all" ? "No activity yet." : `No ${eventFilter} events.`} />
  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Status changes are projected from this Formula&apos;s canonical Status Logs; other entries trace to their own
        records (payments, invoices, logistics, versions). Nothing is fabricated — the authoritative activity log is
        produced by backend services after integration.
      </p>
      <ol className="relative space-y-5 pl-8">
        <span className="absolute left-[15px] top-1 bottom-1 w-px bg-border" aria-hidden />
        {filtered.map((ev) => {
          const Icon = timelineIcons[ev.type] ?? Clock
          const linkLabel = ev.linkTab ? tabLabels[ev.linkTab] : undefined
          return (
            <li key={ev.id} className="relative">
              <span className="absolute -left-8 flex size-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
                <Icon className="size-4" />
              </span>
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{ev.title}</p>
                  <time className="shrink-0 text-xs text-muted-foreground">{formatDate(ev.date)}</time>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{ev.description}</p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">by {ev.actor}</p>
                  {ev.linkTab && linkLabel && onNavigate && (
                    <button
                      type="button"
                      onClick={() => onNavigate(ev.linkTab!)}
                      className="inline-flex items-center gap-0.5 rounded-md text-xs font-medium text-accent transition-colors hover:text-accent/80"
                    >
                      View in {linkLabel}
                      <ChevronRight className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* ---------------- Status Log Viewer (P1 Feature 2) ---------------- */

const statusLogTypeLabels: Record<StatusLogType, string> = {
  trade: "Trade",
  cashIn: "Cash In",
  cashOut: "Cash Out",
  invoice: "Invoice",
  logistics: "Logistics",
  delivery: "Delivery",
}

const statusLogValueLabels: Record<string, Record<string, string>> = {
  trade: { draft: "Draft", confirmed: "Confirmed", completed: "Completed", closed: "Closed", canceled: "Canceled" },
  cashIn: { pending: "Pending", partial: "Partial", completed: "Completed", canceled: "Canceled" },
  cashOut: { pending: "Pending", partial: "Partial", completed: "Completed", canceled: "Canceled" },
  invoice: { unmatched: "Unmatched", partial: "Partial", complete: "Complete", canceled: "Canceled" },
  logistics: { not_started: "Not Started", in_transit: "In Transit", delivered: "Delivered", canceled: "Canceled" },
  delivery: { pending: "Pending", in_transit: "In Transit", delivered: "Delivered", canceled: "Canceled" },
}

function statusLogValueLabel(type: StatusLogType, value: string | null): string {
  if (value == null) return "—"
  return statusLogValueLabels[type]?.[value] ?? value
}

function statusLogTone(value: string): BadgeTone {
  switch (value) {
    case "canceled":
      return "danger"
    case "completed":
    case "delivered":
    case "complete":
    case "confirmed":
    case "closed":
      return "success"
    case "partial":
    case "in_transit":
      return "warning"
    default:
      return "outline"
  }
}

/**
 * Canonical status-log table (P1 Feature 2). Reads `formula.statusLogs` only —
 * never synthesizes logs from timeline events. Sorted newest-first, filtered by
 * status domain. Read-only.
 */
export function StatusLogTable({
  formula,
  statusTypeFilter,
}: {
  formula: Formula
  statusTypeFilter: StatusLogType | "all"
}) {
  const logs = [...(formula.statusLogs ?? [])]
    .filter((l) => statusTypeFilter === "all" || l.statusType === statusTypeFilter)
    .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())

  if (logs.length === 0) return <SectionEmpty label="No status log entries for this filter." />

  const canceled = isFormulaCanceled(formula)

  return (
    <>
      {/* Card view (mobile) */}
      <div className="grid gap-3 sm:hidden">
        {logs.map((log) => (
          <div key={log.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">{statusLogTypeLabels[log.statusType]}</span>
              <time className="text-xs text-muted-foreground">{formatDate(log.changedAt)}</time>
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{statusLogValueLabel(log.statusType, log.previousStatus)}</span>
              <ChevronRight className="size-3.5 text-muted-foreground" />
              <StatusBadge tone={canceled ? "outline" : statusLogTone(log.newStatus)}>
                {statusLogValueLabel(log.statusType, log.newStatus)}
              </StatusBadge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">by {log.changedBy}</p>
            {log.reason && (
              <p className="mt-1 text-xs text-foreground">
                <span className="text-muted-foreground">Reason:</span> {log.reason}
              </p>
            )}
            {log.memo && <p className="mt-1 text-xs text-muted-foreground">{log.memo}</p>}
          </div>
        ))}
      </div>

      {/* Table view (sm+) */}
      <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
        <table className="w-full min-w-[900px] text-sm">
          <caption className="sr-only">Canonical status change log</caption>
          <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2.5 font-medium">Domain</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Previous</th>
              <th scope="col" className="px-3 py-2.5 font-medium">New</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Changed</th>
              <th scope="col" className="px-3 py-2.5 font-medium">By</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Reason</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Memo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {logs.map((log) => (
              <tr key={log.id} className="bg-card align-top">
                <td className="px-3 py-3 font-medium text-foreground">{statusLogTypeLabels[log.statusType]}</td>
                <td className="px-3 py-3 text-muted-foreground">
                  {statusLogValueLabel(log.statusType, log.previousStatus)}
                </td>
                <td className="px-3 py-3">
                  <StatusBadge tone={canceled ? "outline" : statusLogTone(log.newStatus)}>
                    {statusLogValueLabel(log.statusType, log.newStatus)}
                  </StatusBadge>
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  <span className="block text-foreground">{formatDate(log.changedAt)}</span>
                  <span className="text-xs">{new Date(log.changedAt).toLocaleTimeString()}</span>
                </td>
                <td className="px-3 py-3 text-muted-foreground">{log.changedBy}</td>
                <td className="max-w-[240px] truncate px-3 py-3 text-foreground" title={log.reason || undefined}>
                  {log.reason || "—"}
                </td>
                <td className="max-w-[240px] truncate px-3 py-3 text-muted-foreground" title={log.memo || undefined}>
                  {log.memo || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* ---------------- Overview ---------------- */
function OverviewStat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 font-mono text-sm font-semibold tabular-nums",
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

/* ---------------- Payment Summary (P1 / P2) ---------------- */
function FlowRow({
  tag,
  label,
  value,
  tone,
}: {
  tag: "Planned" | "Actual" | "Remaining"
  label: string
  value: number
  tone?: "pos" | "neg" | "muted"
}) {
  const tagClass =
    tag === "Planned"
      ? "bg-secondary text-muted-foreground"
      : tag === "Actual"
        ? "bg-info-soft text-info"
        : "bg-warning-soft text-warning"
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-2">
        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", tagClass)}>
          {tag === "Planned"
            ? t("formulas.detail.overview.planned")
            : tag === "Actual"
              ? t("formulas.detail.overview.actual")
              : t("formulas.detail.overview.remaining")}
        </span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span
        className={cn(
          "font-mono text-sm tabular-nums",
          tone === "pos" && "text-success",
          tone === "neg" && "text-danger",
          tone === "muted" && "text-muted-foreground",
          !tone && "text-foreground",
        )}
      >
        {formatCurrency(value)}
      </span>
    </div>
  )
}

export function PaymentSummary({
  formula,
  showProfit = false,
  showRates = false,
}: {
  formula: Formula
  showProfit?: boolean
  showRates?: boolean
}) {
  const s = deriveSettlement(formula)
  const realized = deriveRealized(formula)
  const expected = deriveExpected(formula)
  return (
    <div className="space-y-3">
      {showProfit && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("formulas.detail.overview.expectedNetProfit")}</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
              {formatCurrency(expected.expectedProfit)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{t("formulas.detail.overview.expectedEquation")}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("formulas.detail.overview.realizedNetProfit")}</p>
            <p
              className={cn(
                "mt-1 font-mono text-lg font-semibold tabular-nums",
                realized.realizedProfit >= 0 ? "text-success" : "text-danger",
              )}
            >
              {formatCurrency(realized.realizedProfit)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">{t("formulas.detail.overview.realizedEquation")}</p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ArrowDownLeft className="size-3.5 text-success" />
              {t("formulas.detail.overview.receiptsIn")}
            </p>
            {showRates && (
              <span className="font-mono text-xs text-muted-foreground">
                {t("formulas.detail.overview.collected", { rate: Math.round(s.receiptRate * 100) })}
              </span>
            )}
          </div>
          <div className="divide-y divide-border">
            <FlowRow tag="Planned" label={t("formulas.detail.overview.scheduledReceipts")} value={s.scheduledReceipts} tone="muted" />
            <FlowRow tag="Actual" label={t("formulas.detail.overview.actualReceipts")} value={s.actualReceipts} tone="pos" />
            <FlowRow tag="Remaining" label={t("formulas.detail.overview.receivable")} value={s.remainingReceivable} />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ArrowUpRight className="size-3.5 text-warning" />
              {t("formulas.detail.overview.paymentsOut")}
            </p>
            {showRates && (
              <span className="font-mono text-xs text-muted-foreground">
                {t("formulas.detail.overview.paid", { rate: Math.round(s.paymentRate * 100) })}
              </span>
            )}
          </div>
          <div className="divide-y divide-border">
            <FlowRow tag="Planned" label={t("formulas.detail.overview.scheduledPayments")} value={s.scheduledPayments} tone="muted" />
            <FlowRow tag="Actual" label={t("formulas.detail.overview.actualPayments")} value={s.actualPayments} />
            <FlowRow tag="Remaining" label={t("formulas.detail.overview.payable")} value={s.remainingPayable} />
          </div>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {t("formulas.detail.overview.paymentFootnote")}
      </p>
    </div>
  )
}

/* ---------------- Six-status model (P0-6) ---------------- */
function SixStatusGrid({ formula }: { formula: Formula }) {
  const statuses = sixStatuses(formula)
  const done = statuses.filter((s) => s.done).length
  const closeable = isCloseable(formula)
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("formulas.detail.sixStatus.title")}</p>
        <span className="text-xs text-muted-foreground">
          {t("formulas.detail.sixStatus.progress", { count: done })} ·{" "}
          <span className={formula.isClosed ? "text-success" : closeable ? "text-success" : "text-muted-foreground"}>
            {formula.isClosed
              ? t("status.closed")
              : closeable
                ? t("formulas.detail.closeReadiness.readyTitle")
                : t("status.active")}
          </span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {statuses.map((s) => (
          <div
            key={s.key}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2",
              s.done ? "border-success/30 bg-success-soft" : "border-border bg-secondary/40",
            )}
          >
            {s.done ? (
              <CheckCircle2 className="size-4 shrink-0 text-success" />
            ) : (
              <Circle className="size-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0">
              <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
                {sixStatusLabel(s.key)}
              </p>
              <p className={cn("truncate text-sm font-medium", s.done ? "text-foreground" : "text-muted-foreground")}>
                {sixStatusValue(formula, s.key, s.value)}
              </p>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        {t("formulas.detail.sixStatus.closeRequirement")}
      </p>
    </div>
  )
}

/* ---------------- Key dates (P0-2) ---------------- */
function KeyDates({ formula }: { formula: Formula }) {
  const dates: { label: string; value?: string }[] = [
    { label: t("formulas.detail.overview.tradeDate"), value: formula.tradeDate },
    { label: t("formulas.detail.overview.contractDate"), value: formula.contractDate },
    { label: t("formulas.detail.overview.created"), value: formula.createdAt },
    { label: t("formulas.detail.overview.updated"), value: formula.updatedAt },
    { label: t("status.closed"), value: formula.closedAt },
    { label: t("status.canceled"), value: formula.canceledAt },
  ]
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("formulas.detail.overview.keyDates")}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {dates.map((d) => (
          <div key={d.label} className="rounded-md bg-secondary/40 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{d.label}</p>
            <p className="mt-0.5 text-sm font-medium text-foreground">{d.value ? formatDate(d.value) : "—"}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function OverviewPanel({ formula }: { formula: Formula }) {
  const status = statusConfig[formula.status]
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("formulas.detail.overview.status")}</p>
          <div className="mt-1.5">
            <StatusBadge tone={status.tone}>{formulaStatusLabel(formula.status)}</StatusBadge>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("formulas.detail.overview.tradeType")}</p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {detailTradeTypeLabel(formula.tradeType)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("formulas.detail.overview.item")}</p>
          <p className="mt-1 truncate text-sm font-medium text-foreground">{formula.item}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("formulas.detail.overview.formulaQuantity")}</p>
          <p className="mt-1 font-mono text-sm font-medium text-foreground">
            {formatNumber(formula.quantity)} {formula.unit}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-3 py-2.5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("formulas.detail.overview.lastUpdated")}</p>
          <p className="mt-1 text-sm font-medium text-foreground">{detailRelativeTime(formula.updatedAt)}</p>
        </div>
      </div>

      <KeyDates formula={formula} />

      <FormulaChainView formula={formula} />

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("formulas.detail.overview.paymentSummary")}
        </p>
        <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
          {t("formulas.detail.overview.paymentSummaryDescription")}
        </p>
        <PaymentSummary formula={formula} showProfit showRates />
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("formulas.detail.overview.profitTransparency")}
        </p>
        <p className="mb-2 text-xs leading-relaxed text-muted-foreground">
          {t("formulas.detail.overview.profitTransparencyDescription")}
        </p>
        <CalculationBreakdown formula={formula} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewStat label={t("formulas.detail.overview.participants")} value={`${formula.participants.length}`} />
        <OverviewStat label={t("formulas.detail.overview.scheduleItems")} value={`${formula.schedule.length}`} />
        <OverviewStat label={t("formulas.detail.overview.invoices")} value={`${formula.invoices.length}`} />
        <OverviewStat label={t("formulas.detail.overview.logisticsLegs")} value={`${formula.logistics.length}`} />
      </div>

      {formula.specMemo && (
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("formulas.detail.overview.specMemo")}
          </p>
          <p className="text-sm leading-relaxed text-foreground">{formula.specMemo}</p>
        </div>
      )}
    </div>
  )
}

/* ---------------- Shares ---------------- */
export function SharesPanel({ formula }: { formula: Formula }) {
  const shares = formula.shares ?? []
  if (shares.length === 0) return <SectionEmpty label="No formula share defined for this formula." />
  const total = shares.reduce((s, x) => s + x.amount, 0)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-4 py-2.5 text-sm text-muted-foreground">
        <PieChart className="size-4 shrink-0 text-accent" />
        Formula Share is a separate deal-level concept — {formatCurrency(total)} allocated across {shares.length}{" "}
        {shares.length === 1 ? "company" : "companies"}. It is not a participant percentage.
      </div>
      {shares.map((s) => {
        const pct = total > 0 ? Math.round((s.amount / total) * 100) : 0
        return (
          <div key={s.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{s.companyName}</p>
                {s.note && <p className="truncate text-xs text-muted-foreground">{s.note}</p>}
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-semibold text-foreground">{formatCurrency(s.amount)}</p>
                <p className="font-mono text-xs text-muted-foreground">{pct}% of share</p>
              </div>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
          </div>
        )
      })}
      <p className="text-xs text-muted-foreground">
        Share amounts are illustrative and deducted from expected profit. Realized shares are settled by backend services
        after integration.
      </p>
    </div>
  )
}

/* ---------------- Settlement ---------------- */
function SettlementCheck({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-4 py-3 text-sm">
      {done ? (
        <CheckCircle2 className="size-4 shrink-0 text-success" />
      ) : (
        <Circle className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  )
}

function TierAmount({ label, value, tone }: { label: string; value: number; tone?: "pos" | "neg" | "muted" }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-mono text-sm tabular-nums",
          tone === "pos" && "text-success",
          tone === "neg" && "text-danger",
          tone === "muted" && "text-muted-foreground",
          !tone && "text-foreground",
        )}
      >
        {formatCurrency(value)}
      </span>
    </div>
  )
}

export function SettlementPanel({ formula }: { formula: Formula }) {
  const s = deriveSettlement(formula)
  const canceled = isFormulaCanceled(formula)
  const closeable = isCloseable(formula)
  const unmatchedPayments = (formula.records ?? []).filter((r) => !r.canceled && !r.scheduleId)
  const invClose = deriveInvoiceClose(formula)
  const invoiceUnmatched = !invClose.done
  const hasUnresolved = s.remainingReceivable > 0 || s.remainingPayable > 0 || unmatchedPayments.length > 0 || invoiceUnmatched

  return (
    <div className="space-y-5">
      {/* 1. Settlement Status */}
      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Settlement Status</p>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {formula.isClosed ? (
                <Lock className="size-5 text-success" />
              ) : canceled ? (
                <Ban className="size-5 text-danger" />
              ) : (
                <Scale className="size-5 text-accent" />
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {formula.isClosed ? "Closed" : canceled ? "Canceled" : "Not Closed"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formula.isClosed
                    ? "Original trade data is immutable. Settlement adjustments are append-only."
                    : canceled
                      ? "Formula canceled — all six statuses are CANCELED. Close and further writes are disabled."
                      : closeable
                        ? "All six statuses matched — ready to close."
                        : "Close condition not yet met (6/6 statuses required)."}
                </p>
              </div>
            </div>
            <StatusBadge tone={formula.isClosed ? "success" : canceled ? "danger" : closeable ? "success" : "outline"}>
              {formula.isClosed ? "Closed" : canceled ? "Canceled" : closeable ? "Ready to close" : "Open"}
            </StatusBadge>
          </div>
          {hasUnresolved && !formula.isClosed && !canceled && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              Outstanding receivable, payable, unmatched, and invoice items remain. These are review/KPI items — they do
              not block closing. Closing requires all six statuses completed.
            </div>
          )}
          {/* Close condition: only the six statuses gate closing. */}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {sixStatuses(formula).map((st) => (
              <SettlementCheck key={st.key} label={`${st.label}: ${st.value}`} done={st.done} />
            ))}
          </div>
          {/* Receivable/payable are KPI / review metrics only — not close conditions. */}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <SettlementCheck label="All receipts collected (KPI)" done={s.remainingReceivable === 0} />
            <SettlementCheck label="All payments cleared (KPI)" done={s.remainingPayable === 0} />
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-accent" />
              Invoice is a Formula close condition, not a transaction blocker. A Formula can continue without invoice
              completion, but cannot close until the invoice amount is matched.
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-accent" />
              Official Formula close is performed by backend services after integration. This screen only previews close
              readiness.
            </div>
          </div>
        </div>
      </section>

      {/* 2. Remaining Balances */}
      <section>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Remaining Balances</p>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="divide-y divide-border">
            <TierAmount label="Receivable (Scheduled − Actual Receipts)" value={s.remainingReceivable} tone="muted" />
            <TierAmount label="Payable (Scheduled − Actual Payments)" value={s.remainingPayable} tone="muted" />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Unmatched Payments</span>
              <span className={cn("font-mono", unmatchedPayments.length > 0 ? "text-warning" : "text-muted-foreground")}>
                {unmatchedPayments.length}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Invoice Unmatched</span>
              <span className={cn("font-mono", invoiceUnmatched ? "text-warning" : "text-muted-foreground")}>
                {invoiceUnmatched ? "Yes" : "No"}
              </span>
            </div>
          </div>
          {s.canceledCount > 0 && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              {s.canceledCount} canceled record{s.canceledCount === 1 ? "" : "s"} ({formatCurrency(s.canceledAmount)})
              excluded from realized totals.
            </p>
          )}
        </div>
      </section>

      {/* 3. Append-only Settlement Adjustments (mock UI) */}
      {/* Append-only adjustments are in SettlementWorkflowActions toolbar above. */}
      {formula.isClosed && (formula.settlementNotes ?? []).length > 0 && (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Settlement Notes</p>
          <div className="space-y-2">
            {formula.settlementNotes!.map((n) => (
              <div key={n.id} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
                <p>{n.text}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {n.createdBy} · {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="rounded-lg border border-border bg-card p-4">
        <SettlementScenarios expectedReceipts={s.scheduledReceipts} expectedPayments={s.scheduledPayments} />
      </div>
    </div>
  )
}
