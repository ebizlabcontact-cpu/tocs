/**
 * Frontend ↔ Prisma adapter mapping (P0-5).
 *
 * The frontend uses lowercase, UI-friendly enum vocabularies. Prisma/PostgreSQL
 * uses UPPER_SNAKE_CASE enums. This module is the SINGLE explicit place that
 * translates between the two so there is no ambiguity about how a UI value maps
 * to the canonical persisted enum. It is a pure mapping layer — no persistence,
 * no engine, no invented fields.
 *
 * Prisma enums referenced (see prisma/schema.prisma):
 *   TradeStatus       DRAFT | IN_PROGRESS | COMPLETED | CANCELED
 *   PaymentStatus     PENDING | PARTIAL | COMPLETED | CANCELED
 *   PaymentDirection  IN | OUT
 *   InvoiceStatus     NOT_ISSUED | ISSUED | RECEIVED | AMOUNT_MATCHED |
 *                     AMOUNT_MISMATCHED | CANCELED | REVISION_REQUIRED
 */

import type {
  TradeProgress,
  CashProgress,
  InvoiceStatus as UiInvoiceStatus,
  LogisticsState,
  DeliveryState,
  TradeType as UiTradeType,
} from "./types"

/* -------------------------------------------------------------------------- */
/* Prisma enum string unions (mirror schema.prisma exactly)                    */
/* -------------------------------------------------------------------------- */

export type PrismaTradeType = "DOMESTIC" | "IMPORT" | "EXPORT" | "MIXED"
export type PrismaTradeStatus = "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELED"
export type PrismaPaymentStatus = "PENDING" | "PARTIAL" | "COMPLETED" | "CANCELED"
export type PrismaPaymentDirection = "IN" | "OUT"
export type PrismaInvoiceStatus =
  | "NOT_ISSUED"
  | "ISSUED"
  | "RECEIVED"
  | "AMOUNT_MATCHED"
  | "AMOUNT_MISMATCHED"
  | "CANCELED"
  | "REVISION_REQUIRED"

/* -------------------------------------------------------------------------- */
/* Trade type (Formula.tradeType — Prisma TradeType)                           */
/* -------------------------------------------------------------------------- */

/**
 * Frontend TradeType → Prisma TradeType.
 * IMPORTANT: the UI "triangular" trade has no dedicated Prisma enum member — it
 * maps to MIXED (multi-leg / mixed import-export). This is the confirmed P0-1
 * contract; do not persist "triangular" as a raw value.
 */
export function toPrismaTradeType(v: UiTradeType): PrismaTradeType {
  switch (v) {
    case "import":
      return "IMPORT"
    case "export":
      return "EXPORT"
    case "domestic":
      return "DOMESTIC"
    case "triangular":
      return "MIXED"
  }
}

/** Prisma TradeType → Frontend TradeType (MIXED surfaces as "triangular"). */
export function fromPrismaTradeType(v: PrismaTradeType): UiTradeType {
  switch (v) {
    case "IMPORT":
      return "import"
    case "EXPORT":
      return "export"
    case "DOMESTIC":
      return "domestic"
    case "MIXED":
      return "triangular"
  }
}

/* -------------------------------------------------------------------------- */
/* Trade status (Formula.tradeStatus — Prisma TradeStatus)                     */
/* -------------------------------------------------------------------------- */

/** Frontend TradeProgress → Prisma TradeStatus. */
export function toPrismaTradeStatus(v: TradeProgress): PrismaTradeStatus {
  switch (v) {
    case "draft":
      return "DRAFT"
    case "confirmed":
      return "IN_PROGRESS"
    case "completed":
      return "COMPLETED"
  }
}

/* -------------------------------------------------------------------------- */
/* Delivery / logistics status (Prisma TradeStatus in schema)                  */
/* -------------------------------------------------------------------------- */

/** Frontend LogisticsState → Prisma TradeStatus (Formula.logisticsStatus). */
export function toPrismaLogisticsStatus(v: LogisticsState): PrismaTradeStatus {
  switch (v) {
    case "not_started":
      return "DRAFT"
    case "in_transit":
      return "IN_PROGRESS"
    case "delivered":
      return "COMPLETED"
  }
}

