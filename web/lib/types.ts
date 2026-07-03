export type Company = {
  id: string
  name: string
  shortName: string
  color: string
}

/**
 * A registered trade company (Company Master). Selectable as a participant in a
 * formula. Company `nature` belongs to the master and is only a default hint —
 * operational roles (Supplier / Buyer / Carrier / Financial / Other) belong to
 * Formula Participants, not here. All extended fields are optional master data.
 */
export type RegisteredCompany = {
  id: string
  name: string
  nature: string
  status: "active" | "inactive"
  // Basic
  englishName?: string
  country?: string
  // Registration
  businessRegNo?: string
  corporateRegNo?: string
  taxType?: string
  // Contact (single default contact — backend supports a company_contacts collection)
  contactPerson?: string
  department?: string
  position?: string
  phone?: string
  mobile?: string
  email?: string
  // Address
  zipCode?: string
  address?: string
  addressDetail?: string
  // Additional
  defaultCurrency?: string
  memo?: string
  tags?: string[]
  /** Prepared for the backend company_contacts collection. */
  contacts?: CompanyContact[]
}

/** One contact row in a company's contact collection (mirrors company_contacts). */
export type CompanyContact = {
  id: string
  name: string
  department?: string
  position?: string
  phone?: string
  mobile?: string
  email?: string
  isPrimary?: boolean
}

/**
 * Lifecycle status used for list filtering / at-a-glance state (P1-2).
 *
 * This is a derived summary of the canonical six-status model (see Formula) —
 * it is NOT an authoritative independent status. It intentionally carries ONLY
 * lifecycle stages. Two conditions that used to live here have been removed
 * because they are not lifecycle stages:
 *   - `loss` is a derived FINANCIAL condition (realized profit < 0) — surfaced
 *     via profit metrics / the "loss" list filter, never the lifecycle badge.
 *   - `in_transit` is a LOGISTICS state — it belongs to `LogisticsState`
 *     (Formula.logisticsStatus), not the lifecycle summary.
 */
export type FormulaStatus =
  | "draft"
  | "active"
  | "invoicing"
  | "closeable"
  | "closed"

export type TradeType = "import" | "export" | "domestic" | "triangular"

export type CurrencyCode = "KRW" | "USD" | "EUR" | "JPY" | "CNY" | "SGD"

/* ---------------- Six-status model (P0-6) ---------------- */
/** Overall trade progression. */
export type TradeProgress = "draft" | "confirmed" | "completed"
/** Cash movement progression (used for both cash-in and cash-out). */
export type CashProgress = "pending" | "partial" | "completed"
/**
 * Coarse Formula-level invoice roll-up used only by list/report summaries.
 * Per-invoice reconciliation uses the canonical `InvoiceStatus` set below.
 */
export type InvoiceState = "unmatched" | "partial" | "complete"

/**
 * Canonical per-invoice status set (P0-3). Single vocabulary across the
 * Formula Detail Invoices tab and close-readiness display.
 *   missing           — no invoice recorded (section-level empty state)
 *   pending           — invoice not yet received (no external amount)
 *   amount_matched    — external amount equals expected amount
 *   amount_mismatched — external amount differs from expected amount
 *   canceled          — voided; remains visible but never counts as matched
 * Status is SYSTEM-DERIVED from amounts (see deriveInvoiceStatus), never
 * user-entered.
 */
export type InvoiceStatus = "missing" | "pending" | "amount_matched" | "amount_mismatched" | "canceled"
/** Physical logistics movement. */
export type LogisticsState = "not_started" | "in_transit" | "delivered"
/** Delivery / hand-off confirmation. */
export type DeliveryState = "pending" | "in_transit" | "delivered"

/**
 * Canonical Formula participant contract (P0-3). One shape for every hop of a
 * dynamic N-hop chain. The same company may appear more than once with
 * different roles — uniqueness is NOT enforced. `sequenceOrder` defines chain
 * order. Share does NOT belong to a participant (see FormulaShare).
 */
