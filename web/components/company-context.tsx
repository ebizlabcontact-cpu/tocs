"use client"

import * as React from "react"
import { companies } from "@/lib/mock-data"
import { listPreviewCompanies } from "@/lib/company-preview-session"
import { useAuth } from "@/components/auth/auth-provider"
import { isSuperAdminRole } from "@/lib/auth-preview-session"
import type { Company } from "@/lib/types"

type CompanyContextValue = {
  companies: Company[]
  selected: Company
  isAllCompanies: boolean
  isSuperAdmin: boolean
  setCompany: (id: string) => void
}

const CompanyContext = React.createContext<CompanyContextValue | null>(null)

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const isSuperAdmin = user ? isSuperAdminRole(user.role) : false
  const [selectedId, setSelectedId] = React.useState<string>("c1")

  const operatingCompanies = React.useMemo(() => {
    const master = companies.filter((c) => c.id !== "all")
    if (!user) return master
    const allowed = new Set(user.companyIds.filter((id) => id !== "all"))
    const filtered = master.filter((c) => allowed.has(c.id))
    return isSuperAdmin ? companies : filtered.length > 0 ? filtered : master
  }, [user, isSuperAdmin])

  const selected = operatingCompanies.find((c) => c.id === selectedId) ?? operatingCompanies[0] ?? companies[1]

  const value = React.useMemo<CompanyContextValue>(
    () => ({
      companies: operatingCompanies,
      selected,
      isAllCompanies: selected.id === "all",
      isSuperAdmin,
      setCompany: setSelectedId,
    }),
    [operatingCompanies, selected, isSuperAdmin],
  )

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
}

export function useCompany() {
  const ctx = React.useContext(CompanyContext)
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider")
  return ctx
}

/** Registered companies for Companies explorer (includes preview-created). */
export function useRegisteredCompanies() {
  return listPreviewCompanies()
}
