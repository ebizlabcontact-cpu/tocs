"use client"

import { Field, Select } from "@/components/ui/field"

/** P2-1: tab value → label map. Must mirror the TabsTrigger values in formula-detail-view. */
const TAB_OPTIONS: { value: string; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "timeline", label: "Timeline" },
  { value: "participants", label: "Participants" },
  { value: "payments", label: "Payments" },
  { value: "invoices", label: "Invoices" },
  { value: "logistics", label: "Logistics" },
  { value: "shares", label: "Shares" },
  { value: "versions", label: "Versions" },
  { value: "settlement", label: "Settlement" },
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
      <Field label="Jump to section">
        <Select value={value} onChange={(e) => onChange(e.target.value)}>
          {TAB_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  )
}
