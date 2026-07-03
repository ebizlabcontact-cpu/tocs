import type { FormulaStatus, InvoiceStatus, TradeType } from "./types"

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "accent" | "outline"

// Lifecycle-only summary tones (P1-2). `loss` (financial) and `in_transit`
// (logistics) are intentionally NOT here — they are not lifecycle stages.
export const statusConfig: Record<FormulaStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  active: { label: "Active", tone: "info" },
  invoicing: { label: "Invoicing", tone: "warning" },
  closeable: { label: "Closeable", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
}

export const tradeTypeConfig: Record<TradeType, { label: string }> = {
  import: { label: "Import" },
  export: { label: "Export" },
  domestic: { label: "Domestic" },
  triangular: { label: "Triangular" },
}

export const invoiceStatusConfig: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  missing: { label: "Missing", tone: "neutral" },
  pending: { label: "Pending", tone: "warning" },
  amount_matched: { label: "Amount Matched", tone: "success" },
  amount_mismatched: { label: "Amount Mismatched", tone: "danger" },
  canceled: { label: "Canceled", tone: "outline" },
}

/** Per-leg transport status (booked → in_transit → arrived → cleared). */
export const logisticsStatusConfig: Record<string, { label: string; tone: Tone }> = {
  not_started: { label: "Not Started", tone: "neutral" },
  in_transit: { label: "In Transit", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  booked: { label: "Booked", tone: "neutral" },
  arrived: { label: "Arrived", tone: "info" },
  cleared: { label: "Cleared", tone: "success" },
}

/**
 * Formula-level LOGISTICS status. Terminal is "Completed" (transport done) —
 * deliberately distinct from the Delivery terminal "Delivered" (P0-2) so the
 * transport process is never confused with final hand-off confirmation.
 */
export const formulaLogisticsStatusConfig: Record<string, { label: string; tone: Tone }> = {
  not_started: { label: "Not Started", tone: "neutral" },
  in_transit: { label: "In Transit", tone: "info" },
  delivered: { label: "Completed", tone: "success" },
}

export const scheduleStatusConfig: Record<string, { label: string; tone: Tone }> = {
  scheduled: { label: "Scheduled", tone: "info" },
  partial: { label: "Partial", tone: "warning" },
  settled: { label: "Settled", tone: "success" },
  overdue: { label: "Overdue", tone: "danger" },
}

/* ---- Six-status model tones (P0-6) ---- */
export const tradeStatusConfig: Record<string, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  confirmed: { label: "Confirmed", tone: "info" },
  completed: { label: "Completed", tone: "success" },
}

export const cashStatusConfig: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "neutral" },
  partial: { label: "Partial", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
}

export const deliveryStatusConfig: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "neutral" },
  in_transit: { label: "In Transit", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
}
