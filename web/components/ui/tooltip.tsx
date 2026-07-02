"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Lightweight CSS-only tooltip. Shows on hover and keyboard focus-within.
 * No external dependencies — matches the existing design language.
 */
export function Tooltip({
  content,
  children,
  side = "bottom",
  className,
}: {
  content: React.ReactNode
  children: React.ReactNode
  side?: "top" | "bottom"
  className?: string
}) {
  return (
    <span className={cn("group/tooltip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 w-max max-w-[15rem] -translate-x-1/2 scale-95 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground opacity-0 shadow-[var(--shadow-lifted)] transition-all duration-150 group-hover/tooltip:scale-100 group-hover/tooltip:opacity-100 group-focus-within/tooltip:scale-100 group-focus-within/tooltip:opacity-100",
          side === "bottom" ? "top-full mt-2" : "bottom-full mb-2",
        )}
      >
        {content}
      </span>
    </span>
  )
}