export type Participant = {
  id: string
  /** Chain order (0-based). Canonical ordering key. */
  sequenceOrder?: number
  companyId?: string
  /** Display name (kept for legacy rendering). */
  name: string
  company: string
  /** Operational role bucket: supplier / buyer / carrier / financial / other. */
  roleGroup?: string
  /** Company nature hint carried into the chain (manufacturer, trading, …). */
  natureGroup?: string
  /** Settlement terms bucket: prepaid / credit / postpaid. */
  paymentGroup?: string
  quantity?: number
  buyUnitPrice?: number
  sellUnitPrice?: number
  isStart?: boolean
  isEnd?: boolean

  /* ---- Legacy aliases (retained so existing chain visuals keep working) ---- */
  /** @deprecated use roleGroup. */
  role: "buyer" | "seller" | "agent" | "logistics" | "financier"
  /** @deprecated use natureGroup. */
  nature?: string
  /** @deprecated use sequenceOrder. */
  chainOrder?: number
  /** @deprecated use buyUnitPrice. */
  buyPrice?: number
  /** @deprecated use sellUnitPrice. */
  sellPrice?: number
}

/**
 * Formula-level profit share (P0-4). Share is a separate Formula concept — an
 * absolute amount attributed to a company — never a participant percentage.
 */
export type FormulaShare = {
  id: string
  companyId?: string
  companyName: string
  amount: number
  note?: string
}

/**
 * A single field change within a formula version.
 *
 * Values are stored RAW (numbers/strings/booleans) and formatted only at
 * render time via `valueType` — never pre-formatted strings. `versionTriggering`
 * marks whether the field creates a new Formula Version + Snapshot after
 * backend integration; non-triggering fields render under "Non-version notes".
 */
export type VersionChangeValueType = "currency" | "number" | "date" | "text" | "status"

export type VersionChange = {
  field: string
  label: string
  oldValue: number | string | boolean | null
  newValue: number | string | boolean | null
  valueType: VersionChangeValueType
  versionTriggering: boolean
}

/**
 * Immutable calculation snapshot captured for a Formula version. Field-for-field
 * mirror of the Prisma `CalculationSnapshot` model / `formula_calculation_snapshots`
 * table (P0-1). Only calculation fields live here.
 *
 * A snapshot is the FROZEN financial state at the moment a version was created —
 * it is NOT recomputed live from the current Formula. Historical snapshots carry
 * a fixed `snapshotData` payload; they are never re-derived from the current
 * Formula/Formula formula inputs. The frontend only previews snapshots; it never
 * creates or persists them. Backend services capture the authoritative snapshot.
 *
 * NOTE (P0-1): settlement-derived figures (actualReceipts, actualPayments,
 * realizedProfit, receivable, payable) are intentionally NOT part of the
 * calculation snapshot — Prisma does not store them here. They are derived live
 * from PaymentRecords/PaymentSchedules, never frozen into this shape.
 */
export type CalculationSnapshot = {
  /** FK to the formula version this snapshot belongs to (Prisma formulaVersionId). */
  formulaVersionId: string
  /** Prisma quantity — frozen business quantity at capture time. */
  quantity: number
  /** Prisma totalBuyAmount. */
  totalBuyAmount: number
  /** Prisma totalSellAmount. */
  totalSellAmount: number
  /** Prisma totalCost. */
  totalCost: number
  /** Prisma totalShare (rollup of shares[] at capture time). */
  totalShare: number
  /** Prisma netProfit (Expected/net profit at capture time). */
  netProfit: number
  /** Prisma profitRate (percentage); null when not computed. */
  profitRate?: number | null
  /** Prisma exchangeRateUsed; null for domestic / no-FX formulas. */
  exchangeRateUsed?: number | null
  /** Prisma snapshotData — opaque frozen payload (JSON). Fixed, not recomputed. */
  snapshotData: Record<string, unknown>
}

/** One entry in a formula's mock version history. */
export type VersionEntry = {
  versionNo: number
  createdAt: string
  createdBy: string
  summary: string
  changes: VersionChange[]
  /**
   * Immutable snapshot captured with this version (P0-3). Present for historical
   * versions; the current/live version is previewed by recomputing instead.
   */
  snapshot?: CalculationSnapshot
}

/** A scheduled receipt/payment surfaced on the calendar. */
export type CalendarEvent = {
  id: string
  formula: string
  formulaId: string
  item: string
  flow: "receipt" | "payment"
  amount: number
  dueDate: string
  status: string
}

/** Dashboard date-range presets (mock filtering only). */
export type DateRange =
  | "Last 7 Days"
  | "Last 30 Days"
  | "This Month"
  | "Last Month"
  | "This Year"
  | "Custom Range"

/**
 * Which Formula date a Dashboard/Reports/Calendar view is anchored to (P0-1).
 * Every option maps to a canonical persisted date: "Trade Date" →
 * Formula.tradeDate, "Scheduled Payment Date" → PaymentSchedule.scheduledDate,
 * "Actual Payment Date" → PaymentRecord.actualDate, "Closed Date" →
 * Formula.closedAt. "Trade Date" is the default aggregation basis.
 */
