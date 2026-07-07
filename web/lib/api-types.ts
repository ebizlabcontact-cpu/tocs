/**
 * API contract types for the frontend repository layer (Sprint 1+).
 *
 * Shapes mirror backend Action DTOs (`src/actions/**`). UI domain types live in
 * `types.ts`; adapters map between them when HTTP is wired (T3+).
 */
import type { PerspectiveMetrics } from "./formula-math"
import type { PrismaTradeType } from "./prisma-mapping"

/* -------------------------------------------------------------------------- */
/* Repository mode                                                            */
/* -------------------------------------------------------------------------- */

/** `mock` = in-memory mock-data; `api` = backend HTTP (wired per sprint). */
export type RepositoryMode = "mock" | "api"

const MODE_ENV_KEYS = ["NEXT_PUBLIC_REPOSITORY_MODE", "NEXT_PUBLIC_API_MODE"] as const

/** Resolve repository mode. Defaults to `mock` so the UI works offline. */
export function getRepositoryMode(): RepositoryMode {
  for (const key of MODE_ENV_KEYS) {
    const raw = process.env[key]?.trim().toLowerCase()
    if (raw === "api") return "api"
    if (raw === "mock") return "mock"
  }
  return "mock"
}

/** Thrown when `api` mode is active but HTTP for a method is not implemented yet. */
export class ApiNotWiredError extends Error {
  readonly code = "API_NOT_WIRED" as const

  constructor(
    readonly method: string,
    readonly route: string,
    readonly sprint?: string,
  ) {
    const phase = sprint ? ` (${sprint})` : ""
    super(`${method} → ${route} is not wired yet${phase}.`)
    this.name = "ApiNotWiredError"
  }
}

export function isApiNotWiredError(err: unknown): err is ApiNotWiredError {
  return err instanceof ApiNotWiredError
}

/* -------------------------------------------------------------------------- */
/* Auth — POST /api/v1/auth/login, GET /api/v1/auth/me                        */
/* -------------------------------------------------------------------------- */

export type LoginRequest = { email: string; password: string }

export type MeResponse = {
  id: string
  name: string
  email: string
  /** Companies the user may operate as (drives X-Company-Id). */
  companyIds: string[]
}

export type LoginResponse = { token: string; user: MeResponse }

/* -------------------------------------------------------------------------- */
/* Formula — GET/POST /api/v1/formulas                                        */
/* -------------------------------------------------------------------------- */

/** Backend POST body (`CreateFormulaRequest` in formula.actions.ts). */
export type CreateFormulaRequest = {
  /** UUID — never a free-text item name. */
  item_id: string
  trade_type: PrismaTradeType
  quantity: number
  unit?: string | null
  base_currency?: string
  foreign_currency?: string | null
  departure_country?: string | null
  arrival_country?: string | null
  contract_exchange_rate?: number | null
  adjusted_exchange_rate?: number | null
  content?: string | null
  note?: string | null
}

/** Backend list query (`ListFormulasQuery` in formula.actions.ts). */
export type ListFormulasQuery = {
  trade_status?: string
  is_closed?: boolean
  created_after?: string
  created_before?: string
  page?: number
  page_size?: number
}

export type FormulaCreateResponse = {
  id: string
  formula_no: string
  trade_type: string
  trade_status: string
  delivery_status: string
  cash_in_status: string
  cash_out_status: string
  invoice_status: string
  logistics_status: string
  is_closed: boolean
  created_at: string
}

export type FormulaDetailResponse = FormulaCreateResponse & {
  item_id: string
  unit: string | null
  quantity: string
  closed_at: string | null
}

export type FormulaListResponse = {
  items: FormulaDetailResponse[]
  total: number
  page: number
  page_size: number
}

/* -------------------------------------------------------------------------- */
/* Deferred Sprint 1+ DTOs (types only — not wired in repository yet)         */
/* -------------------------------------------------------------------------- */

export type CloseStatusDto = {
  formulaId: string
  allComplete: boolean
  closeable: boolean
  isClosed: boolean
  closedAt?: string
  matched: number
  total: number
}

export type CloseFormulaResult = { formulaId: string; isClosed: true; closedAt: string }

export type ConfirmedKpiDto = {
  formulaId: string
  realizedProfit: number
  actualReceipts: number
  actualPayments: number
}

export type ExpectedKpiDto = {
  formulaId: string
  totalSell: number
  totalBuy: number
  cost: number
  share: number
  grossMargin: number
  expectedProfit: number
}

export type ReceivablePayableDto = { formulaId: string; receivable: number; payable: number }

export type ParticipantKpiDto = PerspectiveMetrics

export type UnmatchedPaymentDto = {
  id: string
  formulaId: string
  formulaNo: string
  direction: "IN" | "OUT"
  amount: number
  actualDate?: string
}
