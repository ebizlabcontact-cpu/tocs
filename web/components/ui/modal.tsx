"use client"

import * as React from "react"
import { X, GripHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Modal dialog.
 * - Desktop: opens centered, can be dragged by its header, and is kept inside
 *   the viewport. No resizing.
 * - Mobile: behaves as a bottom sheet (full width, pinned to the bottom).
 * Used for CRUD workflow prototypes (create / edit / confirm). UI only — no
 * persistence.
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
  size?: "sm" | "md" | "lg"
}) {
  const [isMobile, setIsMobile] = React.useState(false)
  const [offset, setOffset] = React.useState({ x: 0, y: 0 })
  const panelRef = React.useRef<HTMLDivElement>(null)
  const drag = React.useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)")
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [])

  // Reset the drag position every time the modal (re)opens so it starts centered.
  React.useEffect(() => {
    if (open) setOffset({ x: 0, y: 0 })
  }, [open])

  React.useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // Clamp the panel so it always stays fully inside the viewport.
  const clamp = React.useCallback((x: number, y: number) => {
    const el = panelRef.current
    if (!el) return { x, y }
    const rect = el.getBoundingClientRect()
    // Current top-left if we applied the raw offset (rect already includes the
    // live transform, so translate back to the un-offset base first).
    const baseLeft = rect.left - offset.x
    const baseTop = rect.top - offset.y
    const minX = -baseLeft + 8
    const maxX = window.innerWidth - rect.width - baseLeft - 8
    const minY = -baseTop + 8
    const maxY = window.innerHeight - rect.height - baseTop - 8
    return {
      x: Math.min(Math.max(x, minX), maxX),
      y: Math.min(Math.max(y, minY), maxY),
    }
  }, [offset.x, offset.y])

  function onHeaderPointerDown(e: React.PointerEvent) {
    if (isMobile) return
    // Don't start a drag from the close button.
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return
    drag.current = { startX: e.clientX, startY: e.clientY, originX: offset.x, originY: offset.y }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onHeaderPointerMove(e: React.PointerEvent) {
    if (!drag.current) return
    const next = clamp(
      drag.current.originX + (e.clientX - drag.current.startX),
      drag.current.originY + (e.clientY - drag.current.startY),
    )
    setOffset(next)
  }

  function onHeaderPointerUp(e: React.PointerEvent) {
    drag.current = null
    ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
  }

  if (!open) return null

  const sizeClass = size === "sm" ? "sm:max-w-sm" : size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg"

  return (
    <div
      className={cn(
        "fixed inset-0 z-[60] flex justify-center",
        isMobile ? "items-end" : "items-center p-4",
      )}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        style={isMobile ? undefined : { transform: `translate(${offset.x}px, ${offset.y}px)` }}
        className={cn(
          "relative flex w-full flex-col border border-border bg-card shadow-[var(--shadow-lifted)] animate-fade-in",
          isMobile
            ? "max-h-[92vh] rounded-t-[var(--radius-lg)]"
            : cn("max-h-[90vh] rounded-[var(--radius-lg)]", sizeClass),
        )}
      >
        <div
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
          className={cn(
            "flex items-start justify-between gap-3 border-b border-border p-4",
            !isMobile && "cursor-grab active:cursor-grabbing select-none",
          )}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {!isMobile && <GripHorizontal className="size-3.5 shrink-0 text-muted-foreground/50" aria-hidden />}
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            </div>
            {description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>}
          </div>
          <button
            type="button"
            data-no-drag
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
