import type { FormulaStatus, TradeType } from "./types"

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "accent" | "outline"

export const statusConfig: Record<FormulaStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  active: { label: "Active", tone: "info" },
  in_transit: { label: "In Transit", tone: "accent" },
  invoicing: { label: "Invoicing", tone: "warning" },
  closeable: { label: "Closeable", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
  loss: { label: "Loss", tone: "danger" },
}

export const tradeTypeConfig: Record<TradeType, { label: string }> = {
  import: { label: "Import" },
  export: { label: "Export" },
  domestic: { label: "Domestic" },
  triangular: { label: "Triangular" },
}

export const invoiceStatusConfig: Record<string, { label: string; tone: Tone }> = {
  complete: { label: "Complete", tone: "success" },
  partial: { label: "Partial", tone: "warning" },
  unmatched: { label: "Unmatched", tone: "danger" },
  matched: { label: "Matched", tone: "success" },
  pending: { label: "Pending", tone: "neutral" },
}

export const logisticsStatusConfig: Record<string, { label: string; tone: Tone }> = {
  not_started: { label: "Not Started", tone: "neutral" },
  in_transit: { label: "In Transit", tone: "info" },
  delivered: { label: "Delivered", tone: "success" },
  booked: { label: "Booked", tone: "neutral" },
  arrived: { label: "Arrived", tone: "info" },
  cleared: { label: "Cleared", tone: "success" },
}

export const scheduleStatusConfig: Record<string, { label: string; tone: Tone }> = {
  scheduled: { label: "Scheduled", tone: "info" },
  partial: { label: "Partial", tone: "warning" },
  settled: { label: "Settled", tone: "success" },
  overdue: { label: "Overdue", tone: "danger" },
}
