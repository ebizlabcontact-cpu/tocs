"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { useAuth } from "./auth-provider"

/**
 * V0-AUTH-01 — Protected app shell / route guard (mock preview only).
 *
 * Represents backend session semantics visually: GET /auth/me defines the
 * principal, and middleware enforces scope on all routes. Unauthenticated
 * previews are redirected to /login; authenticated previews render children.
 * No API wiring — reads the mock session via useAuth() (auth-preview-session.ts).
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !user) {
      const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : ""
      router.replace(`/login${next}`)
    }
  }, [loading, user, pathname, router])

  if (loading || !user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-5 animate-spin text-accent" aria-hidden="true" />
        <p className="text-sm">{loading ? "Checking session…" : "Redirecting to sign in…"}</p>
        <span className="sr-only" role="status">
          {loading ? "Checking session" : "Redirecting to sign in"}
        </span>
      </div>
    )
  }

  return <>{children}</>
}