/** Frontend DeliveryState → Prisma TradeStatus (Formula.deliveryStatus). */
export function toPrismaDeliveryStatus(v: DeliveryState): PrismaTradeStatus {
  switch (v) {
    case "pending":
      return "DRAFT"
    case "in_transit":
      return "IN_PROGRESS"
    case "delivered":
      return "COMPLETED"
  }
}

/* -------------------------------------------------------------------------- */
/* Cash-in / cash-out status (Prisma PaymentStatus)                            */
/* -------------------------------------------------------------------------- */

/** Frontend CashProgress → Prisma PaymentStatus (Formula.cashIn/cashOutStatus). */
export function toPrismaPaymentStatus(v: CashProgress): PrismaPaymentStatus {
  switch (v) {
    case "pending":
      return "PENDING"
    case "partial":
      return "PARTIAL"
    case "completed":
      return "COMPLETED"
  }
}

/**
 * Frontend PaymentScheduleItem.status → Prisma PaymentStatus.
 * NOTE: "overdue" is a UI-derived condition, NOT a persisted Prisma value — it
 * maps to PENDING (still awaiting settlement); the overdue flag is computed.
 */
export function toPrismaScheduleStatus(
  v: "scheduled" | "partial" | "settled" | "overdue",
): PrismaPaymentStatus {
  switch (v) {
    case "scheduled":
    case "overdue":
      return "PENDING"
    case "partial":
      return "PARTIAL"
    case "settled":
      return "COMPLETED"
  }
}

/* -------------------------------------------------------------------------- */
/* Payment direction (Prisma PaymentDirection)                                 */
/* -------------------------------------------------------------------------- */

/**
 * Frontend receipt/payment flow → Prisma PaymentDirection.
 * A receipt is money coming IN; a payment is money going OUT.
 */
export function toPrismaPaymentDirection(flow: "receipt" | "payment"): PrismaPaymentDirection {
  return flow === "receipt" ? "IN" : "OUT"
}

/* -------------------------------------------------------------------------- */
/* Invoice status (Prisma InvoiceStatus)                                       */
/* -------------------------------------------------------------------------- */

/**
 * Frontend per-invoice UiInvoiceStatus → Prisma InvoiceStatus.
 * The frontend uses a reduced, amount-derived set; Prisma carries a richer
 * lifecycle. "missing" is a section-level empty state (no row) and maps to
 * NOT_ISSUED; "pending" (received but no external amount) maps to RECEIVED.
 */
export function toPrismaInvoiceStatus(v: UiInvoiceStatus): PrismaInvoiceStatus {
  switch (v) {
    case "missing":
      return "NOT_ISSUED"
    case "pending":
      return "RECEIVED"
    case "amount_matched":
      return "AMOUNT_MATCHED"
    case "amount_mismatched":
      return "AMOUNT_MISMATCHED"
    case "canceled":
      return "CANCELED"
  }
}

/* -------------------------------------------------------------------------- */
/* PaymentRecord date boundary (paidDate → actualDate)                         */
/* -------------------------------------------------------------------------- */

/**
 * The UI names a settled payment's date `paidDate`; the backend/Prisma column is
 * `actualDate`. Translate at the API boundary — do not send `paidDate`.
 */
export function toPrismaPaymentRecord<T extends { paidDate?: string }>(
  record: T,
): Omit<T, "paidDate"> & { actualDate?: string } {
  const { paidDate, ...rest } = record
  return { ...rest, actualDate: paidDate }
}

/* -------------------------------------------------------------------------- */
/* UI-only lifecycle contract (NOT persisted / NOT DB state)                   */
/* -------------------------------------------------------------------------- */

/**
 * FormulaStatus is a UI lifecycle projection ONLY (open → closeable → closed).
 * It is NEVER a DB column. The backend persists the six domain statuses
 * (tradeStatus, logisticsStatus, deliveryStatus, cashInStatus, cashOutStatus,
 * and invoice status) plus is_closed / closed_at. The UI status is derived from
 * those — do not send FormulaStatus to the backend.
 *
 * closeable: DERIVED view value (all six complete && !is_closed). Never stored.
 * isClosed / closedAt: API/DB fields ONLY (set by POST /formulas/:id/close).
 *   The frontend mock simulates them for preview but they carry NO authority.
 */
