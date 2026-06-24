import { TradeType } from '@prisma/client';

import type { CreateFormulaInput, CreateFormulaInputPayload } from '../types/formula.types.js';
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
