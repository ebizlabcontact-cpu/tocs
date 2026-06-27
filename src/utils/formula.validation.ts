import { TradeType } from '@prisma/client';

import type {
  CancelFormulaInputPayload,
  CreateFormulaInput,
  CreateFormulaInputPayload,
  PatchFormulaInputPayload,
  ValidatedCancelFormulaInput,
  ValidatedPatchFormulaInput,
} from '../types/formula.types.js';
import { DEFAULT_BASE_CURRENCY } from '../types/formula.types.js';

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

const PATCH_ALLOWED_KEYS = new Set(['formulaId', 'content', 'note', 'unit']);
const CANCEL_ALLOWED_KEYS = new Set(['formulaId', 'cancelReason', 'changedBy']);
const MAX_UNIT_LENGTH = 50;

function assertRequiredId(value: string | undefined | null, field: string): string {
  if (value === undefined || value === null || value.trim() === '') {
    throw new ValidationError(`${field} is required`, field);
  }

  return value.trim();
}

function assertPatchAllowedKeys(input: PatchFormulaInputPayload): void {
  for (const key of Object.keys(input)) {
    if (!PATCH_ALLOWED_KEYS.has(key)) {
      throw new ValidationError(`${key} is not allowed in patch request`, key);
    }
  }
}

function assertCancelAllowedKeys(input: CancelFormulaInputPayload): void {
  for (const key of Object.keys(input)) {
    if (!CANCEL_ALLOWED_KEYS.has(key)) {
      throw new ValidationError(`${key} is not allowed in cancel request`, key);
    }
  }
}

function assertRequiredNonEmptyString(value: unknown, field: string): string {
  if (value === undefined || value === null) {
    throw new ValidationError(`${field} is required`, field);
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be a string`, field);
  }

  const trimmed = value.trim();

  if (trimmed === '') {
    throw new ValidationError(`${field} must not be empty`, field);
  }

  return trimmed;
}

function assertOptionalNullableString(
  value: unknown,
  field: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${field} must be a string or null`, field);
  }

  return value;
}

function assertOptionalUnit(value: unknown, field: string): string | null | undefined {
  const parsed = assertOptionalNullableString(value, field);

  if (parsed !== undefined && parsed !== null && parsed.length > MAX_UNIT_LENGTH) {
    throw new ValidationError(
      `${field} must be at most ${MAX_UNIT_LENGTH} characters`,
      field,
    );
  }

  return parsed;
}

function isPresent(value: string | null | undefined): value is string {
  return value !== undefined && value !== null && value.trim() !== '';
}

function hasExchangeRate(
  value: CreateFormulaInputPayload['contractExchangeRate'],
): boolean {
  return value !== undefined && value !== null && value !== '';
}

function parseQuantity(value: CreateFormulaInputPayload['quantity']): number {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError('quantity is required', 'quantity');
  }

  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number(value.toString());

  if (!Number.isFinite(numeric)) {
    throw new ValidationError('quantity must be a valid number', 'quantity');
  }

  return numeric;
}

function assertDomesticConstraints(input: CreateFormulaInputPayload, tradeType: TradeType): void {
  if (tradeType !== TradeType.DOMESTIC) {
    return;
  }

  if (isPresent(input.foreignCurrency)) {
    throw new ValidationError(
      'foreignCurrency is not allowed for DOMESTIC trade',
      'foreignCurrency',
    );
  }

  if (hasExchangeRate(input.contractExchangeRate)) {
    throw new ValidationError(
      'contractExchangeRate is not allowed for DOMESTIC trade',
      'contractExchangeRate',
    );
  }

  if (hasExchangeRate(input.adjustedExchangeRate)) {
    throw new ValidationError(
      'adjustedExchangeRate is not allowed for DOMESTIC trade',
      'adjustedExchangeRate',
    );
  }
}

export function validateCreateFormula(input: CreateFormulaInputPayload): CreateFormulaInput {
  if (input.tradeType === undefined || input.tradeType === null) {
    throw new ValidationError('tradeType is required', 'tradeType');
  }

  if (!input.itemId || input.itemId.trim() === '') {
    throw new ValidationError('itemId is required', 'itemId');
  }

  const quantityValue = parseQuantity(input.quantity);

  if (quantityValue <= 0) {
    throw new ValidationError('quantity must be greater than 0', 'quantity');
  }

  assertDomesticConstraints(input, input.tradeType);

  const validated: CreateFormulaInput = {
    tradeType: input.tradeType,
    itemId: input.itemId.trim(),
    quantity: input.quantity as CreateFormulaInput['quantity'],
    baseCurrency: input.baseCurrency?.trim() || DEFAULT_BASE_CURRENCY,
  };

  if (input.unit !== undefined) validated.unit = input.unit;
  if (input.foreignCurrency !== undefined) validated.foreignCurrency = input.foreignCurrency;
  if (input.departureCountry !== undefined) validated.departureCountry = input.departureCountry;
  if (input.arrivalCountry !== undefined) validated.arrivalCountry = input.arrivalCountry;
  if (input.contractExchangeRate !== undefined) {
    validated.contractExchangeRate = input.contractExchangeRate;
  }
  if (input.adjustedExchangeRate !== undefined) {
    validated.adjustedExchangeRate = input.adjustedExchangeRate;
  }
  if (input.exchangeRateChangeReason !== undefined) {
    validated.exchangeRateChangeReason = input.exchangeRateChangeReason;
  }
  if (input.content !== undefined) validated.content = input.content;
  if (input.note !== undefined) validated.note = input.note;
  if (input.createdBy !== undefined) validated.createdBy = input.createdBy;

  return validated;
}

export function validatePatchFormula(input: PatchFormulaInputPayload): ValidatedPatchFormulaInput {
  assertPatchAllowedKeys(input);

  const formulaId = assertRequiredId(input.formulaId, 'formulaId');

  const hasContent = input.content !== undefined;
  const hasNote = input.note !== undefined;
  const hasUnit = input.unit !== undefined;

  if (!hasContent && !hasNote && !hasUnit) {
    throw new ValidationError('At least one of content, note, or unit is required');
  }

  const validated: ValidatedPatchFormulaInput = { formulaId };

  if (hasContent) {
    validated.content = assertOptionalNullableString(input.content, 'content') ?? null;
  }

  if (hasNote) {
    validated.note = assertOptionalNullableString(input.note, 'note') ?? null;
  }

  if (hasUnit) {
    validated.unit = assertOptionalUnit(input.unit, 'unit') ?? null;
  }

  return validated;
}

export function validateCancelFormula(
  input: CancelFormulaInputPayload,
): ValidatedCancelFormulaInput {
  assertCancelAllowedKeys(input);

  return {
    formulaId: assertRequiredId(input.formulaId, 'formulaId'),
    cancelReason: assertRequiredNonEmptyString(input.cancelReason, 'cancelReason'),
    changedBy: assertRequiredNonEmptyString(input.changedBy, 'changedBy'),
  };
}
