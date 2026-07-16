import type { DateRange } from "@/lib/types"
import { t, type TranslationKey } from "@/lib/i18n"

/** Stable internal IDs — never use translated labels as filter identifiers. */
export const DATE_RANGE_IDS: readonly DateRange[] = [
  "last_7_days",
  "last_30_days",
  "this_month",
  "last_month",
  "this_year",
  "custom_range",
] as const

const LABEL_KEYS: Record<DateRange, TranslationKey> = {
  last_7_days: "shell.dateRange.last7Days",
  last_30_days: "shell.dateRange.last30Days",
  this_month: "shell.dateRange.thisMonth",
  last_month: "shell.dateRange.lastMonth",
  this_year: "shell.dateRange.thisYear",
  custom_range: "shell.dateRange.custom",
}

export function dateRangeLabel(id: DateRange): string {
  return t(LABEL_KEYS[id])
}
