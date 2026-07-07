"use client"

import { usePathname } from "next/navigation"
import { AppShell } from "./app-shell"
import { AuthGuard } from "@/components/auth/auth-guard"

/** Login route renders without chrome; all other routes are guarded then wrapped in AppShell. */
export function ShellWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname === "/login") return <>{children}</>
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  )
}
