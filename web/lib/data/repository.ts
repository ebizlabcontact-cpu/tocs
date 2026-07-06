/**
 * Data-access boundary (P0-3).
 *
 * This is the single seam between the UI and the data source. Today it resolves
 * against the in-memory mock dataset; when the backend is integrated, only this
 * file changes — every route here maps 1:1 to a backend endpoint, and the return
 * shapes are the canonical domain types.
 *
 * Design rules:
 *  - Every method is async (Promise-returning) so components adopt loading/error
 *    states now, before the network is real.
 *  - `scope` carries the operating company id (maps to the `X-Company-Id` header).
 *  - Nothing here mutates persisted data — writes will be added as the backend
 *    contract lands. Mutations are intentionally represented as "not implemented"
 *    so the UI never fakes persistence.
 */
import type {
  Company,
  DateRange,
  Formula,
  Kpi,
} from "../types"
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
  type PerspectiveMetrics,
} from "../formula-math"

/** Simulate async resolution without adding artificial latency to interactions. */
function ok<T>(value: T): Promise<T> {
  return Promise.resolve(value)
}

export type RangeArgs = {
  range?: DateRange
  customStart?: string
  customEnd?: string
  /** Selected analytical company perspective (maps to `?analytics=`). */
  analyticsCompanyId?: string
}

/* -------------------------------------------------------------------------- */
/* API DTO signatures (P0-4). Contract-only — no real HTTP wiring yet.         */
/* -------------------------------------------------------------------------- */

/** POST /api/v1/auth/login */
export type LoginRequest = { email: string; password: string }
export type LoginResponse = { token: string; user: MeResponse }

/** GET /api/v1/auth/me */
export type MeResponse = {
  id: string
  name: string
  email: string
  /** Companies the user may operate as (drives X-Company-Id). */
  companyIds: string[]
}

/** POST /api/v1/formulas — request body. Backend owns formula_no; never client-set. */
export type CreateFormulaRequest = {
  item: string
  specMemo?: string
  /** Prisma TradeType (map UI value via toPrismaTradeType before sending). */
  tradeType: "DOMESTIC" | "IMPORT" | "EXPORT" | "MIXED"
  quantity: number
  unit?: string
  contractDate?: string
  tradeDate?: string
}

/** GET /api/v1/formulas/:id/status — authoritative six-status + closeable view. */
export type CloseStatusDto = {
  formulaId: string
  /** All six domain statuses completed/matched. */
  allComplete: boolean
  /** Derived: allComplete && !isClosed. */
  closeable: boolean
  isClosed: boolean
  closedAt?: string
  matched: number
  total: number
}

/** POST /api/v1/formulas/:id/close — result. */
export type CloseFormulaResult = { formulaId: string; isClosed: true; closedAt: string }

/** GET /api/v1/formulas/:id/kpi/confirmed — realized (settled) figures. */
export type ConfirmedKpiDto = {
  formulaId: string
  realizedProfit: number
  actualReceipts: number
  actualPayments: number
}

/** GET /api/v1/formulas/:id/kpi/expected — projected figures. */
export type ExpectedKpiDto = {
  formulaId: string
  totalSell: number
  totalBuy: number
  cost: number
  share: number
  grossMargin: number
  expectedProfit: number
}

/** GET /api/v1/formulas/:id/receivable-payable */
export type ReceivablePayableDto = { formulaId: string; receivable: number; payable: number }

/** GET /api/v1/formulas/:id/kpi/participants */
export type ParticipantKpiDto = PerspectiveMetrics

/** GET /api/v1/payments/unmatched */
export type UnmatchedPaymentDto = {
  id: string
  formulaId: string
  formulaNo: string
  direction: "IN" | "OUT"
  amount: number
  actualDate?: string
}

