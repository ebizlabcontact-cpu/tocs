/**
 * Mock-created companies (preview session). Merged with registeredCompanies for UI.
 */
import { registeredCompanies } from "./mock-data"
import type { RegisteredCompany } from "./types"
import { uid } from "./utils"

const created: RegisteredCompany[] = []

export function registerCreatedCompany(draft: Omit<RegisteredCompany, "id">): RegisteredCompany {
  const row: RegisteredCompany = { ...draft, id: `co-preview-${uid()}` }
  created.unshift(row)
  return row
}

export function listPreviewCompanies(): RegisteredCompany[] {
  const byId = new Map<string, RegisteredCompany>()
  for (const c of registeredCompanies) byId.set(c.id, c)
  for (const c of created) byId.set(c.id, c)
  return [...byId.values()]
}
