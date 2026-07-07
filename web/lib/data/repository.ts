/**
 * Data-access boundary (Sprint 1 — T2 foundation).
 *
 * Single seam between UI and data source. Sprint 1 methods support dual mode:
 *   - `mock` (default): in-memory mock-data
 *   - `api`: rejects with ApiNotWiredError until HTTP is wired (T3–T8)
 *
 * Layer: Component → repository → (mock | api client)
 */
import type { Company, DateRange, Formula, Kpi } from "../types"
import type { WizardState } from "@/components/wizard/types"
import {
  ApiNotWiredError,
  getRepositoryMode,
  type CloseFormulaResult,
  type CloseStatusDto,
  type ConfirmedKpiDto,
  type CreateFormulaRequest,
  type ExpectedKpiDto,
  type FormulaCreateResponse,
  type ListFormulasQuery,
  type LoginRequest,
  type LoginResponse,
  type MeResponse,
  type ParticipantKpiDto,
  type ReceivablePayableDto,
  type RepositoryMode,
  type UnmatchedPaymentDto,
} from "../api-types"
import {
  companies as mockCompanies,
  filterFormulasByRange,
  formulas as mockFormulas,
  getAccessibleCompanies as mockAccessibleCompanies,
  getCalendarEvents as mockCalendarEvents,
  getFormula as mockFormulaById,
  getFormulasByCompany as mockFormulasByCompany,
  getKpis as mockKpis,
  getProfitSeries as mockProfitSeries,
} from "../mock-data"
import {
  deriveExpected,
  deriveRealized,
  deriveSettlement,
  isCloseable,
  derivePerspectiveMetrics,
} from "../formula-math"

export type {
  ApiNotWiredError,
  CloseFormulaResult,
  CloseStatusDto,
  ConfirmedKpiDto,
  CreateFormulaRequest,
  ExpectedKpiDto,
  FormulaCreateResponse,
  ListFormulasQuery,
  LoginRequest,
  LoginResponse,
  MeResponse,
  ParticipantKpiDto,
  ReceivablePayableDto,
  RepositoryMode,
  UnmatchedPaymentDto,
} from "../api-types"
export { getRepositoryMode, isApiNotWiredError } from "../api-types"

export type RangeArgs = {
  range?: DateRange
  customStart?: string
  customEnd?: string
  /** Selected analytical company perspective (maps to `?analytics=`). */
  analyticsCompanyId?: string
}

function ok<T>(value: T): Promise<T> {
  return Promise.resolve(value)
}

function notWired(method: string, route: string, sprint?: string): Promise<never> {
  return Promise.reject(new ApiNotWiredError(method, route, sprint))
}

function assertApiWired(method: string, route: string, sprint: string): void {
  if (getRepositoryMode() === "api") {
    throw new ApiNotWiredError(method, route, sprint)
  }
}

/** Operating scope: company UUID or `"all"` (SUPER_ADMIN). Maps to X-Company-* headers. */
export type OperatingScope = string

function mockFormulaInScope(scope: OperatingScope, id: string): Formula | undefined {
  const formula = mockFormulaById(id)
  if (!formula) return undefined
  if (scope !== "all" && formula.companyId !== scope) return undefined
  return formula
}

function applyListQuery(list: Formula[], query?: ListFormulasQuery): Formula[] {
  if (!query) return list
  let result = list
  if (query.is_closed !== undefined) {
    result = result.filter((f) => f.isClosed === query.is_closed)
  }
  if (query.created_after) {
    const after = new Date(query.created_after).getTime()
    result = result.filter((f) => new Date(f.createdAt).getTime() >= after)
  }
  if (query.created_before) {
    const before = new Date(query.created_before).getTime()
    result = result.filter((f) => new Date(f.createdAt).getTime() <= before)
  }
  if (query.page !== undefined && query.page_size !== undefined && query.page_size > 0) {
    const start = (query.page - 1) * query.page_size
    result = result.slice(start, start + query.page_size)
  }
  return result
}

/* -------------------------------------------------------------------------- */
/* Sprint 1 — core methods                                                    */
/* -------------------------------------------------------------------------- */

async function loginMock(_req: LoginRequest): Promise<LoginResponse> {
  return notWired("login", "POST /api/v1/auth/login", "Sprint 1 T4")
}

async function loginApi(_req: LoginRequest): Promise<LoginResponse> {
  return notWired("login", "POST /api/v1/auth/login", "Sprint 1 T4")
}

async function meMock(): Promise<MeResponse> {
  return notWired("me", "GET /api/v1/auth/me", "Sprint 1 T4")
}

async function meApi(): Promise<MeResponse> {
  return notWired("me", "GET /api/v1/auth/me", "Sprint 1 T4")
}

