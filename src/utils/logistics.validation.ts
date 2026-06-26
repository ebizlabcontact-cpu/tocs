import { LogisticsCostType, TradeStatus } from '@prisma/client';

import type {
  CreateLogisticsInputPayload,
  LogisticsVersionCalculationInputPayload,
  LogisticsVersionPayloadInput,
  UpdateLogisticsStatusInputPayload,
  ValidatedCreateLogisticsInput,
  ValidatedLogisticsVersionCalculationInput,
  ValidatedLogisticsVersionPayloadInput,
  ValidatedUpdateLogisticsStatusInput,
} from '../types/logistics.types.js';

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

const PROFIT_RATE_MIN = -100;
const PROFIT_RATE_MAX = 100_000;

function assertRequiredId(value: string | undefined | null, field: string): string {
  if (value === undefined || value === null || value.trim() === '') {
    throw new ValidationError(`${field} is required`, field);
  }

  return value.trim();
}

function assertOptionalId(value: string | undefined | null, field: string): string | undefined {
  if (value === undefined || value === null || value.trim() === '') {
    return undefined;
  }

  return value.trim();
}

function assertRequiredString(value: string | null | undefined, field: string): string {
  if (value === undefined || value === null || value.trim() === '') {
    throw new ValidationError(`${field} is required`, field);
  }

  return value.trim();
}

function hasProvidedValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function parseNumeric(
  value: LogisticsVersionCalculationInputPayload[keyof LogisticsVersionCalculationInputPayload],
  field: string,
): number {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`${field} is required`, field);
  }

  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number(value.toString());

  if (!Number.isFinite(numeric)) {
    throw new ValidationError(`${field} must be a valid number`, field);
  }

  return numeric;
}

function parseOptionalNumeric(
  value: CreateLogisticsInputPayload['transportQuantity'],
  field: string,
): number | undefined {
  if (!hasProvidedValue(value)) {
    return undefined;
  }

  return parseNumeric(value, field);
}

function parseOptionalInteger(
  value: number | string | null | undefined,
  field: string,
): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const numeric = typeof value === 'number' ? value : Number(value);

  if (!Number.isInteger(numeric)) {
    throw new ValidationError(`${field} must be an integer`, field);
  }

  return numeric;
}

function assertNonNegative(value: number, field: string): void {
  if (value < 0) {
    throw new ValidationError(`${field} must be greater than or equal to 0`, field);
  }
}

function assertProfitRateRange(value: number, field: string): void {
  if (value < PROFIT_RATE_MIN || value > PROFIT_RATE_MAX) {
    throw new ValidationError(
      `${field} must be between ${PROFIT_RATE_MIN} and ${PROFIT_RATE_MAX}`,
      field,
    );
  }
}

function assertEnumValue<T extends string>(
  value: unknown,
  enumObject: Record<string, T>,
  field: string,
): T {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`${field} is required`, field);
  }

  const normalized = String(value);

  if (!Object.values(enumObject).includes(normalized as T)) {
    throw new ValidationError(`${field} must be a valid enum value`, field);
  }

  return normalized as T;
}

function assertOptionalEnumValue<T extends string>(
  value: unknown,
  enumObject: Record<string, T>,
  field: string,
): T | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const normalized = String(value);

  if (!Object.values(enumObject).includes(normalized as T)) {
    throw new ValidationError(`${field} must be a valid enum value`, field);
  }

  return normalized as T;
}

function parseOptionalDate(
  value: string | Date | null | undefined,
  field: string,
): Date | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new ValidationError(`${field} must be a valid date`, field);
    }

    return value;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  const parsed = new Date(typeof value === 'string' ? value.trim() : value);

  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`${field} must be a valid date`, field);
  }

  return parsed;
}

function validateLogisticsVersionCalculation(
  calculation: LogisticsVersionCalculationInputPayload | undefined,
): ValidatedLogisticsVersionCalculationInput {
  if (!calculation) {
    throw new ValidationError('calculation is required', 'version.calculation');
  }

  const quantity = parseNumeric(calculation.quantity, 'version.calculation.quantity');
  assertNonNegative(quantity, 'version.calculation.quantity');

  const totalBuyAmount = parseNumeric(
    calculation.totalBuyAmount,
    'version.calculation.totalBuyAmount',
  );
  assertNonNegative(totalBuyAmount, 'version.calculation.totalBuyAmount');

  const totalSellAmount = parseNumeric(
    calculation.totalSellAmount,
    'version.calculation.totalSellAmount',
  );
  assertNonNegative(totalSellAmount, 'version.calculation.totalSellAmount');

  const totalCost = parseNumeric(calculation.totalCost, 'version.calculation.totalCost');
  assertNonNegative(totalCost, 'version.calculation.totalCost');

  const totalShare = parseNumeric(calculation.totalShare, 'version.calculation.totalShare');
  assertNonNegative(totalShare, 'version.calculation.totalShare');

  parseNumeric(calculation.netProfit, 'version.calculation.netProfit');

  if (calculation.snapshotData === undefined || calculation.snapshotData === null) {
    throw new ValidationError('snapshotData is required', 'version.calculation.snapshotData');
  }

  const profitRateValue = parseOptionalNumeric(
    calculation.profitRate,
    'version.calculation.profitRate',
  );
  if (profitRateValue !== undefined) {
    assertProfitRateRange(profitRateValue, 'version.calculation.profitRate');
  }

  const validated: ValidatedLogisticsVersionCalculationInput = {
    quantity: calculation.quantity as ValidatedLogisticsVersionCalculationInput['quantity'],
    totalBuyAmount:
      calculation.totalBuyAmount as ValidatedLogisticsVersionCalculationInput['totalBuyAmount'],
    totalSellAmount:
      calculation.totalSellAmount as ValidatedLogisticsVersionCalculationInput['totalSellAmount'],
    totalCost: calculation.totalCost as ValidatedLogisticsVersionCalculationInput['totalCost'],
    totalShare: calculation.totalShare as ValidatedLogisticsVersionCalculationInput['totalShare'],
    netProfit: calculation.netProfit as ValidatedLogisticsVersionCalculationInput['netProfit'],
    snapshotData:
      calculation.snapshotData as ValidatedLogisticsVersionCalculationInput['snapshotData'],
  };

  if (calculation.profitRate !== undefined) {
    validated.profitRate = calculation.profitRate;
  }

  return validated;
}