export type DateBasis =
  | "Trade Date"
  | "Scheduled Payment Date"
  | "Actual Payment Date"
  | "Closed Date"

/**
 * Tier 1 of the two-tier settlement model (P0-5): a PLANNED receipt/payment.
 * `settledAmount` is a convenience rollup of matched Payment Records.
 */
export type PaymentScheduleItem = {
  id: string
  type: "receipt" | "payment"
  counterparty: string
  amount: number
  /**
   * Planned date — single canonical name matching Prisma
   * `PaymentSchedule.scheduledDate` (P0-5). The former `dueDate` duplicate was
   * removed to avoid ambiguous names.
   */
  scheduledDate: string
  /** UI-derived; "overdue" is computed, not a persisted Prisma PaymentStatus. */
  status: "scheduled" | "partial" | "settled" | "overdue"
  settledAmount: number
}

/**
 * Tier 2 of the two-tier settlement model (P0-5): an ACTUAL receipt/payment
 * record. Realized profit derives from these records, not from schedules.
 */
export type PaymentRecord = {
  id: string
  type: "receipt" | "payment"
  counterparty: string
  amount: number
  /** Actual payment date. */
  paidDate: string
  /** Optional link back to the schedule item this record fulfils. */
  scheduleId?: string
  canceled?: boolean
  /** Reason a record was canceled (shown but excluded from realized totals). */
  cancelReason?: string
}

export type InvoiceRecord = {
  id: string
  number: string
  direction: "issued" | "received"
  counterparty: string
  /** Expected amount, traceable to Formula/participant totals. */
  expectedAmount: number
  /** External invoice amount as received; null while pending (not yet received). */
  externalAmount: number | null
  /** Voided invoice — kept visible but excluded from matched/close counts. */
  canceled?: boolean
  /** When payment against the invoice is due. */
  dueDate: string
  date: string
}

export type LogisticsLeg = {
  id: string
  /** Carrier / freight forwarder handling the leg. */
  carrier: string
  mode: "sea" | "air" | "land"
  origin: string
  destination: string
  status: "booked" | "in_transit" | "arrived" | "cleared"
  /** Estimated arrival. */
  eta: string
  /** Actual arrival at destination; null until arrived. */
  actualArrival: string | null
  /** Actual final delivery / hand-off; null until delivered. */
  actualDelivery: string | null
  /** Leg logistics cost (contributes to Formula logistics cost). */
  cost: number
  /** Party responsible for this leg's cost. */
  costBearer: string
}

/**
 * A vehicle assigned to a logistics leg (mirrors `formula_logistics_vehicles`).
 *
 * Vehicles are a SEPARATE canonical collection linked to a logistics record by
 * `logisticsId` — they are never embedded as flat fields on LogisticsLeg. The
 * UI renders them as linked records under their leg. No vehicle engine: this is
 * a display shape only; authoritative vehicle data comes from backend services.
 */
export type LogisticsVehicle = {
  id: string
  /** FK to the LogisticsLeg (formula_logistics) this vehicle serves. */
  logisticsId: string
  /** Prisma vehicleNo — plate no. / container no. / vessel name (free identifier). */
  vehicleNo: string
  /** Prisma driverName. */
  driverName?: string
  /** Prisma driverPhone. */
  driverPhone?: string
  /** Prisma vehicleCost. */
  vehicleCost?: number
  /**
   * Prisma transportStatus (TradeStatus enum, lowercased for UI). Canonical Prisma
   * values: DRAFT / IN_PROGRESS / COMPLETED / CANCELED. There is NO free-text
   * "vehicle type" column in Prisma — do not reintroduce one.
   */
  transportStatus?: "draft" | "in_progress" | "completed" | "canceled"
  /** Prisma settlementStatus (PaymentStatus enum, lowercased for UI). */
  settlementStatus?: "pending" | "partial" | "completed" | "canceled"
  /** Prisma memo. */
  memo?: string
}

// NOTE (P1-2): the former embedded `TimelineEvent` type was removed. Timeline
// entries are produced by buildTimeline() as `DerivedTimelineEvent` (see
// formula-math.ts) — the Formula never carries a stored timeline array.

/** Which of the six canonical statuses a Status Log entry records a change for. */
export type StatusLogType = "trade" | "cashIn" | "cashOut" | "invoice" | "logistics" | "delivery"

