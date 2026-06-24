import type {
  CreateVersionCalculationInputPayload,
  CreateVersionInputPayload,
  ValidatedCreateVersionCalculationInput,
  ValidatedCreateVersionInput,
} from '../types/version.types.js';

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
  if (!value || value.trim() === '') {
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

function parseNumeric(
  value: CreateVersionCalculationInputPayload[keyof CreateVersionCalculationInputPayload],
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

function assertNonNegative(value: number, field: string): void {
  if (value < 0) {
    throw new ValidationError(`${field} must be greater than or equal to 0`, field);
  }
}

function parseOptionalNumeric(
  value: CreateVersionCalculationInputPayload['profitRate'],
  field: string,
): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  return parseNumeric(value, field);
}

function assertProfitRateRange(value: number, field: string): void {
  if (value < PROFIT_RATE_MIN || value > PROFIT_RATE_MAX) {
    throw new ValidationError(
      `${field} must be between ${PROFIT_RATE_MIN} and ${PROFIT_RATE_MAX}`,
      field,
    );
  }
}

function assertSnapshotDataRequired(
  value: CreateVersionCalculationInputPayload['snapshotData'],
  field: string,
): void {
  if (value === undefined || value === null) {
    throw new ValidationError(`${field} is required`, field);
  }
}

function validateCalculation(
  calculation: CreateVersionCalculationInputPayload | undefined,
): ValidatedCreateVersionCalculationInput {
  if (!calculation) {
    throw new ValidationError('calculation is required', 'calculation');
  }

  const quantity = parseNumeric(calculation.quantity, 'calculation.quantity');
  assertNonNegative(quantity, 'calculation.quantity');

  const totalBuyAmount = parseNumeric(calculation.totalBuyAmount, 'calculation.totalBuyAmount');
  assertNonNegative(totalBuyAmount, 'calculation.totalBuyAmount');

  const totalSellAmount = parseNumeric(calculation.totalSellAmount, 'calculation.totalSellAmount');
  assertNonNegative(totalSellAmount, 'calculation.totalSellAmount');

  const totalCost = parseNumeric(calculation.totalCost, 'calculation.totalCost');
  assertNonNegative(totalCost, 'calculation.totalCost');

  const totalShare = parseNumeric(calculation.totalShare, 'calculation.totalShare');
  assertNonNegative(totalShare, 'calculation.totalShare');

  parseNumeric(calculation.netProfit, 'calculation.netProfit');

  assertSnapshotDataRequired(calculation.snapshotData, 'calculation.snapshotData');

  const profitRateValue = parseOptionalNumeric(
    calculation.profitRate,
    'calculation.profitRate',
  );
  if (profitRateValue !== undefined) {
    assertProfitRateRange(profitRateValue, 'calculation.profitRate');
  }

  const validated: ValidatedCreateVersionCalculationInput = {
    quantity: calculation.quantity as ValidatedCreateVersionCalculationInput['quantity'],
    totalBuyAmount:
      calculation.totalBuyAmount as ValidatedCreateVersionCalculationInput['totalBuyAmount'],
    totalSellAmount:
      calculation.totalSellAmount as ValidatedCreateVersionCalculationInput['totalSellAmount'],
    totalCost: calculation.totalCost as ValidatedCreateVersionCalculationInput['totalCost'],
    totalShare: calculation.totalShare as ValidatedCreateVersionCalculationInput['totalShare'],
    netProfit: calculation.netProfit as ValidatedCreateVersionCalculationInput['netProfit'],
    snapshotData: calculation.snapshotData as ValidatedCreateVersionCalculationInput['snapshotData'],
  };

  if (calculation.profitRate !== undefined) {
    validated.profitRate = calculation.profitRate;
  }
  if (calculation.exchangeRateUsed !== undefined) {
    validated.exchangeRateUsed = calculation.exchangeRateUsed;
  }

  return validated;
}

export function validateCreateVersion(
  input: CreateVersionInputPayload,
): ValidatedCreateVersionInput {
  const formulaId = assertRequiredId(input.formulaId, 'formulaId');
  const changedBy = assertRequiredString(input.changedBy, 'changedBy');
  const changeReason = assertRequiredString(input.changeReason, 'changeReason');
  const calculation = validateCalculation(input.calculation);

  const validated: ValidatedCreateVersionInput = {
    formulaId,
    changedBy,
    changeReason,
    calculation,
  };

  if (input.snapshot !== undefined) {
    validated.snapshot = input.snapshot;
  }

  return validated;
}
