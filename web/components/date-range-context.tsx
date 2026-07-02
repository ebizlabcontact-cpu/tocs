"use client"

import * as React from "react"
import type { DateRange } from "@/lib/types"
import { DATE_RANGES } from "@/lib/mock-data"

type DateRangeContextValue = {
  ranges: DateRange[]
  range: DateRange
  setRange: (range: DateRange) => void
}

const DateRangeContext = React.createContext<DateRangeContextValue | null>(null)

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [range, setRange] = React.useState<DateRange>("Last 30 Days")

  const value = React.useMemo<DateRangeContextValue>(
    () => ({ ranges: DATE_RANGES, range, setRange }),
    [range],
  )

  return <DateRangeContext.Provider value={value}>{children}</DateRangeContext.Provider>
}

export function useDateRange() {
  const ctx = React.useContext(DateRangeContext)
  if (!ctx) throw new Error("useDateRange must be used within DateRangeProvider")
  return ctx
}
