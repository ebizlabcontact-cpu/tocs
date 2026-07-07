"use client"

import { usePathname } from "next/navigation"
import { AppShell } from "./app-shell"

/** Login route renders without chrome; all other routes use AppShell. */
export function ShellWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname === "/login") return <>{children}</>
  return <AppShell>{children}</AppShell>
}
