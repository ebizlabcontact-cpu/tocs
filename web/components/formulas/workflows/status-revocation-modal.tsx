"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { MockPreviewNote } from "./mock-preview-note"
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
      title={`Revoke ${domainLabel} Completion`}
      description="Reverses a completed status — history is preserved. Mock preview only."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Back
          </Button>
          <Button variant="accent" onClick={submit} disabled={!isReasonValid(reason)}>
            Revoke Completion (Preview)
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
            This reverses a completed status. History is preserved in Status Logs. This is not Formula cancel or close
            undo.
            {warning ? ` ${warning}` : ""}
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
