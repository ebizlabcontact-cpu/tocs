import type { LogisticsCostType, Prisma, TradeStatus } from '@prisma/client';

/** Logistics Version calculation 검증 입력 */
export interface LogisticsVersionCalculationInputPayload {
  quantity?: Prisma.Decimal | number | string | null;
  totalBuyAmount?: Prisma.Decimal | number | string | null;
  totalSellAmount?: Prisma.Decimal | number | string | null;
  totalCost?: Prisma.Decimal | number | string | null;
  totalShare?: Prisma.Decimal | number | string | null;
  netProfit?: Prisma.Decimal | number | string | null;
  profitRate?: Prisma.Decimal | number | string | null;
  snapshotData?: Prisma.InputJsonValue | null;
}

/** Logistics Version payload 검증 입력 */
export interface LogisticsVersionPayloadInput {
  snapshot?: Prisma.InputJsonValue | null;
  calculation?: LogisticsVersionCalculationInputPayload;
  changedBy?: string | null;
  changeReason?: string | null;
}

/** Logistics Version calculation 검증 통과 출력 */
export interface ValidatedLogisticsVersionCalculationInput {
  quantity: Prisma.Decimal | number | string;
  totalBuyAmount: Prisma.Decimal | number | string;
  totalSellAmount: Prisma.Decimal | number | string;
  totalCost: Prisma.Decimal | number | string;
  totalShare: Prisma.Decimal | number | string;
  netProfit: Prisma.Decimal | number | string;
  snapshotData: Prisma.InputJsonValue;
  profitRate?: Prisma.Decimal | number | string | null;
}

/** Logistics Version payload 검증 통과 출력 */
export interface ValidatedLogisticsVersionPayloadInput {
  snapshot: Prisma.InputJsonValue;
  changedBy: string;
  changeReason: string;
  calculation: ValidatedLogisticsVersionCalculationInput;
}

/** Logistics 생성 검증 입력 */
export interface CreateLogisticsInputPayload {
  formulaId?: string | null;
  carrierCompanyId?: string | null;
  departureCompanyId?: string | null;
  arrivalCompanyId?: string | null;
  costBearerCompanyId?: string | null;
  costType?: LogisticsCostType | string | null;
  departureLocation?: string | null;
  arrivalLocation?: string | null;
  itemDescription?: string | null;
  transportQuantity?: Prisma.Decimal | number | string | null;
  vehicleCount?: number | string | null;
  totalLogisticsCost?: Prisma.Decimal | number | string | null;
  scheduledDate?: string | Date | null;
  memo?: string | null;
  version?: LogisticsVersionPayloadInput;
}

/** Logistics 생성 검증 통과 출력 */
export interface ValidatedCreateLogisticsInput {
  formulaId: string;
  carrierCompanyId: string;
  totalLogisticsCost: Prisma.Decimal | number | string;
  version: ValidatedLogisticsVersionPayloadInput;
  departureCompanyId?: string;
  arrivalCompanyId?: string;
  costBearerCompanyId?: string;
  costType?: LogisticsCostType;
  departureLocation?: string | null;
  arrivalLocation?: string | null;
  itemDescription?: string | null;
  transportQuantity?: Prisma.Decimal | number | string;
  vehicleCount?: number;
  scheduledDate?: Date;
  memo?: string | null;
}

/** Logistics status 변경 검증 입력 */
export interface UpdateLogisticsStatusInputPayload {
  formulaId?: string | null;
  status?: TradeStatus | string | null;
  changedBy?: string | null;
  changeReason?: string | null;
}

/** Logistics status 변경 검증 통과 출력 */
export interface ValidatedUpdateLogisticsStatusInput {
  formulaId: string;
  status: TradeStatus;
  changedBy: string;
  changeReason: string;
}
