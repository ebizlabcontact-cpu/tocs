"use client"

import { AlertTriangle } from "lucide-react"
import { useCompany } from "@/components/company-context"

export function AllCompaniesBanner() {
  const { isAllCompanies } = useCompany()
  if (!isAllCompanies) return null

  return (
    <div className="flex items-center gap-2.5 border-b border-warning/30 bg-warning-soft px-4 py-2.5 text-sm text-warning md:px-6">
      <AlertTriangle className="size-4 shrink-0" />
      <span className="font-medium">
        Viewing All Companies — aggregated data across every entity. Actions are disabled in this scope.
      </span>
    </div>
  )
}
