"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type TabsContextValue = {
  value: string
  setValue: (v: string) => void
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

export function Tabs({
  value,
  onValueChange,
  children,
  className,
}: {
  value: string
  onValueChange: (v: string) => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <TabsContext.Provider value={{ value, setValue: onValueChange }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  )
}

export function TabsList({
  children,
  className,
  showScrollHints = false,
}: {
  children: React.ReactNode
  className?: string
  /** P2-1: render left/right fade edges when the tab strip is horizontally scrollable. */
  showScrollHints?: boolean
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [hints, setHints] = React.useState({ left: false, right: false })

  const update = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    setHints({ left: scrollLeft > 1, right: scrollLeft + clientWidth < scrollWidth - 1 })
  }, [])

  React.useEffect(() => {
    if (!showScrollHints) return
    update()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)
    return () => {
      el.removeEventListener("scroll", update)
      window.removeEventListener("resize", update)
    }
  }, [showScrollHints, update])

  const list = (
    <div
      ref={scrollRef}
      role="tablist"
      className={cn(
        "flex items-center gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1",
        className,
      )}
    >
      {children}
    </div>
  )

  if (!showScrollHints) return list

  return (
    <div className="relative">
      {list}
      {hints.left && (
        <div className="pointer-events-none absolute inset-y-1 left-0 w-8 rounded-l-lg bg-gradient-to-r from-card to-transparent" />
      )}
      {hints.right && (
        <div className="pointer-events-none absolute inset-y-1 right-0 w-8 rounded-r-lg bg-gradient-to-l from-card to-transparent" />
      )}
    </div>
  )
}

export function TabsTrigger({
  value,
  children,
  count,
}: {
  value: string
  children: React.ReactNode
  count?: number
}) {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error("TabsTrigger must be used within Tabs")
  const active = ctx.value === value
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => ctx.setValue(value)}
      className={cn(
        "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      {count !== undefined && (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-xs tabular-nums",
            active ? "bg-accent-foreground/15 text-accent-foreground" : "bg-secondary text-muted-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string
  children: React.ReactNode
  className?: string
}) {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error("TabsContent must be used within Tabs")
  if (ctx.value !== value) return null
  return (
    <div role="tabpanel" className={cn("animate-fade-in", className)}>
      {children}
    </div>
  )
}
