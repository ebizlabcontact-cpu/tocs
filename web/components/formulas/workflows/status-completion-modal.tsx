"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Label, inputClass } from "@/components/ui/field"
import { MockPreviewNote } from "./mock-preview-note"
import { t } from "@/lib/i18n"

/** Backend gap ids that show an honest "route not shipped" strip in status modals. */
export type BackendGapId = "G1" | "G2" | "G3" | "G4"

/** Shared payload emitted by every status modal (Status Workflow spec §1.5). */
export type StatusActionSubmit = { reason: string; memo?: string }

const REASON_MIN = 3

/** Honest backend gap strip — preview lifecycle enabled, no fake persistence (§2.3). */
export function StatusGapStrip({ gapId }: { gapId?: BackendGapId }) {
  if (!gapId) return null
  return (
    <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs leading-relaxed text-warning">
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>
        <span className="font-medium">{t("formulas.detail.sixStatus.backendGap", { gapId })}</span>{" "}
        {t("formulas.detail.sixStatus.previewStateOnly")}
      </span>
    </div>
  )
}

/** Reason (required, min 3 chars) + optional Memo — shared field group (§0.1). */
export function ReasonMemoFields({
  reason,
  memo,
  onReason,
  onMemo,
  reasonLabel = t("formulas.detail.sixStatus.reason"),
}: {
  reason: string
  memo: string
  onReason: (v: string) => void
  onMemo: (v: string) => void
  reasonLabel?: string
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="status-reason">{reasonLabel}</Label>
        <textarea
          id="status-reason"
          className={inputClass}
          rows={2}
          value={reason}
          onChange={(e) => onReason(e.target.value)}
          placeholder={t("formulas.detail.sixStatus.reasonPlaceholder")}
        />
        {reason.trim().length > 0 && reason.trim().length < REASON_MIN && (
          <p className="mt-1 text-xs text-warning">
            {t("formulas.detail.sixStatus.reasonError", { count: REASON_MIN })}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="status-memo">{t("formulas.detail.sixStatus.memo")}</Label>
        <textarea
          id="status-memo"
          className={inputClass}
          rows={2}
          value={memo}
          onChange={(e) => onMemo(e.target.value)}
          placeholder={t("formulas.detail.sixStatus.memoPlaceholder")}
        />
      </div>
    </div>
  )
}

export function isReasonValid(reason: string): boolean {
  return reason.trim().length >= REASON_MIN
}

/**
 * Terminal "complete" modal (Status Workflow spec §1.2). Reason required, Memo
 * optional, backend gap strip when applicable. Emits one StatusActionSubmit.
 */
export function StatusCompletionModal({
  open,
  onClose,
  domainLabel,
  currentValue,
  targetValue,
  gapId,
  confirmCopy,
  bodyNote,
  primaryLabel = t("formulas.detail.sixStatus.completePreview"),
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  domainLabel: string
  currentValue: string
  targetValue: string
  gapId?: BackendGapId
  confirmCopy: string
  bodyNote?: string
  primaryLabel?: string
  onSubmit: (payload: StatusActionSubmit) => void
}) {
  const [reason, setReason] = useState("")
  const [memo, setMemo] = useState("")
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    if (open) {
      setReason("")
      setMemo("")
      setConfirmed(false)
    }
  }, [open])

  function submit() {
    if (!isReasonValid(reason) || !confirmed) return
    onSubmit({ reason: reason.trim(), memo: memo.trim() || undefined })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("formulas.detail.sixStatus.completeTitle", { domain: domainLabel })}
      description={t("formulas.detail.sixStatus.completeDescription")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("formulas.detail.sixStatus.cancel")}
          </Button>
          <Button variant="accent" onClick={submit} disabled={!isReasonValid(reason) || !confirmed}>
            {primaryLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <MockPreviewNote />
        <StatusGapStrip gapId={gapId} />
        {bodyNote && (
          <p className="rounded-lg border border-border bg-secondary/30 p-3 text-xs leading-relaxed text-muted-foreground">
            {bodyNote}
          </p>
        )}
        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">{currentValue}</span>
          <span aria-hidden>→</span>
          <span className="font-medium text-foreground">{targetValue}</span>
        </div>
        <ReasonMemoFields reason={reason} memo={memo} onReason={setReason} onMemo={setMemo} />
        <label className="flex items-start gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>{confirmCopy}</span>
        </label>
      </div>
    </Modal>
  )
}
