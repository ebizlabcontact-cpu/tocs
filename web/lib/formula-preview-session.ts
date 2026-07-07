/**
 * In-memory preview session for mock-created formulas and detail-page overlays.
 * Survives client navigation within the same browser session only.
 */
import { getFormula, getVersionHistory } from "./mock-data"
import type { CreateFormulaRequest } from "./api-types"
import type { Formula } from "./types"
import type { VersionEntry } from "./types"

const created = new Map<string, Formula>()
const overlays = new Map<string, Formula>()
const versionOverlays = new Map<string, VersionEntry[]>()
/** Future POST body per wizard-created formula (repository seam, preview only). */
const createRequests = new Map<string, CreateFormulaRequest>()

export function registerCreatedFormula(formula: Formula, createRequest?: CreateFormulaRequest): void {
  created.set(formula.id, formula)
  overlays.set(formula.id, formula)
  if (createRequest) createRequests.set(formula.id, createRequest)
}

export function setPreviewFormula(formula: Formula): void {
  overlays.set(formula.id, formula)
}

export function getPreviewFormula(id: string): Formula | undefined {
  const overlay = overlays.get(id)
  if (overlay) return overlay
  const createdFormula = created.get(id)
  if (createdFormula) return createdFormula
  const base = getFormula(id)
  return base
}

/** Retrieve the backend-aligned create request built at wizard submit (preview seam). */
export function getPreviewCreateRequest(id: string): CreateFormulaRequest | undefined {
  return createRequests.get(id)
}

export function listPreviewCreatedFormulas(): Formula[] {
  return [...created.values()]
}

/** Merge seed formulas with wizard-created preview formulas for list views. */
export function mergeFormulasForScope(base: Formula[], companyId: string): Formula[] {
  const byId = new Map(base.map((f) => [f.id, f]))
  for (const f of listPreviewCreatedFormulas()) {
    if (companyId !== "all" && f.companyId !== companyId) continue
    byId.set(f.id, getPreviewFormula(f.id) ?? f)
  }
  for (const [id, overlay] of overlays) {
    if (companyId !== "all" && overlay.companyId !== companyId) continue
    if (byId.has(id) || created.has(id)) byId.set(id, overlay)
  }
  return [...byId.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

export function appendPreviewVersion(formulaId: string, entry: VersionEntry): void {
  const existing = versionOverlays.get(formulaId) ?? getPreviewVersionHistoryById(formulaId)
  versionOverlays.set(formulaId, [entry, ...existing])
}

function getPreviewVersionHistoryById(formulaId: string): VersionEntry[] {
  const f = getPreviewFormula(formulaId)
  if (!f) return []
  return getVersionHistory(f)
}

export function getPreviewVersionHistory(formula: Formula): VersionEntry[] {
  return versionOverlays.get(formula.id) ?? getVersionHistory(formula)
}