async function listFormulasMock(scope: OperatingScope, query?: ListFormulasQuery): Promise<Formula[]> {
  return ok(applyListQuery(mockFormulasByCompany(scope), query))
}

async function listFormulasApi(_scope: OperatingScope, _query?: ListFormulasQuery): Promise<Formula[]> {
  return notWired("listFormulas", "GET /api/v1/formulas", "Sprint 1 T6")
}

async function getFormulaMock(scope: OperatingScope, id: string): Promise<Formula | undefined> {
  return ok(mockFormulaInScope(scope, id))
}

async function getFormulaApi(_scope: OperatingScope, _id: string): Promise<Formula | undefined> {
  return notWired("getFormula", "GET /api/v1/formulas/:id", "Sprint 1 T7")
}

async function createFormulaMock(_scope: OperatingScope, _req: CreateFormulaRequest): Promise<FormulaCreateResponse> {
  return notWired("createFormula", "POST /api/v1/formulas", "Sprint 1 T8")
}

async function createFormulaApi(_scope: OperatingScope, _req: CreateFormulaRequest): Promise<FormulaCreateResponse> {
  return notWired("createFormula", "POST /api/v1/formulas", "Sprint 1 T8")
}

async function createFormulaOrchestrationMock(
  _scope: OperatingScope,
  _wizard: WizardState,
): Promise<FormulaCreateResponse> {
  return notWired("createFormulaOrchestration", "POST /api/v1/formulas (+ orchestration)", "Sprint 1 T8–T9")
}

async function createFormulaOrchestrationApi(
  _scope: OperatingScope,
  _wizard: WizardState,
): Promise<FormulaCreateResponse> {
  return notWired("createFormulaOrchestration", "POST /api/v1/formulas (+ orchestration)", "Sprint 1 T8–T9")
}

function dispatch<T>(mockFn: () => Promise<T>, apiFn: () => Promise<T>): Promise<T> {
  return getRepositoryMode() === "mock" ? mockFn() : apiFn()
}

