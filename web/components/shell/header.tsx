"use client"

import Link from "next/link"
import { Bell, Search, Sparkles } from "lucide-react"
import { CompanySwitcher } from "./company-switcher"
import { DateRangeSelector } from "./date-range-selector"

export function Header() {
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-md md:px-6">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-[var(--radius-md)] bg-primary text-sm font-bold text-primary-foreground">
          T
        </span>
        <span className="hidden text-[15px] font-semibold tracking-tight text-foreground sm:inline">TOCS</span>
      </Link>

      <div className="mx-1 hidden h-6 w-px bg-border md:block" />

      {/* Center controls */}
      <div className="flex flex-1 items-center gap-2">
        <CompanySwitcher />
        <div className="hidden md:block">
          <DateRangeSelector />
        </div>

        <button className="ml-auto flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-border bg-secondary/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary md:ml-2 md:w-64 md:justify-start">
          <Search className="size-4" />
          <span className="hidden md:inline">Search formulas, invoices…</span>
          <kbd className="ml-auto hidden rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground md:inline">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1">
        <button className="relative flex size-9 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
          <Bell className="size-[18px]" />
          <span className="absolute right-2 top-2 size-2 rounded-full bg-danger ring-2 ring-card" />
          <span className="sr-only">Notifications</span>
        </button>
        <button className="hidden size-9 items-center justify-center rounded-[var(--radius-md)] text-accent transition-colors hover:bg-accent-soft sm:flex">
          <Sparkles className="size-[18px]" />
          <span className="sr-only">AI Assistant</span>
        </button>
        <button className="ml-1 flex size-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
          SK
          <span className="sr-only">User menu</span>
        </button>
      </div>
    </header>
  )
}
