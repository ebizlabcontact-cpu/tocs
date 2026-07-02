"use client"

import * as React from "react"
import { companies } from "@/lib/mock-data"
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
  // SUPER_ADMIN may switch to "All Companies". Default to first real company.
  const isSuperAdmin = true
  const [selectedId, setSelectedId] = React.useState<string>("c1")

  const selected = companies.find((c) => c.id === selectedId) ?? companies[1]

  const value = React.useMemo<CompanyContextValue>(
    () => ({
      companies,
      selected,
      isAllCompanies: selected.id === "all",
      isSuperAdmin,
      setCompany: setSelectedId,
    }),
    [selected],
  )

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
}

export function useCompany() {
  const ctx = React.useContext(CompanyContext)
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider")
  return ctx
}
