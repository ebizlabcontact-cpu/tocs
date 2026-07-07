"use client"

import { Info } from "lucide-react"

/** Shown on workflow surfaces that mutate mock preview state only. */
export function MockPreviewNote({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border border-accent/25 bg-accent-soft/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground ${className ?? ""}`}
    >
      <Info className="mt-0.5 size-3.5 shrink-0 text-accent" />
      <span>
        <span className="font-medium text-foreground">Mock preview only.</span> Changes update local preview state —
        no API call, no persistence. Authoritative writes run through backend services after integration.
      </span>
    </div>
  )
}

export const BACKEND_ROUTE_GAPS = {
  delivery: "PATCH /formulas/:id/delivery-status — not shipped (G1)",
  trade: "PATCH /formulas/:id/trade-status — not shipped (G2)",
  cashIn: "PATCH /formulas/:id/cash-in-status — not shipped (G3)",
  cashOut: "PATCH /formulas/:id/cash-out-status — not shipped (G4)",
  vehicles: "Formula logistics vehicle CRUD — not shipped (G5)",
} as const
