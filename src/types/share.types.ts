import type { Prisma } from '@prisma/client';

/** Share Version payload 검증 입력 */
export interface ShareVersionCalculationInputPayload {
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

export interface ShareVersionPayloadInput {
  snapshot?: Prisma.InputJsonValue | null;
  calculation?: ShareVersionCalculationInputPayload;
  changedBy?: string | null;
  changeReason?: string | null;
}

/** Share Version payload 검증 통과 출력 */
export interface ValidatedShareVersionCalculationInput {
  totalShare: Prisma.Decimal | number | string;
  netProfit: Prisma.Decimal | number | string;
  quantity?: Prisma.Decimal | number | string;
  totalBuyAmount?: Prisma.Decimal | number | string;
  totalSellAmount?: Prisma.Decimal | number | string;
  totalCost?: Prisma.Decimal | number | string;
  profitRate?: Prisma.Decimal | number | string | null;
  exchangeRateUsed?: Prisma.Decimal | number | string | null;
  snapshotData?: Prisma.InputJsonValue;
}

export interface ValidatedShareVersionPayloadInput {
  snapshot: Prisma.InputJsonValue;
  changedBy: string;
  changeReason: string;
  calculation: ValidatedShareVersionCalculationInput;
}

/** Share 생성 검증 입력 */
export interface CreateShareInputPayload {
  formulaId?: string;
  participantId?: string | null;
  shareType?: string | null;
  shareAmount?: Prisma.Decimal | number | string | null;
  shareRate?: Prisma.Decimal | number | string | null;
  version?: ShareVersionPayloadInput;
}

/** Share 생성 검증 통과 출력 */
export interface ValidatedCreateShareInput {
  formulaId: string;
  participantId: string;
  shareType: string;
  version: ValidatedShareVersionPayloadInput;
  shareAmount?: Prisma.Decimal | number | string;
  shareRate?: Prisma.Decimal | number | string;
}

/** Share 수정 검증 입력 */
export interface UpdateShareInputPayload {
  shareAmount?: Prisma.Decimal | number | string | null;
  shareRate?: Prisma.Decimal | number | string | null;
  shareType?: string | null;
  participantId?: string | null;
  version?: ShareVersionPayloadInput;
}

/** Share 수정 검증 통과 출력 */
export interface ValidatedUpdateShareInput {
  version: ValidatedShareVersionPayloadInput;
  shareAmount?: Prisma.Decimal | number | string;
  shareRate?: Prisma.Decimal | number | string;
  shareType?: string;
  participantId?: string;
}

/** Share 삭제 검증 입력 */
export interface DeleteShareInputPayload {
  version?: ShareVersionPayloadInput;
}

/** Share 삭제 검증 통과 출력 */
export interface ValidatedDeleteShareInput {
  version: ValidatedShareVersionPayloadInput;
}
