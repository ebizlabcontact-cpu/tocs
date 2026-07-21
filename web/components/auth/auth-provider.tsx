"use client"

import * as React from "react"
import { bootstrapPreviewAuth, previewLogin, previewLogout, previewMe, type AuthUser } from "@/lib/auth-preview-session"
import type { LoginRequest } from "@/lib/api-types"

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  login: (req: LoginRequest) => Promise<{ ok: true } | { ok: false; message: string }>
  logout: () => void
  refresh: () => void
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null)
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(() => {
    setUser(previewMe())
  }, [])

  React.useEffect(() => {
    bootstrapPreviewAuth()
    setUser(previewMe())
    setLoading(false)
  }, [])

  const login = React.useCallback(async (req: LoginRequest) => {
    const res = previewLogin(req)
    if (!res) return { ok: false as const, message: "Invalid email or password (preview accounts only)." }
    setUser(res.user)
    return { ok: true as const }
  }, [])

  const logout = React.useCallback(() => {
    previewLogout()
    setUser(null)
  }, [])

  const value = React.useMemo(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading, login, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
