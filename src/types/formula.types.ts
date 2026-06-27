import type { Prisma, TradeType } from '@prisma/client';

/** Formula 생성 검증 입력 (필드 누락 허용) */
export interface CreateFormulaInputPayload {
  tradeType?: TradeType;
  itemId?: string;
  quantity?: Prisma.Decimal | number | string | null;
  unit?: string | null;
  baseCurrency?: string;
  foreignCurrency?: string | null;
  departureCountry?: string | null;
  arrivalCountry?: string | null;
  contractExchangeRate?: Prisma.Decimal | number | string | null;
  adjustedExchangeRate?: Prisma.Decimal | number | string | null;
  exchangeRateChangeReason?: string | null;
  content?: string | null;
  note?: string | null;
  createdBy?: string | null;
}

/** 검증 통과 후 Service/Repository에 전달 가능한 Formula 생성 입력 */
export interface CreateFormulaInput {
  tradeType: TradeType;
  itemId: string;
  quantity: Prisma.Decimal | number | string;
  unit?: string | null;
  baseCurrency: string;
  foreignCurrency?: string | null;
  departureCountry?: string | null;
  arrivalCountry?: string | null;
  contractExchangeRate?: Prisma.Decimal | number | string | null;
  adjustedExchangeRate?: Prisma.Decimal | number | string | null;
  exchangeRateChangeReason?: string | null;
  content?: string | null;
  note?: string | null;
  createdBy?: string | null;
}

export const DEFAULT_BASE_CURRENCY = 'KRW';

/** Formula PATCH 검증 입력 */
export interface PatchFormulaInputPayload {
  formulaId?: string | null;
  content?: string | null;
  note?: string | null;
  unit?: string | null;
}

/** Formula PATCH 검증 통과 출력 */
export interface ValidatedPatchFormulaInput {
  formulaId: string;
  content?: string | null;
  note?: string | null;
  unit?: string | null;
}

/** Formula Cancel 검증 입력 */
export interface CancelFormulaInputPayload {
  formulaId?: string | null;
  cancelReason?: string | null;
  changedBy?: string | null;
}

/** Formula Cancel 검증 통과 출력 */
export interface ValidatedCancelFormulaInput {
  formulaId: string;
  cancelReason: string;
  changedBy: string;
}
