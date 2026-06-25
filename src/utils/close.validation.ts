import type {
  CloseFormulaInputPayload,
  ValidatedCloseFormulaInput,
} from '../types/close.types.js';

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
  if (value === undefined || value === null || value.trim() === '') {
    throw new ValidationError(`${field} is required`, field);
  }

  return value.trim();
}

function assertOptionalNonEmptyString(
  value: string | null | undefined,
  field: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (value.trim() === '') {
    throw new ValidationError(`${field} must not be empty`, field);
  }

  return value.trim();
}

export function validateGetFormulaCloseStatus(input: {
  formulaId?: string;
}): { formulaId: string } {
  const formulaId = assertRequiredId(input.formulaId, 'formulaId');

  return { formulaId };
}

export function validateCloseFormula(
  input: CloseFormulaInputPayload,
): ValidatedCloseFormulaInput {
  const formulaId = assertRequiredId(input.formulaId, 'formulaId');
  const closedBy = assertOptionalNonEmptyString(input.closedBy, 'closedBy');

  const validated: ValidatedCloseFormulaInput = { formulaId };

  if (closedBy !== undefined) {
    validated.closedBy = closedBy;
  }

  return validated;
}
