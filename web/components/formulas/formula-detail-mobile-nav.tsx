"use client"

import { Field, Select } from "@/components/ui/field"
import { t, type TranslationKey } from "@/lib/i18n"

/** P2-1: tab value → label map. Must mirror the TabsTrigger values in formula-detail-view. */
const TAB_OPTIONS: { value: string; labelKey: TranslationKey }[] = [
  { value: "overview", labelKey: "formulas.detail.header.overview" },
  { value: "timeline", labelKey: "formulas.detail.header.timeline" },
  { value: "participants", labelKey: "formulas.detail.header.participants" },
  { value: "payments", labelKey: "formulas.detail.header.payments" },
  { value: "invoices", labelKey: "formulas.detail.header.invoices" },
  { value: "logistics", labelKey: "formulas.detail.header.logistics" },
  { value: "shares", labelKey: "formulas.detail.header.shares" },
  { value: "versions", labelKey: "formulas.detail.header.versions" },
  { value: "settlement", labelKey: "formulas.detail.header.settlement" },
]

/**
 * P2-1 mobile-only quick nav for the Formula Detail tab strip. Mirrors the
 * active tab and lets small-screen users jump to any section without hunting
 * through the horizontally scrolling tab strip. Hidden on `lg+`.
 */
export function FormulaDetailMobileNav({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="mb-3 lg:hidden">
      <Field label={t("formulas.detail.header.jumpToSection")}>
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          {TAB_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {t(o.labelKey)}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  )
}
