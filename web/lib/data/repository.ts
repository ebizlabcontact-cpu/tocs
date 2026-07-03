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

  /* ---- Writes (deferred to backend) ---- */
  createFormula(): Promise<never> {
    return Promise.reject(
      new Error("createFormula is not implemented in the frontend — persistence is owned by backend services."),
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
