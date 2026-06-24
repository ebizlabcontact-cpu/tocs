import type { Prisma } from '@prisma/client';

/** Version 생성 검증 입력 (필드 누락 허용) */
export interface CreateVersionCalculationInputPayload {
  quantity?: Prisma.Decimal | number | string | null;
  totalBuyAmount?: Prisma.Decimal | number | string | null;
  totalSellAmount?: Prisma.Decimal | number | string | null;
  totalCost?: Prisma.Decimal | number | string | null;
  totalShare?: Prisma.Decimal | number | string | null;
  netProfit?: Prisma.Decimal | number | string | null;
  profitRate?: Prisma.Decimal | number | string | null;
  exchangeRateUsed?: Prisma.Decimal | number | string | null;
  snapshotData?: Prisma.InputJsonValue | null;
}

export interface CreateVersionInputPayload {
  formulaId?: string;
  changedBy?: string | null;
  changeReason?: string | null;
  snapshot?: Prisma.InputJsonValue;
  calculation?: CreateVersionCalculationInputPayload;
}

/** 검증 통과 후 Service/Action에 전달 가능한 Version 생성 입력 */
export interface ValidatedCreateVersionCalculationInput {
  quantity: Prisma.Decimal | number | string;
  totalBuyAmount: Prisma.Decimal | number | string;
  totalSellAmount: Prisma.Decimal | number | string;
  totalCost: Prisma.Decimal | number | string;
  totalShare: Prisma.Decimal | number | string;
  netProfit: Prisma.Decimal | number | string;
  snapshotData: Prisma.InputJsonValue;
  profitRate?: Prisma.Decimal | number | string | null;
  exchangeRateUsed?: Prisma.Decimal | number | string | null;
}

export interface ValidatedCreateVersionInput {
  formulaId: string;
  changedBy: string;
  changeReason: string;
  calculation: ValidatedCreateVersionCalculationInput;
  snapshot?: Prisma.InputJsonValue;
}
