"use client"

import { useEffect, useState } from "react"
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
 * Intermediate "Modify" transition modal (Status Workflow spec §1.4). Extensible
 * form shell — v0 renders Reason + Memo only. `attachment` and `reference` are
 * reserved V2+ slots (documented, intentionally NOT rendered here):
 *   - attachment: reserve footer zone below memo → future file upload.
 *   - reference:  reserve row below reason → future external doc/ticket ID.
 * Layout order: Title → MockPreviewNote → gap strip → From→To → Reason → Memo →
 * [attachment slot] → [reference slot] → Confirm → Primary.
 */
export function StatusTransitionModal({
  open,
  onClose,
  domainLabel,
  fromLabel,
  toLabel,
  gapId,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  domainLabel: string
  fromLabel: string
  toLabel: string
  gapId?: BackendGapId
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
      title={`Modify ${domainLabel} Status`}
      description="Intermediate transition — mock preview only."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="accent" onClick={submit} disabled={!isReasonValid(reason)}>
            Apply Transition (Preview)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <MockPreviewNote />
        <StatusGapStrip gapId={gapId} />
        <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">{fromLabel}</span>
          <span aria-hidden>→</span>
          <span className="font-medium text-foreground">{toLabel}</span>
        </div>
        <ReasonMemoFields reason={reason} memo={memo} onReason={setReason} onMemo={setMemo} />
        {/* V2+ extension slots (attachment, reference) intentionally not rendered in v0. */}
      </div>
    </Modal>
  )
}
