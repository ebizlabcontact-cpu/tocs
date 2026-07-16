"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { MockPreviewNote } from "./mock-preview-note"
import { t } from "@/lib/i18n"
import {
  ReasonMemoFields,
  StatusGapStrip,
  isReasonValid,
  type BackendGapId,
  type StatusActionSubmit,
} from "./status-completion-modal"

/**
 * Revoke Completion / Completed Cancel modal (Status Workflow spec §1.3). Reason
 * is REQUIRED; Memo optional. Reverts a completed status to its revoke target.
 * This is NOT Formula cancel or close undo.
 */
export function StatusRevocationModal({
  open,
  onClose,
  domainLabel,
  completedValue,
  revokeTarget,
  gapId,
  confirmCopy,
  warning,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  domainLabel: string
  completedValue: string
  revokeTarget: string
  gapId?: BackendGapId
  confirmCopy: string
  warning?: string
  onSubmit: (payload: StatusActionSubmit) => void
}) {
  const [reason, setReason] = useState("")
  const [memo, setMemo] = useState("")

  useEffect(() => {
    if (open) {
      setReason("")
      setMemo("")
    }
  }, [open])

  function submit() {
    if (!isReasonValid(reason)) return
    onSubmit({ reason: reason.trim(), memo: memo.trim() || undefined })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("formulas.detail.sixStatus.revokeTitle", { domain: domainLabel })}
      description={t("formulas.detail.sixStatus.revokeDescription")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("formulas.detail.sixStatus.back")}
          </Button>
          <Button variant="accent" onClick={submit} disabled={!isReasonValid(reason)}>
            {t("formulas.detail.sixStatus.revokePreview")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <MockPreviewNote />
        <StatusGapStrip gapId={gapId} />
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs leading-relaxed text-warning">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {t("formulas.detail.sixStatus.revokeWarning", { warning: warning ? ` ${warning}` : "" })}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">{completedValue}</span>
          <span aria-hidden>→</span>
          <span className="font-medium text-foreground">{revokeTarget}</span>
        </div>
        <ReasonMemoFields reason={reason} memo={memo} onReason={setReason} onMemo={setMemo} />
        <p className="text-xs text-muted-foreground">{confirmCopy}</p>
      </div>
    </Modal>
  )
}
