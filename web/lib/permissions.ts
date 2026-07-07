/**
 * UI RBAC preview — mirrors backend membership roles (AUTH_ARCHITECTURE.md).
 * Hides or disables write affordances; server enforces on API.
 */
export type AppRole = "SUPER_ADMIN" | "COMPANY_ADMIN" | "MANAGER" | "VIEWER"

const rank: Record<AppRole, number> = {
  VIEWER: 0,
  MANAGER: 1,
  COMPANY_ADMIN: 2,
  SUPER_ADMIN: 3,
}

export function roleAtLeast(role: AppRole, min: AppRole): boolean {
  return rank[role] >= rank[min]
}

export type FormulaWriteCaps = {
  canWrite: boolean
  canEditMetadata: boolean
  canWritePayments: boolean
  canWriteInvoices: boolean
  canWriteLogistics: boolean
  canWriteShares: boolean
  canCloseOrCancel: boolean
  canSettlementAppend: boolean
  canCommitVersion: boolean
}

export function formulaWriteCaps(opts: {
  role: AppRole
  isAllCompanies: boolean
  isClosed: boolean
  isCanceled: boolean
}): FormulaWriteCaps {
  const { role, isAllCompanies, isClosed, isCanceled } = opts
  const base = !isAllCompanies && !isCanceled && roleAtLeast(role, "MANAGER")
  const admin = roleAtLeast(role, "COMPANY_ADMIN")
  return {
    canWrite: base && !isClosed,
    canEditMetadata: base && !isClosed,
    canWritePayments: base && !isClosed,
    canWriteInvoices: base && !isClosed,
    canWriteLogistics: base && !isClosed,
    canWriteShares: base && !isClosed,
    canCloseOrCancel: admin && !isClosed && !isCanceled,
    canSettlementAppend: admin && isClosed && !isCanceled,
    canCommitVersion: base && !isClosed,
  }
}