export const repository = {
  /* ---- Companies (GET /companies) ---- */
  listCompanies(): Promise<Company[]> {
    return ok(mockCompanies)
  },

  /** Companies derivable from the accessible formula set (analytics perspective). */
  listAccessibleCompanies(scope: string): Promise<Company[]> {
    return ok(mockAccessibleCompanies(scope))
  },

  /* ---- Formulas (GET /formulas?companyId=) ---- */
  listFormulas(scope: string): Promise<Formula[]> {
    return ok(mockFormulasByCompany(scope))
  },

  /** Formulas bounded by a real date window (GET /formulas?from=&to=). */
  listFormulasInRange(scope: string, args: RangeArgs = {}): Promise<Formula[]> {
    const list = mockFormulasByCompany(scope)
    return ok(filterFormulasByRange(list, args.range ?? "This Year", args.customStart, args.customEnd))
  },

  /* ---- Single formula (GET /formulas/:id) ---- */
  getFormula(id: string): Promise<Formula | undefined> {
    return ok(mockFormulaById(id))
  },

  /* ---- Dashboard KPIs (GET /analytics/kpis) ---- */
  getKpis(scope: string, args: RangeArgs = {}): Promise<Kpi[]> {
    return ok(mockKpis(scope, args.range ?? "This Year", args.customStart, args.customEnd, args.analyticsCompanyId))
  },

  /* ---- Realized profit series (GET /analytics/profit-series) ---- */
  getProfitSeries(scope: string, args: RangeArgs = {}) {
    return ok(
      mockProfitSeries(scope, args.range ?? "This Year", args.customStart, args.customEnd, args.analyticsCompanyId),
    )
  },

  /* ---- Calendar (GET /calendar) ---- */
  getCalendarEvents(scope: string, flow?: "receipt" | "payment") {
    return ok(mockCalendarEvents(scope, flow))
  },

  /* ---- Auth (backend authority; no local implementation) ---- */
  login(_req: LoginRequest): Promise<LoginResponse> {
    return Promise.reject(new Error("login → POST /api/v1/auth/login (backend authority; not wired)."))
  },
  me(): Promise<MeResponse> {
    return Promise.reject(new Error("me → GET /api/v1/auth/me (backend authority; not wired)."))
  },

  /* ---- Close lifecycle (backend authority; never faked locally) ---- */
  /**
   * GET /api/v1/formulas/:id/status. PREVIEW ONLY: derives from mock so the UI
   * can render the button state now. Authoritative source is v_formula_closeable.
   */
  getFormulaCloseStatus(id: string): Promise<CloseStatusDto | undefined> {
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
  /** POST /api/v1/formulas/:id/close — mutation owned by backend; never local. */
  closeFormula(_id: string): Promise<CloseFormulaResult> {
    return Promise.reject(
      new Error("closeFormula → POST /api/v1/formulas/:id/close (backend close action; not wired)."),
    )
  },

  /* ---- Formula KPIs (PREVIEW ONLY — authoritative sources are backend views) ---- */
  /** GET /kpi/confirmed → v_formula_confirmed_kpi. Preview from mock derivation. */
  getFormulaConfirmedKpi(id: string): Promise<ConfirmedKpiDto | undefined> {
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
  /** GET /kpi/expected → v_formula_profit_engine. Preview from mock derivation. */
  getFormulaExpectedKpi(id: string): Promise<ExpectedKpiDto | undefined> {
    const f = mockFormulaById(id)
    if (!f) return ok(undefined)
    const e = deriveExpected(f)
    return ok({ formulaId: f.id, ...e })
  },
  /** GET /receivable-payable → confirmed KPI view. Preview from mock derivation. */
  getFormulaReceivablePayable(id: string): Promise<ReceivablePayableDto | undefined> {
    const f = mockFormulaById(id)
    if (!f) return ok(undefined)
    const s = deriveSettlement(f)
    return ok({ formulaId: f.id, receivable: s.remainingReceivable, payable: s.remainingPayable })
  },
  /** GET /kpi/participants → v_participant_confirmed_kpi. Preview from mock derivation. */
  listParticipantKpi(id: string): Promise<ParticipantKpiDto[]> {
    const f = mockFormulaById(id)
    if (!f) return ok([])
    const companyIds = Array.from(new Set(f.participants.map((p) => p.companyId).filter(Boolean) as string[]))
    return ok(companyIds.map((cid) => derivePerspectiveMetrics(f, cid)))
  },
  /** GET /payments/unmatched → unmatched view. Preview from mock records. */
  listUnmatchedPayments(scope: string): Promise<UnmatchedPaymentDto[]> {
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

  /* ---- Writes (deferred to backend) ---- */
  createFormula(_req: CreateFormulaRequest): Promise<never> {
    return Promise.reject(
      new Error("createFormula → POST /api/v1/formulas (backend owns formula_no; not wired)."),
    )
  },
  updateFormula(): Promise<never> {
    return Promise.reject(
      new Error("updateFormula is not implemented in the frontend — persistence is owned by backend services."),
    )
  },
}

/** Convenience: the whole mock formula list (used by pages still reading directly). */
export const allFormulas = mockFormulas
