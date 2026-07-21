"use client"

import { FormulaDetailView } from "./formula-detail-view"
import { FormulaWorkflowProvider } from "./workflows/formula-workflow-context"
import type { Formula } from "@/lib/types"

/** Client shell: holds mock preview state for formula detail workflows. */
export function FormulaDetailShell({ initialFormula }: { initialFormula: Formula }) {
  return (
    <FormulaWorkflowProvider initialFormula={initialFormula}>
      <FormulaDetailView />
    </FormulaWorkflowProvider>
  )
}
