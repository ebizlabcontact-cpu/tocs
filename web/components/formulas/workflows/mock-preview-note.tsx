"use client"

import { Info } from "lucide-react"
import { t } from "@/lib/i18n"

/**
 * Shown on workflow surfaces that mutate mock preview state only.
 * P2-2: `compact` renders a single-line variant for dense surfaces (toolbars);
 * the full variant stays on modals and first-time edit surfaces.
 */
export function MockPreviewNote({ className, compact = false }: { className?: string; compact?: boolean }) {
  if (compact) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border border-accent/25 bg-accent-soft/40 px-3 py-1.5 text-xs text-muted-foreground ${className ?? ""}`}
      >
        <Info className="size-3.5 shrink-0 text-accent" />
        <span>
          <span className="font-medium text-foreground">{t("formulas.detail.sixStatus.previewOnly")}</span>{" "}
          {t("formulas.detail.sixStatus.previewStateOnly")}
        </span>
      </div>
    )
  }
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border border-accent/25 bg-accent-soft/40 px-3 py-2 text-xs leading-relaxed text-muted-foreground ${className ?? ""}`}
    >
      <Info className="mt-0.5 size-3.5 shrink-0 text-accent" />
      <span>
        <span className="font-medium text-foreground">{t("formulas.detail.sixStatus.previewOnly")}</span>{" "}
        {t("formulas.detail.sixStatus.previewDescription")}
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