function validateLogisticsVersionPayload(
  input: LogisticsVersionPayloadInput | undefined,
): ValidatedLogisticsVersionPayloadInput {
  if (!input) {
    throw new ValidationError('version is required', 'version');
  }

  if (input.snapshot === undefined || input.snapshot === null) {
    throw new ValidationError('snapshot is required', 'version.snapshot');
  }

  const changedBy = assertRequiredString(input.changedBy, 'version.changedBy');
  const changeReason = assertRequiredString(input.changeReason, 'version.changeReason');
  const calculation = validateLogisticsVersionCalculation(input.calculation);

  return {
    snapshot: input.snapshot,
    changedBy,
    changeReason,
    calculation,
  };
}

export function validateCreateLogistics(
  input: CreateLogisticsInputPayload,
): ValidatedCreateLogisticsInput {
  const formulaId = assertRequiredId(input.formulaId, 'formulaId');
  const carrierCompanyId = assertRequiredId(input.carrierCompanyId, 'carrierCompanyId');

  const totalLogisticsCostValue = parseNumeric(input.totalLogisticsCost, 'totalLogisticsCost');
  assertNonNegative(totalLogisticsCostValue, 'totalLogisticsCost');

  const costType = assertOptionalEnumValue(input.costType, LogisticsCostType, 'costType');

  const validated: ValidatedCreateLogisticsInput = {
    formulaId,
    carrierCompanyId,
    totalLogisticsCost: input.totalLogisticsCost as NonNullable<
      ValidatedCreateLogisticsInput['totalLogisticsCost']
    >,
    version: validateLogisticsVersionPayload(input.version),
  };

  const departureCompanyId = assertOptionalId(input.departureCompanyId, 'departureCompanyId');
  if (departureCompanyId !== undefined) {
    validated.departureCompanyId = departureCompanyId;
  }

  const arrivalCompanyId = assertOptionalId(input.arrivalCompanyId, 'arrivalCompanyId');
  if (arrivalCompanyId !== undefined) {
    validated.arrivalCompanyId = arrivalCompanyId;
  }

  const costBearerCompanyId = assertOptionalId(input.costBearerCompanyId, 'costBearerCompanyId');
  if (costBearerCompanyId !== undefined) {
    validated.costBearerCompanyId = costBearerCompanyId;
  }

  if (costType !== undefined) {
    validated.costType = costType;
  }

  if (input.departureLocation !== undefined) {
    validated.departureLocation = input.departureLocation;
  }

  if (input.arrivalLocation !== undefined) {
    validated.arrivalLocation = input.arrivalLocation;
  }

  if (input.itemDescription !== undefined) {
    validated.itemDescription = input.itemDescription;
  }

  if (hasProvidedValue(input.transportQuantity)) {
    const transportQuantityValue = parseNumeric(input.transportQuantity, 'transportQuantity');
    assertNonNegative(transportQuantityValue, 'transportQuantity');
    validated.transportQuantity = input.transportQuantity as NonNullable<
      ValidatedCreateLogisticsInput['transportQuantity']
    >;
  }

  const vehicleCount = parseOptionalInteger(input.vehicleCount, 'vehicleCount');
  if (vehicleCount !== undefined) {
    assertNonNegative(vehicleCount, 'vehicleCount');
    validated.vehicleCount = vehicleCount;
  }

  const scheduledDate = parseOptionalDate(input.scheduledDate, 'scheduledDate');
  if (scheduledDate !== undefined) {
    validated.scheduledDate = scheduledDate;
  }

  if (input.memo !== undefined) {
    validated.memo = input.memo;
  }

  return validated;
}

export function validateUpdateLogisticsStatus(
  input: UpdateLogisticsStatusInputPayload,
): ValidatedUpdateLogisticsStatusInput {
  const formulaId = assertRequiredId(input.formulaId, 'formulaId');
  const status = assertEnumValue(input.status, TradeStatus, 'status');
  const changedBy = assertRequiredString(input.changedBy, 'changedBy');
  const changeReason = assertRequiredString(input.changeReason, 'changeReason');

  return {
    formulaId,
    status,
    changedBy,
    changeReason,
  };
}