export const repository = {
  /** Current data source mode (env-driven). */
  getMode(): RepositoryMode {
    return getRepositoryMode()
  },

  /* ---- Sprint 1: Auth (T4) ---- */
  login(req: LoginRequest): Promise<LoginResponse> {
    return dispatch(() => loginMock(req), () => loginApi(req))
  },

  me(): Promise<MeResponse> {
    return dispatch(() => meMock(), () => meApi())
  },

  /* ---- Sprint 1: Formula read (T6–T7) ---- */
  listFormulas(scope: OperatingScope, query?: ListFormulasQuery): Promise<Formula[]> {
    return dispatch(
      () => listFormulasMock(scope, query),
      () => listFormulasApi(scope, query),
    )
  },

  listFormulasInRange(scope: OperatingScope, args: RangeArgs = {}, query?: ListFormulasQuery): Promise<Formula[]> {
    assertApiWired("listFormulasInRange", "GET /api/v1/formulas", "Sprint 1 T6")
    const list = mockFormulasByCompany(scope)
    const ranged = filterFormulasByRange(list, args.range ?? "This Year", args.customStart, args.customEnd)
    return ok(applyListQuery(ranged, query))
  },

  getFormula(scope: OperatingScope, id: string): Promise<Formula | undefined> {
    return dispatch(
      () => getFormulaMock(scope, id),
      () => getFormulaApi(scope, id),
    )
  },

  /* ---- Sprint 1: Formula create (T8–T9) ---- */
  createFormula(scope: OperatingScope, req: CreateFormulaRequest): Promise<FormulaCreateResponse> {
    return dispatch(
      () => createFormulaMock(scope, req),
      () => createFormulaApi(scope, req),
    )
  },

  /** Wizard persist — multi-call orchestration (participants, schedules, logistics, shares). */
  createFormulaOrchestration(scope: OperatingScope, wizard: WizardState): Promise<FormulaCreateResponse> {
    return dispatch(
      () => createFormulaOrchestrationMock(scope, wizard),
      () => createFormulaOrchestrationApi(scope, wizard),
    )
  },

  /* ---- Companies (mock only until scoped API) ---- */
  listCompanies(): Promise<Company[]> {
    assertApiWired("listCompanies", "GET /api/v1/companies", "Sprint 1 T5")
    return ok(mockCompanies)
  },

  listAccessibleCompanies(scope: OperatingScope): Promise<Company[]> {
    assertApiWired("listAccessibleCompanies", "GET /api/v1/companies", "Sprint 1 T5")
    return ok(mockAccessibleCompanies(scope))
  },

  /* ---- Dashboard / Calendar (deferred — Sprint 5) ---- */
  getKpis(scope: OperatingScope, args: RangeArgs = {}): Promise<Kpi[]> {
    assertApiWired("getKpis", "GET /api/v1/analytics/kpis", "Sprint 5")
    return ok(mockKpis(scope, args.range ?? "This Year", args.customStart, args.customEnd, args.analyticsCompanyId))
  },

  getProfitSeries(scope: OperatingScope, args: RangeArgs = {}) {
    assertApiWired("getProfitSeries", "GET /api/v1/analytics/profit-series", "Sprint 5")
    return ok(
      mockProfitSeries(scope, args.range ?? "This Year", args.customStart, args.customEnd, args.analyticsCompanyId),
    )
  },

  getCalendarEvents(scope: OperatingScope, flow?: "receipt" | "payment") {
    assertApiWired("getCalendarEvents", "GET /api/v1/calendar", "no MVP route")
    return ok(mockCalendarEvents(scope, flow))
  },

  /* ---- Close (deferred — Sprint 3) ---- */
  getFormulaCloseStatus(id: string): Promise<CloseStatusDto | undefined> {
    assertApiWired("getFormulaCloseStatus", "GET /api/v1/formulas/:id/status", "Sprint 3")
    const f = mockFormulaById(id)
    if (!f) return ok(undefined)
    const allComplete = isCloseable(f)
    return ok({
      formulaId: f.id,
      allComplete,
      closeable: allComplete && !f.isClosed,
      isClosed: f.isClosed,
      closedAt: f.closedAt,
      matched: allComplete ? 6 : 0,
      total: 6,
    })
  },

  closeFormula(_id: string): Promise<CloseFormulaResult> {
    return notWired("closeFormula", "POST /api/v1/formulas/:id/close", "Sprint 3")
  },

  /* ---- KPI previews (mock derivation — Sprint 2–4 for API + equivalence) ---- */
  getFormulaConfirmedKpi(id: string): Promise<ConfirmedKpiDto | undefined> {
    assertApiWired("getFormulaConfirmedKpi", "GET /api/v1/formulas/:id/kpi/confirmed", "Sprint 2")
    const f = mockFormulaById(id)
    if (!f) return ok(undefined)
    const r = deriveRealized(f)
    const s = deriveSettlement(f)
    return ok({
      formulaId: f.id,
      realizedProfit: r.realizedProfit,
      actualReceipts: s.actualReceipts,
      actualPayments: s.actualPayments,
    })
  },

  getFormulaExpectedKpi(id: string): Promise<ExpectedKpiDto | undefined> {
    assertApiWired("getFormulaExpectedKpi", "GET /api/v1/formulas/:id/kpi/expected", "Sprint 4")
    const f = mockFormulaById(id)
    if (!f) return ok(undefined)
    const e = deriveExpected(f)
    return ok({ formulaId: f.id, ...e })
  },

  getFormulaReceivablePayable(id: string): Promise<ReceivablePayableDto | undefined> {
    assertApiWired("getFormulaReceivablePayable", "GET /api/v1/formulas/:id/receivable-payable", "Sprint 2")
    const f = mockFormulaById(id)
    if (!f) return ok(undefined)
    const s = deriveSettlement(f)
    return ok({ formulaId: f.id, receivable: s.remainingReceivable, payable: s.remainingPayable })
  },

  listParticipantKpi(id: string): Promise<ParticipantKpiDto[]> {
    assertApiWired("listParticipantKpi", "GET /api/v1/formulas/:id/kpi/participants", "Sprint 5")
    const f = mockFormulaById(id)
    if (!f) return ok([])
    const companyIds = Array.from(new Set(f.participants.map((p) => p.companyId).filter(Boolean) as string[]))
    return ok(companyIds.map((cid) => derivePerspectiveMetrics(f, cid)))
  },

  listUnmatchedPayments(scope: OperatingScope): Promise<UnmatchedPaymentDto[]> {
    assertApiWired("listUnmatchedPayments", "GET /api/v1/payments/unmatched", "Sprint 5")
    const rows: UnmatchedPaymentDto[] = []
    for (const f of mockFormulasByCompany(scope)) {
      for (const rec of f.records ?? []) {
        if (rec.canceled || rec.scheduleId) continue
        rows.push({
          id: rec.id,
          formulaId: f.id,
          formulaNo: f.number,
          direction: rec.type === "receipt" ? "IN" : "OUT",
          amount: rec.amount,
          actualDate: rec.paidDate,
        })
      }
    }
    return ok(rows)
  },

  /* ---- Metadata patch (deferred) ---- */
  updateFormula(): Promise<never> {
    return notWired("updateFormula", "PATCH /api/v1/formulas/:id", "P1")
  },
}

/** Convenience: the whole mock formula list (legacy — migrate pages to repository). */
export const allFormulas = mockFormulas
