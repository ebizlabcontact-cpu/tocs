import type {
  CreateShareInputPayload,
  DeleteShareInputPayload,
  ShareVersionCalculationInputPayload,
  ShareVersionPayloadInput,
  UpdateShareInputPayload,
  ValidatedCreateShareInput,
  ValidatedDeleteShareInput,
  ValidatedShareVersionCalculationInput,
  ValidatedShareVersionPayloadInput,
  ValidatedUpdateShareInput,
} from '../types/share.types.js';

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

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

function hasProvidedValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function parseNumeric(
  value: ShareVersionCalculationInputPayload[keyof ShareVersionCalculationInputPayload],
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
  value: CreateShareInputPayload['shareAmount'],
  field: string,
): number | undefined {
  if (!hasProvidedValue(value)) {
    return undefined;
  }

  return parseNumeric(value, field);
}

function assertNonNegative(value: number, field: string): void {
  if (value < 0) {
    throw new ValidationError(`${field} must be greater than or equal to 0`, field);
  }
}

function assertAtLeastOneShareValue(
  shareAmount: CreateShareInputPayload['shareAmount'],
  shareRate: CreateShareInputPayload['shareRate'],
  field = 'shareAmount',
): void {
  if (!hasProvidedValue(shareAmount) && !hasProvidedValue(shareRate)) {
    throw new ValidationError('Either shareAmount or shareRate is required', field);
  }
}

function validateOptionalShareAmountOrRate(
  shareAmount: CreateShareInputPayload['shareAmount'],
  shareRate: CreateShareInputPayload['shareRate'],
): Pick<ValidatedCreateShareInput, 'shareAmount' | 'shareRate'> {
  const amountValue = parseOptionalNumeric(shareAmount, 'shareAmount');
  if (amountValue !== undefined) {
    assertNonNegative(amountValue, 'shareAmount');
  }

  const rateValue = parseOptionalNumeric(shareRate, 'shareRate');
  if (rateValue !== undefined) {
    assertNonNegative(rateValue, 'shareRate');
  }

  const validated: Pick<ValidatedCreateShareInput, 'shareAmount' | 'shareRate'> = {};

  if (hasProvidedValue(shareAmount)) {
    validated.shareAmount = shareAmount as NonNullable<ValidatedCreateShareInput['shareAmount']>;
  }
  if (hasProvidedValue(shareRate)) {
    validated.shareRate = shareRate as NonNullable<ValidatedCreateShareInput['shareRate']>;
  }

  return validated;
}

function validateShareVersionCalculation(
  calculation: ShareVersionCalculationInputPayload | undefined,
): ValidatedShareVersionCalculationInput {
  if (!calculation) {
    throw new ValidationError('calculation is required', 'version.calculation');
  }

  const totalShareValue = parseNumeric(calculation.totalShare, 'version.calculation.totalShare');
  assertNonNegative(totalShareValue, 'version.calculation.totalShare');

  parseNumeric(calculation.netProfit, 'version.calculation.netProfit');

  const validated: ValidatedShareVersionCalculationInput = {
    totalShare: calculation.totalShare as ValidatedShareVersionCalculationInput['totalShare'],
    netProfit: calculation.netProfit as ValidatedShareVersionCalculationInput['netProfit'],
  };

  if (hasProvidedValue(calculation.quantity)) {
    validated.quantity = calculation.quantity as NonNullable<
      ValidatedShareVersionCalculationInput['quantity']
    >;
  }
  if (hasProvidedValue(calculation.totalBuyAmount)) {
    validated.totalBuyAmount = calculation.totalBuyAmount as NonNullable<
      ValidatedShareVersionCalculationInput['totalBuyAmount']
    >;
  }
  if (hasProvidedValue(calculation.totalSellAmount)) {
    validated.totalSellAmount = calculation.totalSellAmount as NonNullable<
      ValidatedShareVersionCalculationInput['totalSellAmount']
    >;
  }
  if (hasProvidedValue(calculation.totalCost)) {
    validated.totalCost = calculation.totalCost as NonNullable<
      ValidatedShareVersionCalculationInput['totalCost']
    >;
  }
  if (calculation.profitRate !== undefined) {
    validated.profitRate = calculation.profitRate;
  }
  if (calculation.exchangeRateUsed !== undefined) {
    validated.exchangeRateUsed = calculation.exchangeRateUsed;
  }
  if (calculation.snapshotData !== undefined && calculation.snapshotData !== null) {
    validated.snapshotData = calculation.snapshotData;
  }

  return validated;
}

export function validateShareVersionPayload(
  input: ShareVersionPayloadInput | undefined,
): ValidatedShareVersionPayloadInput {
  if (!input) {
    throw new ValidationError('version is required', 'version');
  }

  if (input.snapshot === undefined || input.snapshot === null) {
    throw new ValidationError('snapshot is required', 'version.snapshot');
  }

  const changedBy = assertRequiredString(input.changedBy, 'version.changedBy');
  const changeReason = assertRequiredString(input.changeReason, 'version.changeReason');
  const calculation = validateShareVersionCalculation(input.calculation);

  return {
    snapshot: input.snapshot,
    changedBy,
    changeReason,
    calculation,
  };
}

export function validateCreateShare(input: CreateShareInputPayload): ValidatedCreateShareInput {
  const formulaId = assertRequiredId(input.formulaId, 'formulaId');
  const participantId = assertRequiredId(input.participantId, 'participantId');
  const shareType = assertRequiredString(input.shareType, 'shareType');

  assertAtLeastOneShareValue(input.shareAmount, input.shareRate);
  const shareValues = validateOptionalShareAmountOrRate(input.shareAmount, input.shareRate);
  const version = validateShareVersionPayload(input.version);

  return {
    formulaId,
    participantId,
    shareType,
    version,
    ...shareValues,
  };
}

export function validateUpdateShare(input: UpdateShareInputPayload): ValidatedUpdateShareInput {
  assertAtLeastOneShareValue(input.shareAmount, input.shareRate);
  const shareValues = validateOptionalShareAmountOrRate(input.shareAmount, input.shareRate);
  const version = validateShareVersionPayload(input.version);

  const validated: ValidatedUpdateShareInput = {
    version,
    ...shareValues,
  };

  if (input.shareType !== undefined && input.shareType !== null) {
    validated.shareType = assertRequiredString(input.shareType, 'shareType');
  }
  if (input.participantId !== undefined && input.participantId !== null) {
    validated.participantId = assertRequiredId(input.participantId, 'participantId');
  }

  return validated;
}

export function validateDeleteShare(input: DeleteShareInputPayload): ValidatedDeleteShareInput {
  const version = validateShareVersionPayload(input.version);

  return { version };
}
