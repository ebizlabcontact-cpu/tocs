import type {
  DashboardListInputPayload,
  FormulaIdInputPayload,
  ValidatedDashboardListInput,
  ValidatedFormulaIdInput,
} from '../types/dashboard.types.js';
import {
  DEFAULT_DASHBOARD_LIST_LIMIT,
  DEFAULT_DASHBOARD_LIST_OFFSET,
} from '../types/dashboard.types.js';

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
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value.trim() === '') {
    throw new ValidationError(`${field} must not be empty`, field);
  }

  return value.trim();
}

function parseOptionalDate(value: string | null | undefined, field: string): Date | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value.trim() === '') {
    throw new ValidationError(`${field} must be a valid date string`, field);
  }

  const parsed = new Date(value.trim());

  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`${field} must be a valid date string`, field);
  }

  return parsed;
}

function parseOptionalInteger(
  value: number | string | null | undefined,
  field: string,
  defaultValue: number,
): number {
  if (value === undefined) {
    return defaultValue;
  }

  if (value === null || value === '') {
    throw new ValidationError(`${field} must be an integer`, field);
  }

  const numeric = typeof value === 'number' ? value : Number(value);

  if (!Number.isInteger(numeric)) {
    throw new ValidationError(`${field} must be an integer`, field);
  }

  return numeric;
}

function assertLimitRange(value: number): void {
  if (value < 1 || value > 100) {
    throw new ValidationError('limit must be between 1 and 100', 'limit');
  }
}

function assertOffsetMinimum(value: number): void {
  if (value < 0) {
    throw new ValidationError('offset must be greater than or equal to 0', 'offset');
  }
}

function assertDateRange(dateFrom: Date | undefined, dateTo: Date | undefined): void {
  if (dateFrom === undefined || dateTo === undefined) {
    return;
  }

  if (dateFrom.getTime() > dateTo.getTime()) {
    throw new ValidationError('dateFrom must be less than or equal to dateTo', 'dateFrom');
  }
}

export function validateFormulaIdInput(input: FormulaIdInputPayload): ValidatedFormulaIdInput {
  const formulaId = assertRequiredId(input.formulaId, 'formulaId');

  return { formulaId };
}

export function validateDashboardListInput(
  input: DashboardListInputPayload = {},
): ValidatedDashboardListInput {
  const formulaId = assertOptionalNonEmptyString(input.formulaId, 'formulaId');
  const participantId = assertOptionalNonEmptyString(input.participantId, 'participantId');
  const dateFrom = parseOptionalDate(input.dateFrom, 'dateFrom');
  const dateTo = parseOptionalDate(input.dateTo, 'dateTo');

  assertDateRange(dateFrom, dateTo);

  const limit = parseOptionalInteger(input.limit, 'limit', DEFAULT_DASHBOARD_LIST_LIMIT);
  const offset = parseOptionalInteger(input.offset, 'offset', DEFAULT_DASHBOARD_LIST_OFFSET);

  assertLimitRange(limit);
  assertOffsetMinimum(offset);

  const validated: ValidatedDashboardListInput = { limit, offset };

  if (formulaId !== undefined) {
    validated.formulaId = formulaId;
  }

  if (participantId !== undefined) {
    validated.participantId = participantId;
  }

  if (dateFrom !== undefined) {
    validated.dateFrom = dateFrom;
  }

  if (dateTo !== undefined) {
    validated.dateTo = dateTo;
  }

  return validated;
}
