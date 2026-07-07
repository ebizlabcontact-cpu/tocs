"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import { LogIn, Info } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/field"

const DEMO_HINT = [
  "admin@tocs.local / admin — COMPANY_ADMIN",
  "manager@tocs.local / manager — MANAGER",
  "viewer@tocs.local / viewer — VIEWER",
  "super@tocs.local / super — SUPER_ADMIN",
]

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login } = useAuth()
  const [email, setEmail] = useState("admin@tocs.local")
  const [password, setPassword] = useState("admin")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const res = await login({ email, password })
    setSubmitting(false)
    if (!res.ok) {
      setError(res.message)
      return
    }
    const next = searchParams.get("next")
    router.push(next && next.startsWith("/") ? next : "/formulas")
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center py-12">
      <div className="rounded-xl border border-border bg-card p-8 shadow-[var(--shadow-lifted)]">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <LogIn className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Sign in to TOCS</h1>
            <p className="text-sm text-muted-foreground">Mock preview auth — no API call</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </Field>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" variant="accent" className="w-full gap-2" disabled={submitting}>
            <LogIn className="size-4" />
            {submitting ? "Signing in…" : "Sign in (Preview)"}
          </Button>
        </form>

        <div className="mt-6 flex items-start gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <div>
            <p className="font-medium text-foreground">Demo accounts</p>
            <ul className="mt-1 space-y-0.5 font-mono">
              {DEMO_HINT.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
