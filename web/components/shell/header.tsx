"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, Search, Sparkles, LogOut, LogIn } from "lucide-react"
import { CompanySwitcher } from "./company-switcher"
import { DateRangeSelector } from "./date-range-selector"
import { useAuth } from "@/components/auth/auth-provider"

function roleLabel(role: string) {
  return role.replace(/_/g, " ")
}

export function Header() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?"

  function handleLogout() {
    logout()
    router.push("/login")
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-md md:px-6">
      <Link href="/" className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-[var(--radius-md)] bg-primary text-sm font-bold text-primary-foreground">
          T
        </span>
        <span className="hidden text-[15px] font-semibold tracking-tight text-foreground sm:inline">TOCS</span>
      </Link>

      <div className="mx-1 hidden h-6 w-px bg-border md:block" />

      <div className="flex min-w-0 flex-1 items-center gap-2">
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

        {user ? (
          <div className="ml-1 flex items-center gap-1.5">
            <Link
              href="/login"
              className="hidden items-center gap-2 rounded-[var(--radius-md)] border border-border px-2.5 py-1.5 text-xs transition-colors hover:bg-secondary sm:flex"
              title={`${user.name} · ${roleLabel(user.role)}`}
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground">
                {initials}
              </span>
              <span className="max-w-[8rem] truncate font-medium text-foreground">{user.name}</span>
              <span className="text-muted-foreground">{roleLabel(user.role)}</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex size-9 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              title="Sign out"
            >
              <LogOut className="size-[18px]" />
              <span className="sr-only">Sign out</span>
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="ml-1 flex size-9 items-center justify-center rounded-[var(--radius-md)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            title="Sign in"
          >
            <LogIn className="size-[18px]" />
            <span className="sr-only">Sign in</span>
          </Link>
        )}
      </div>
    </header>
  )
}
