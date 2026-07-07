"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { useCompany } from "@/components/company-context"
import { useAuth } from "@/components/auth/auth-provider"
import {
  appendPreviewVersion,
  getPreviewVersionHistory,
  setPreviewFormula,
} from "@/lib/formula-preview-session"
import { recomputeFormulaPreview } from "@/lib/formula-preview-mutations"
import { formulaWriteCaps, type FormulaWriteCaps } from "@/lib/permissions"
import type { AppRole } from "@/lib/permissions"
import type { Formula } from "@/lib/types"
import type { VersionEntry } from "@/lib/types"

type FormulaWorkflowContextValue = {
  formula: Formula
  versionHistory: VersionEntry[]
  /** @deprecated Prefer granular `caps`. */
  canWrite: boolean
  caps: FormulaWriteCaps
  role: AppRole
  applyPreview: (mutator: (f: Formula) => Formula) => void
  appendVersion: (entry: VersionEntry) => void
}

const FormulaWorkflowContext = createContext<FormulaWorkflowContextValue | null>(null)

export function FormulaWorkflowProvider({
  initialFormula,
  children,
}: {
  initialFormula: Formula
  children: ReactNode
}) {
  const { isAllCompanies } = useCompany()
  const { user } = useAuth()
  const role: AppRole = user?.role ?? "VIEWER"
  const [formula, setFormula] = useState(() => recomputeFormulaPreview(initialFormula))
  const [versionHistory, setVersionHistory] = useState(() => getPreviewVersionHistory(initialFormula))

  const applyPreview = useCallback((mutator: (f: Formula) => Formula) => {
    setFormula((prev) => {
      const next = recomputeFormulaPreview(mutator(prev))
      setPreviewFormula(next)
      return next
    })
  }, [])

  const appendVersion = useCallback(
    (entry: VersionEntry) => {
      appendPreviewVersion(formula.id, entry)
      setVersionHistory((prev) => [entry, ...prev])
    },
    [formula.id],
  )

  const caps = useMemo(
    () =>
      formulaWriteCaps({
        role,
        isAllCompanies,
        isClosed: formula.isClosed,
        isCanceled: Boolean(formula.canceledAt),
      }),
    [role, isAllCompanies, formula.isClosed, formula.canceledAt],
  )

  const value = useMemo(
    () => ({
      formula,
      versionHistory,
      canWrite: caps.canWrite,
      caps,
      role,
      applyPreview,
      appendVersion,
    }),
    [formula, versionHistory, caps, role, applyPreview, appendVersion],
  )

  return <FormulaWorkflowContext.Provider value={value}>{children}</FormulaWorkflowContext.Provider>
}

export function useFormulaWorkflow() {
  const ctx = useContext(FormulaWorkflowContext)
  if (!ctx) throw new Error("useFormulaWorkflow must be used within FormulaWorkflowProvider")
  return ctx
}
