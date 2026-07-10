"use client"

import type { ComponentType } from "react"
import { CheckCircle2, RotateCcw, ArrowRight, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { BackendGapId } from "./status-completion-modal"

/**
 * Per-domain lifecycle card (Status Workflow spec §1.1). Renders Complete /
 * Revoke / Modify affordances per the button-visibility matrix. All mutation
 * lands through parent-provided callbacks (modals live in the parent).
 *
 * Button visibility (open formula, canWrite, not canceled):
 *   - Not done, not derived: Complete + optional Modify.
 *   - Done: badge + Revoke Completion.
 *   - Derived (invoice): Review Invoices → navigate.
 * All action buttons hidden when !canWrite / isClosed / canceled.
 */
export function StatusLifecycleCard({
  label,
  icon: Icon,
  currentValue,
  isDone,
  isDerived = false,
  backendGapId,
  canWrite,
  completeLabel = "Complete (Preview)",
  modifyLabel,
  reviewLabel = "Review Invoices",
  onComplete,
  onRevoke,
  onModify,
  onReview,
}: {
  label: string
  icon?: ComponentType<{ className?: string }>
  currentValue: string
  isDone: boolean
  isDerived?: boolean
  backendGapId?: BackendGapId
  canWrite: boolean
  completeLabel?: string
  modifyLabel?: string
  reviewLabel?: string
  onComplete?: () => void
  onRevoke?: () => void
  onModify?: () => void
  onReview?: () => void
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-3",
        isDone ? "border-success/30 bg-success-soft" : "border-border bg-secondary/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {isDone ? (
            <CheckCircle2 className="size-4 shrink-0 text-success" />
          ) : (
            Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />
          )}
          <div className="min-w-0">
            <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="truncate text-sm font-medium text-foreground">{currentValue}</p>
          </div>
        </div>
        {isDone && !isDerived && (
          <StatusBadge tone="success" className="shrink-0">
            Complete
          </StatusBadge>
        )}
        {backendGapId && (
          <span className="shrink-0 rounded-full border border-warning/30 bg-warning-soft px-1.5 py-0.5 text-[9px] font-semibold uppercase text-warning">
            {backendGapId}
          </span>
        )}
      </div>

      {canWrite && (
        <div className="flex flex-wrap items-center gap-2">
          {isDerived ? (
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={onReview}>
              <ExternalLink className="size-3.5" />
              {reviewLabel}
            </Button>
          ) : isDone ? (
            <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={onRevoke}>
              <RotateCcw className="size-3.5" />
              Revoke Completion (Preview)
            </Button>
          ) : (
            <>
              <Button variant="accent" size="sm" className="gap-1 text-xs" onClick={onComplete}>
                <CheckCircle2 className="size-3.5" />
                {completeLabel}
              </Button>
              {modifyLabel && onModify && (
                <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={onModify}>
                  <ArrowRight className="size-3.5" />
                  {modifyLabel}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
