"use client"

import * as React from "react"
import type { DateRange } from "@/lib/types"
import { DATE_RANGES } from "@/lib/mock-data"

type DateRangeContextValue = {
  ranges: DateRange[]
  range: DateRange
  setRange: (range: DateRange) => void
  /** Custom range endpoints — UI state only, no authoritative filtering. */
  customStart: string
  customEnd: string
  setCustomStart: (v: string) => void
  setCustomEnd: (v: string) => void
}

const DateRangeContext = React.createContext<DateRangeContextValue | null>(null)

/** Default custom window: trailing 30 days (display only). */
function defaultCustom() {
  const end = new Date()
  const start = new Date(Date.now() - 30 * 86400000)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { start: iso(start), end: iso(end) }
}

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [range, setRange] = React.useState<DateRange>("Last 30 Days")
  const initial = React.useMemo(defaultCustom, [])
  const [customStart, setCustomStart] = React.useState(initial.start)
  const [customEnd, setCustomEnd] = React.useState(initial.end)

  const value = React.useMemo<DateRangeContextValue>(
    () => ({ ranges: DATE_RANGES, range, setRange, customStart, customEnd, setCustomStart, setCustomEnd }),
    [range, customStart, customEnd],
  )

  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>
}

export function useDateRange() {
  const ctx = React.useContext(DateRangeContext)
  if (!ctx) throw new Error("useDateRange must be used within DateRangeProvider")
  return ctx
}
