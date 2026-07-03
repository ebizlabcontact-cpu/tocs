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
} from "./types"

/* -------------------------------------------------------------------------- */
/* Prisma enum string unions (mirror schema.prisma exactly)                    */
/* -------------------------------------------------------------------------- */

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
/* Field-name mapping reference (documentation, not executable)                */
/* -------------------------------------------------------------------------- */

/**
 * Canonical field-name mapping between UI-facing types and Prisma/canonical
 * fields (P0-5). Kept as data so it can be referenced/tested. This resolves the
 * previously ambiguous duplicate names.
 *
 *   UI (frontend type.field)          →  Prisma model.field
 *   Formula.number                    →  Formula.formulaNo
 *   Formula.version                   →  (UI current-version counter; the row is
 *                                         FormulaVersion.versionNo)
 *   VersionEntry.versionNo            →  FormulaVersion.versionNo
 *   PaymentScheduleItem.scheduledDate →  PaymentSchedule.scheduledDate  (was dueDate)
 *   PaymentRecord.paidDate            →  PaymentRecord.actualDate
 *   CalculationSnapshot.netProfit     →  CalculationSnapshot.netProfit  (was expectedProfit)
 *   CalculationSnapshot.totalBuyAmount→  CalculationSnapshot.totalBuyAmount (was totalBuy)
 *   CalculationSnapshot.totalSellAmount→ CalculationSnapshot.totalSellAmount (was totalSell)
 *   LogisticsVehicle.vehicleNo        →  LogisticsVehicle.vehicleNo (was vehicleIdentifier)
 */
export const FIELD_NAME_MAP = {
  "Formula.number": "Formula.formulaNo",
  "VersionEntry.versionNo": "FormulaVersion.versionNo",
  "PaymentScheduleItem.scheduledDate": "PaymentSchedule.scheduledDate",
  "PaymentRecord.paidDate": "PaymentRecord.actualDate",
  "CalculationSnapshot.netProfit": "CalculationSnapshot.netProfit",
  "CalculationSnapshot.totalBuyAmount": "CalculationSnapshot.totalBuyAmount",
  "CalculationSnapshot.totalSellAmount": "CalculationSnapshot.totalSellAmount",
  "LogisticsVehicle.vehicleNo": "LogisticsVehicle.vehicleNo",
} as const