/**
 * One status-change record (mirrors `formula_status_logs`) — the canonical
 * SOURCE of status history (P0-2). The Timeline PROJECTS these entries; it never
 * fabricates status history. Authoritative logs are written by backend services
 * after integration; these are illustrative previews only.
 */
export type StatusLog = {
  id: string
  formulaId: string
  statusType: StatusLogType
  /** Prior status value; null for the first entry of a status type. */
  previousStatus: string | null
  newStatus: string
  changedAt: string
  changedBy: string
  memo?: string
}

/**
 * Canonical frontend Formula contract (P0-1). The single source of truth every
 * derived view (Dashboard, Reports, Calendar, Settlement, Analytics) traces
 * back to. `number` is server-generated in the future — the frontend never
 * owns authoritative numbering. Nothing here is persisted.
 */
export type Formula = {
  id: string
  number: string
  companyId: string
  item: string
  specMemo: string
  tradeType: TradeType
  /** Total business quantity of the formula (may differ from each participant's quantity). */
  quantity: number
  /** Unit for the formula quantity (e.g. "MT"). */
  unit: string
  participants: Participant[]

  /* ---- Currency / FX (P0-7) — preview structure only, no FX engine ---- */
  baseCurrency: CurrencyCode
  transactionCurrency: CurrencyCode
  contractExchangeRate?: number
  adjustedExchangeRate?: number

  /* ---- Expected (preview) financials, derived from priced chain inputs ---- */
  totalSell: number
  totalBuy: number
  /**
   * DERIVED rollup only (P0-6). Not an independent source of truth. The canonical
   * logistics cost path is the sum of `logistics[].cost`; this scalar mirrors that
   * (or a snapshot's totalCost) and must not diverge from it. See deriveExpected.
   */
  cost: number
  /**
   * DERIVED rollup only (P0-2). Canonical share source is `shares[]`
   * (formula_shares). This scalar is a convenience sum of `shares[].amount` kept
   * for legacy UI; Expected Profit uses the shares[]-derived total, never this.
   */
  share: number
  expectedProfit: number
  /** Canonical Formula-level share allocations — source of truth for share (P0-2). */
  shares: FormulaShare[]

  /* ---- Realized financials, derived from actual payment records ---- */
  realizedProfit: number
  actualReceipts: number
  actualPayments: number
  receivable: number
  payable: number

  /* ---- Two-tier settlement (P0-5) ---- */
  schedule: PaymentScheduleItem[]
  records: PaymentRecord[]

  /* ---- Six-status model (P0-6) ---- */
  tradeStatus: TradeProgress
  cashInStatus: CashProgress
  cashOutStatus: CashProgress
  invoiceStatus: InvoiceState
  logisticsStatus: LogisticsState
  deliveryStatus: DeliveryState
  isClosed: boolean

  /* ---- Derived lifecycle summary (for list filtering) ---- */
  status: FormulaStatus
  closeable: boolean
  attention?: string

  /* ---- Canonical business dates (P0-1) ---- */
  /**
   * Canonical trade/transaction date (Prisma Formula.tradeDate, date-only).
   * A real business date — NOT the createdAt audit timestamp. Authoritative
   * basis for date-anchored views (Timeline/Calendar/Reports/Filters).
   * ISO date-only string ("YYYY-MM-DD").
   */
  tradeDate: string
  /**
   * Canonical contract date (Prisma Formula.contractDate, date-only). When the
   * contract was agreed; precedes tradeDate. ISO date-only string ("YYYY-MM-DD").
   */
  contractDate: string
  /** Audit timestamps (not business dates). */
  createdAt: string
  updatedAt: string
  closedAt?: string
  canceledAt?: string

  /**
   * Latest version number shorthand (P1-1). Mirrors the highest
   * FormulaVersion.versionNo; the authoritative history lives in `versions` /
   * getVersionHistory(). This is a convenience counter, not a version record.
   */
  latestVersionNo: number
  invoices: InvoiceRecord[]
  logistics: LogisticsLeg[]
  /** Logistics Vehicles, linked to legs by `logisticsId` (P0-1). */
  vehicles: LogisticsVehicle[]
  /** Canonical status-change history — the Timeline projects these (P0-2). */
  statusLogs: StatusLog[]
  // NOTE (P1-2): there is no embedded `timeline` array. The timeline is DERIVED
  // via buildTimeline() from statusLogs, dates, schedules, and versions — never
  // stored on the Formula.
}

export type Kpi = {
  key: string
  label: string
  value: number
  currency?: boolean
  count?: boolean
  delta?: number
  intent: "neutral" | "success" | "warning" | "danger" | "info"
  drillTo: string
}
