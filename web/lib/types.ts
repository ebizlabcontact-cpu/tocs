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
 * Immutable calculation snapshot captured for a Formula version (mirrors
 * `formula_calculation_snapshots`) (P0-3).
 *
 * A snapshot is the FROZEN financial state at the moment a version was created —
 * it is NOT recomputed live from the current Formula. The frontend only
 * previews snapshots; it never creates or persists them. Backend services
 * capture the authoritative snapshot on each version.
 */
export type CalculationSnapshot = {
  /** FK to the formula version this snapshot belongs to. */
  formulaVersionId: string
  totalSell: number
  totalBuy: number
  totalCost: number
  totalShare: number
  expectedProfit: number
  actualReceipts: number
  actualPayments: number
  realizedProfit: number
  receivable: number
  payable: number
  /** Opaque captured payload (full frozen state) as stored server-side. */
  snapshotJson?: Record<string, unknown>
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

/** Which Formula date a Dashboard/Reports/Calendar view is anchored to (P0-2). */
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
  /** Planned date. */
  dueDate: string
  /** Alias of dueDate, named to match the canonical "Scheduled Date". */
  scheduledDate?: string
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
  /** Vehicle / container / vessel identifier (plate no., container no., vessel name). */
  vehicleIdentifier: string
  /** Vehicle type (truck, container, vessel, aircraft, …). */
  vehicleType: string
  /** Optional memo / reference note. */
  memo?: string
}

export type TimelineEvent = {
  id: string
  type: "created" | "receipt" | "payment" | "invoice" | "logistics" | "version" | "note" | "share"
  title: string
  description: string
  date: string
  actor: string
  linkTab?: string
}

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
  cost: number
  share: number
  expectedProfit: number
  /** Formula-level share allocations (P0-4). */
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

  /* ---- Dates (P0-2) ---- */
  tradeDate: string
  contractDate: string
  createdAt: string
  updatedAt: string
  closedAt?: string
  canceledAt?: string

  version: number
  invoices: InvoiceRecord[]
  logistics: LogisticsLeg[]
  /** Logistics Vehicles, linked to legs by `logisticsId` (P0-1). */
  vehicles: LogisticsVehicle[]
  /** Canonical status-change history — the Timeline projects these (P0-2). */
  statusLogs: StatusLog[]
  timeline: TimelineEvent[]
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