export const LIFECYCLE_CONTRACT = {
  formulaStatus: "ui-derived-only",
  closeable: "ui-derived-only",
  isClosed: "api-field-only",
  closedAt: "api-field-only",
} as const

/* -------------------------------------------------------------------------- */
/* UI-only fields that must NOT be sent as Formula DTO fields                   */
/* -------------------------------------------------------------------------- */

/**
 * Fields present on the frontend Formula/Company types that are NOT backend
 * Formula/Company DTO fields (P0-2). Documented so the API adapter strips them.
 *
 *   Formula.companyId    → operating scope lives in X-Company-Id header;
 *                          analytical ownership lives in participants[].companyId.
 *   Formula.canceledAt   → no such column; cancel = six CANCELED statuses + logs.
 *   Formula.attention    → UI-derived alert string; never a DTO field.
 *   Formula.latestVersionNo → derive from the version list / API response.
 *   Formula.number       → display only; backend owns formula_no on create.
 *   Company.color        → UI chrome only; not a Prisma Company field.
 *   Company.shortName    → UI chrome only; not a Prisma Company field.
 */
export const UI_ONLY_FIELDS = {
  formula: ["companyId", "canceledAt", "attention", "latestVersionNo", "number"],
  company: ["color", "shortName"],
} as const

/* -------------------------------------------------------------------------- */
/* Field-name mapping reference (documentation, not executable)                */
/* -------------------------------------------------------------------------- */

/**
 * Canonical field-name mapping between UI-facing types and Prisma/canonical
 * fields (P0-5). Kept as data so it can be referenced/tested. This resolves the
 * previously ambiguous duplicate names.
 *
 *   UI (frontend type.field)          →  Prisma model.field
 *   Formula.number                    →  Formula.formulaNo  (format FM-YYMM-NNNNN)
 *   Formula.latestVersionNo           →  MAX(FormulaVersion.versionNo)  (was Formula.version)
 *   Formula.tradeDate                 →  Formula.tradeDate     (date-only, canonical)
 *   Formula.contractDate              →  Formula.contractDate  (date-only, canonical)
 *   VersionEntry.versionNo            →  FormulaVersion.versionNo
 *   PaymentScheduleItem.scheduledDate →  PaymentSchedule.scheduledDate  (was dueDate)
 *   PaymentRecord.paidDate            →  PaymentRecord.actualDate
 *   CalculationSnapshot.netProfit     →  CalculationSnapshot.netProfit  (was expectedProfit)
 *   CalculationSnapshot.totalBuyAmount→  CalculationSnapshot.totalBuyAmount (was totalBuy)
 *   CalculationSnapshot.totalSellAmount→ CalculationSnapshot.totalSellAmount (was totalSell)
 *   LogisticsVehicle.vehicleNo        →  LogisticsVehicle.vehicleNo (was vehicleIdentifier)
 *   (removed) Formula.timeline[]       →  derived via buildTimeline(); no column
 */
export const FIELD_NAME_MAP = {
  "Formula.number": "Formula.formulaNo",
  "Formula.latestVersionNo": "FormulaVersion.versionNo(max)",
  "Formula.tradeDate": "Formula.tradeDate",
  "Formula.contractDate": "Formula.contractDate",
  "VersionEntry.versionNo": "FormulaVersion.versionNo",
  "PaymentScheduleItem.scheduledDate": "PaymentSchedule.scheduledDate",
  "PaymentRecord.paidDate": "PaymentRecord.actualDate",
  "CalculationSnapshot.netProfit": "CalculationSnapshot.netProfit",
  "CalculationSnapshot.totalBuyAmount": "CalculationSnapshot.totalBuyAmount",
  "CalculationSnapshot.totalSellAmount": "CalculationSnapshot.totalSellAmount",
  "LogisticsVehicle.vehicleNo": "LogisticsVehicle.vehicleNo",
} as const
