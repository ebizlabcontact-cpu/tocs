import type { NatureGroup, PaymentGroup, Prisma, RoleGroup } from '@prisma/client';

/** Participant Version calculation 검증 입력 */
export interface ParticipantVersionCalculationInputPayload {
  quantity?: Prisma.Decimal | number | string | null;
  totalBuyAmount?: Prisma.Decimal | number | string | null;
  totalSellAmount?: Prisma.Decimal | number | string | null;
  totalCost?: Prisma.Decimal | number | string | null;
  totalShare?: Prisma.Decimal | number | string | null;
  netProfit?: Prisma.Decimal | number | string | null;
  profitRate?: Prisma.Decimal | number | string | null;
  snapshotData?: Prisma.InputJsonValue | null;
}

/** Participant Version payload 검증 입력 */
export interface ParticipantVersionPayloadInput {
  snapshot?: Prisma.InputJsonValue | null;
  calculation?: ParticipantVersionCalculationInputPayload;
  changedBy?: string | null;
  changeReason?: string | null;
}

/** Participant Version calculation 검증 통과 출력 */
export interface ValidatedParticipantVersionCalculationInput {
  quantity: Prisma.Decimal | number | string;
  totalBuyAmount: Prisma.Decimal | number | string;
  totalSellAmount: Prisma.Decimal | number | string;
  totalCost: Prisma.Decimal | number | string;
  totalShare: Prisma.Decimal | number | string;
  netProfit: Prisma.Decimal | number | string;
  snapshotData: Prisma.InputJsonValue;
  profitRate?: Prisma.Decimal | number | string | null;
}

/** Participant Version payload 검증 통과 출력 */
export interface ValidatedParticipantVersionPayloadInput {
  snapshot: Prisma.InputJsonValue;
  changedBy: string;
  changeReason: string;
  calculation: ValidatedParticipantVersionCalculationInput;
}

/** Participant 생성 검증 입력 */
export interface CreateParticipantInputPayload {
  formulaId?: string | null;
  companyId?: string | null;
  sequenceOrder?: number | string | null;
  roleGroup?: RoleGroup | string | null;
  natureGroup?: NatureGroup | string | null;
  paymentGroup?: PaymentGroup | string | null;
  buyUnitPrice?: Prisma.Decimal | number | string | null;
  sellUnitPrice?: Prisma.Decimal | number | string | null;
  quantity?: Prisma.Decimal | number | string | null;
  directCostAmount?: Prisma.Decimal | number | string | null;
  isStartPoint?: boolean | string | null;
  isEndPoint?: boolean | string | null;
  memo?: string | null;
  version?: ParticipantVersionPayloadInput;
}

/** Participant 생성 검증 통과 출력 */
export interface ValidatedCreateParticipantInput {
  formulaId: string;
  companyId: string;
  sequenceOrder: number;
  roleGroup: RoleGroup;
  version: ValidatedParticipantVersionPayloadInput;
  natureGroup?: NatureGroup;
  paymentGroup?: PaymentGroup;
  buyUnitPrice?: Prisma.Decimal | number | string;
  sellUnitPrice?: Prisma.Decimal | number | string;
  quantity?: Prisma.Decimal | number | string;
  directCostAmount?: Prisma.Decimal | number | string;
  isStartPoint?: boolean;
  isEndPoint?: boolean;
  memo?: string | null;
}
