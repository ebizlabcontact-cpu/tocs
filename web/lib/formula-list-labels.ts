import { t, type TranslationKey } from "@/lib/i18n"
import type { TradeType } from "@/lib/types"
import { formatDate } from "@/lib/utils"

const TRADE_TYPE_KEYS: Record<TradeType, TranslationKey> = {
  import: "formulas.list.tradeType.import",
  export: "formulas.list.tradeType.export",
  domestic: "formulas.list.tradeType.domestic",
  triangular: "formulas.list.tradeType.triangular",
}

const ATTENTION_KEYS: Record<string, TranslationKey> = {
  negativeProfit: "formulas.list.attention.negativeProfit",
  invoiceUnmatched: "formulas.list.attention.invoiceUnmatched",
  paymentOverdue: "formulas.list.attention.paymentOverdue",
}

export function formulaListTradeTypeLabel(tradeType: TradeType): string {
  return t(TRADE_TYPE_KEYS[tradeType])
}

export function formulaListAttentionLabel(attention: string): string {
  return t(ATTENTION_KEYS[attention] ?? "formulas.list.attention.generic")
}

export function formulaListRelativeTime(date: string | Date): string {
  const value = typeof date === "string" ? new Date(date) : date
  const days = Math.floor((Date.now() - value.getTime()) / 86400000)
  if (days <= 0) return t("formulas.list.relativeTime.today")
  if (days === 1) return t("formulas.list.relativeTime.yesterday")
  if (days < 7) return t("formulas.list.relativeTime.daysAgo", { count: days })
  if (days < 30) return t("formulas.list.relativeTime.weeksAgo", { count: Math.floor(days / 7) })
  return formatDate(value)
}
