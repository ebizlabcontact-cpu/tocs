"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Centered modal dialog. Closes on backdrop click or Escape.
 * Used for CRUD workflow prototypes (create / edit / confirm).
 * UI only — no persistence.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: React.ReactNode
  footer?: React.ReactNode
  size?: "sm" | "md"
}) {
  React.useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden />
      <div
        className={cn(
          "relative flex max-h-[90vh] w-full flex-col rounded-[var(--radius-lg)] border border-border bg-card shadow-[var(--shadow-lifted)] animate-fade-in",
          size === "sm" ? "max-w-sm" : "max-w-lg",
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </button>
        </div>
        {children && <div className="flex-1 overflow-y-auto p-4">{children}</div>}
        {footer && <div className="flex items-center justify-end gap-2 border-t border-border p-4">{footer}</div>}
      </div>
    </div>
  )
}
