/**
 * Mock auth session (preview only). No HTTP — mirrors POST /auth/login + GET /auth/me.
 */
import type { LoginRequest, MeResponse } from "./api-types"
import type { AppRole } from "./permissions"

export type AuthUser = MeResponse & { role: AppRole }

const STORAGE_KEY = "tocs-preview-auth"

const DEMO_USERS: Record<string, { password: string; user: AuthUser }> = {
  "admin@tocs.local": {
    password: "admin",
    user: {
      id: "u-admin",
      name: "Demo Admin",
      email: "admin@tocs.local",
      companyIds: ["c1", "c2", "c3"],
      role: "COMPANY_ADMIN",
    },
  },
  "manager@tocs.local": {
    password: "manager",
    user: {
      id: "u-manager",
      name: "Demo Manager",
      email: "manager@tocs.local",
      companyIds: ["c1", "c2"],
      role: "MANAGER",
    },
  },
  "viewer@tocs.local": {
    password: "viewer",
    user: {
      id: "u-viewer",
      name: "Demo Viewer",
      email: "viewer@tocs.local",
      companyIds: ["c1"],
      role: "VIEWER",
    },
  },
  "super@tocs.local": {
    password: "super",
    user: {
      id: "u-super",
      name: "Demo Super Admin",
      email: "super@tocs.local",
      companyIds: ["c1", "c2", "c3", "all"],
      role: "SUPER_ADMIN",
    },
  },
}

function readSession(): AuthUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

function writeSession(user: AuthUser | null) {
  if (typeof window === "undefined") return
  if (!user) sessionStorage.removeItem(STORAGE_KEY)
  else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user))
}

/** Bootstrap a default preview principal when none is stored (offline dev). */
export function bootstrapPreviewAuth(): AuthUser {
  const existing = readSession()
  if (existing) return existing
  const user = DEMO_USERS["admin@tocs.local"].user
  writeSession(user)
  return user
}

export function previewLogin(req: LoginRequest): { token: string; user: AuthUser } | null {
  const entry = DEMO_USERS[req.email.trim().toLowerCase()]
  if (!entry || entry.password !== req.password) return null
  writeSession(entry.user)
  return { token: "preview-token", user: entry.user }
}

export function previewMe(): AuthUser | null {
  return readSession() ?? bootstrapPreviewAuth()
}

export function previewLogout(): void {
  writeSession(null)
}

export function isSuperAdminRole(role: AppRole): boolean {
  return role === "SUPER_ADMIN"
}
