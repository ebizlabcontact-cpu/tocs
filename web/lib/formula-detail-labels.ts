import { t, type TranslationKey } from "@/lib/i18n"
import type { Formula, TradeType } from "@/lib/types"
import { formatDate } from "@/lib/utils"

export function detailRelativeTime(date: string | Date) {
  const value = typeof date === "string" ? new Date(date) : date
  const days = Math.floor((Date.now() - value.getTime()) / 86400000)
  if (days <= 0) return t("formulas.list.relativeTime.today")
  if (days === 1) return t("formulas.list.relativeTime.yesterday")
  if (days < 7) return t("formulas.list.relativeTime.daysAgo", { count: days })
  if (days < 30) return t("formulas.list.relativeTime.weeksAgo", { count: Math.floor(days / 7) })
  return formatDate(value)
}

export function detailTradeTypeLabel(type: TradeType) {
  const keys: Record<TradeType, TranslationKey> = {
    import: "formulas.list.tradeType.import",
    export: "formulas.list.tradeType.export",
    domestic: "formulas.list.tradeType.domestic",
    triangular: "formulas.list.tradeType.triangular",
  }
  return t(keys[type])
}

export function detailAttentionLabel(attention: string) {
  const keys: Record<string, TranslationKey> = {
    negativeProfit: "formulas.list.attention.negativeProfit",
    invoiceUnmatched: "formulas.list.attention.invoiceUnmatched",
    paymentOverdue: "formulas.list.attention.paymentOverdue",
  }
  return t(keys[attention] ?? "formulas.list.attention.generic")
}

export function sixStatusLabel(key: string) {
  const keys: Record<string, TranslationKey> = {
    trade: "formulas.detail.sixStatus.trade",
    cashIn: "formulas.detail.sixStatus.cashIn",
    cashOut: "formulas.detail.sixStatus.cashOut",
    invoice: "formulas.detail.sixStatus.invoice",
    logistics: "formulas.detail.sixStatus.logistics",
    delivery: "formulas.detail.sixStatus.delivery",
  }
  return t(keys[key] ?? "formulas.detail.sixStatus.title")
}

export function sixStatusValue(formula: Formula, key: string, fallback: string) {
  if (formula.canceledAt) return t("status.canceled")
  if (key === "invoice") return fallback
  const raw = key === "trade" ? formula.tradeStatus : key === "cashIn" ? formula.cashInStatus : key === "cashOut" ? formula.cashOutStatus : key === "logistics" ? formula.logisticsStatus : formula.deliveryStatus
  const keys: Record<string, TranslationKey> = {
    draft: "formulas.detail.sixStatus.draft",
    confirmed: "formulas.detail.sixStatus.confirmed",
    completed: "formulas.detail.sixStatus.completed",
    pending: "formulas.detail.sixStatus.pending",
    partial: "formulas.detail.sixStatus.partial",
    not_started: "formulas.detail.sixStatus.notStarted",
    in_transit: "formulas.detail.sixStatus.inTransit",
    delivered: "formulas.detail.sixStatus.delivered",
  }
  return keys[raw] ? t(keys[raw]) : fallback
}
