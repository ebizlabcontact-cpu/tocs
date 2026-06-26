import { NatureGroup, PaymentGroup, RoleGroup } from '@prisma/client';

import type {
  CreateParticipantInputPayload,
  ParticipantVersionCalculationInputPayload,
  ParticipantVersionPayloadInput,
  ValidatedCreateParticipantInput,
  ValidatedParticipantVersionCalculationInput,
  ValidatedParticipantVersionPayloadInput,
} from '../types/participant.types.js';

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
  value: ParticipantVersionCalculationInputPayload[keyof ParticipantVersionCalculationInputPayload],
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
  value: CreateParticipantInputPayload['buyUnitPrice'],
  field: string,
): number | undefined {
  if (!hasProvidedValue(value)) {
    return undefined;
  }

  return parseNumeric(value, field);
}

function parseRequiredInteger(
  value: number | string | null | undefined,
  field: string,
): number {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`${field} is required`, field);
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

function assertMinimum(value: number, minimum: number, field: string): void {
  if (value < minimum) {
    throw new ValidationError(`${field} must be greater than or equal to ${minimum}`, field);
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

function parseOptionalBoolean(
  value: boolean | string | null | undefined,
  field: string,
): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (value === '') {
    throw new ValidationError(`${field} must be a boolean`, field);
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw new ValidationError(`${field} must be a boolean`, field);
}

function validateParticipantVersionCalculation(
  calculation: ParticipantVersionCalculationInputPayload | undefined,
): ValidatedParticipantVersionCalculationInput {
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

  const validated: ValidatedParticipantVersionCalculationInput = {
    quantity: calculation.quantity as ValidatedParticipantVersionCalculationInput['quantity'],
    totalBuyAmount:
      calculation.totalBuyAmount as ValidatedParticipantVersionCalculationInput['totalBuyAmount'],
    totalSellAmount:
      calculation.totalSellAmount as ValidatedParticipantVersionCalculationInput['totalSellAmount'],
    totalCost: calculation.totalCost as ValidatedParticipantVersionCalculationInput['totalCost'],
    totalShare: calculation.totalShare as ValidatedParticipantVersionCalculationInput['totalShare'],
    netProfit: calculation.netProfit as ValidatedParticipantVersionCalculationInput['netProfit'],
    snapshotData:
      calculation.snapshotData as ValidatedParticipantVersionCalculationInput['snapshotData'],
  };

  if (calculation.profitRate !== undefined) {
    validated.profitRate = calculation.profitRate;
  }

  return validated;
}

function validateParticipantVersionPayload(
  input: ParticipantVersionPayloadInput | undefined,
): ValidatedParticipantVersionPayloadInput {
  if (!input) {
    throw new ValidationError('version is required', 'version');
  }

  if (input.snapshot === undefined || input.snapshot === null) {
    throw new ValidationError('snapshot is required', 'version.snapshot');
  }

  const changedBy = assertRequiredString(input.changedBy, 'version.changedBy');
  const changeReason = assertRequiredString(input.changeReason, 'version.changeReason');
  const calculation = validateParticipantVersionCalculation(input.calculation);

  return {
    snapshot: input.snapshot,
    changedBy,
    changeReason,
    calculation,
  };
}

export function validateCreateParticipant(
  input: CreateParticipantInputPayload,
): ValidatedCreateParticipantInput {
  const formulaId = assertRequiredId(input.formulaId, 'formulaId');
  const companyId = assertRequiredId(input.companyId, 'companyId');

  const sequenceOrder = parseRequiredInteger(input.sequenceOrder, 'sequenceOrder');
  assertMinimum(sequenceOrder, 1, 'sequenceOrder');

  const roleGroup = assertEnumValue(input.roleGroup, RoleGroup, 'roleGroup');
  const natureGroup = assertOptionalEnumValue(input.natureGroup, NatureGroup, 'natureGroup');
  const paymentGroup = assertOptionalEnumValue(input.paymentGroup, PaymentGroup, 'paymentGroup');

  const validated: ValidatedCreateParticipantInput = {
    formulaId,
    companyId,
    sequenceOrder,
    roleGroup,
    version: validateParticipantVersionPayload(input.version),
  };

  if (hasProvidedValue(input.buyUnitPrice)) {
    const buyUnitPriceValue = parseNumeric(input.buyUnitPrice, 'buyUnitPrice');
    assertNonNegative(buyUnitPriceValue, 'buyUnitPrice');
    validated.buyUnitPrice = input.buyUnitPrice as NonNullable<
      ValidatedCreateParticipantInput['buyUnitPrice']
    >;
  }

  if (hasProvidedValue(input.sellUnitPrice)) {
    const sellUnitPriceValue = parseNumeric(input.sellUnitPrice, 'sellUnitPrice');
    assertNonNegative(sellUnitPriceValue, 'sellUnitPrice');
    validated.sellUnitPrice = input.sellUnitPrice as NonNullable<
      ValidatedCreateParticipantInput['sellUnitPrice']
    >;
  }

  if (hasProvidedValue(input.quantity)) {
    const quantityValue = parseNumeric(input.quantity, 'quantity');
    assertNonNegative(quantityValue, 'quantity');
    validated.quantity = input.quantity as NonNullable<ValidatedCreateParticipantInput['quantity']>;
  }

  if (hasProvidedValue(input.directCostAmount)) {
    const directCostAmountValue = parseNumeric(input.directCostAmount, 'directCostAmount');
    assertNonNegative(directCostAmountValue, 'directCostAmount');
    validated.directCostAmount = input.directCostAmount as NonNullable<
      ValidatedCreateParticipantInput['directCostAmount']
    >;
  }

  const isStartPoint = parseOptionalBoolean(input.isStartPoint, 'isStartPoint');
  if (isStartPoint !== undefined) {
    validated.isStartPoint = isStartPoint;
  }

  const isEndPoint = parseOptionalBoolean(input.isEndPoint, 'isEndPoint');
  if (isEndPoint !== undefined) {
    validated.isEndPoint = isEndPoint;
  }

  if (input.memo !== undefined) {
    validated.memo = input.memo;
  }

  if (natureGroup !== undefined) {
    validated.natureGroup = natureGroup;
  }

  if (paymentGroup !== undefined) {
    validated.paymentGroup = paymentGroup;
  }

  return validated;
}
