import { PaymentDirection } from '@prisma/client';

import type {
  CreateSettlementNoteInputPayload,
  CreateSettlementPaymentScheduleInputPayload,
  ValidatedCreateSettlementNoteInput,
  ValidatedCreateSettlementPaymentScheduleInput,
} from '../types/settlement.types.js';

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

function assertRequiredParticipantId(value: string | null | undefined): string {
  if (value === undefined || value === null || value.trim() === '') {
    throw new ValidationError('participantId is required', 'participantId');
  }

  return value.trim();
}

function assertRequiredDirection(
  value: CreateSettlementPaymentScheduleInputPayload['direction'],
): PaymentDirection {
  if (value === undefined || value === null) {
    throw new ValidationError('direction is required', 'direction');
  }

  if (!Object.values(PaymentDirection).includes(value)) {
    throw new ValidationError('direction is invalid', 'direction');
  }

  return value;
}

function parseRequiredAmount(
  value: CreateSettlementPaymentScheduleInputPayload['scheduledAmount'],
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

function assertPositiveAmount(value: number, field: string): void {
  if (value <= 0) {
    throw new ValidationError(`${field} must be greater than 0`, field);
  }
}

function parseRequiredDate(
  value: string | Date | null | undefined,
  field: string,
): Date {
  if (value === undefined || value === null) {
    throw new ValidationError(`${field} is required`, field);
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new ValidationError(`${field} must be a valid date`, field);
    }

    return value;
  }

  if (typeof value === 'string' && value.trim() === '') {
    throw new ValidationError(`${field} is required`, field);
  }

  const parsed = new Date(typeof value === 'string' ? value.trim() : value);

  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError(`${field} must be a valid date`, field);
  }

  return parsed;
}

function assertRequiredString(value: string | null | undefined, field: string): string {
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

export function validateCreateSettlementPaymentSchedule(
  input: CreateSettlementPaymentScheduleInputPayload,
): ValidatedCreateSettlementPaymentScheduleInput {
  const formulaId = assertRequiredId(input.formulaId, 'formulaId');
  const participantId = assertRequiredParticipantId(input.participantId);
  const direction = assertRequiredDirection(input.direction);
  const amountValue = parseRequiredAmount(input.scheduledAmount, 'scheduledAmount');
  assertPositiveAmount(amountValue, 'scheduledAmount');
  const dueDate = parseRequiredDate(input.dueDate, 'dueDate');

  const validated: ValidatedCreateSettlementPaymentScheduleInput = {
    formulaId,
    participantId,
    direction,
    scheduledAmount: input.scheduledAmount as ValidatedCreateSettlementPaymentScheduleInput['scheduledAmount'],
    dueDate,
  };

  if (input.memo !== undefined) {
    validated.memo = input.memo;
  }

  return validated;
}

export function validateCreateSettlementNote(
  input: CreateSettlementNoteInputPayload,
): ValidatedCreateSettlementNoteInput {
  const formulaId = assertRequiredId(input.formulaId, 'formulaId');
  const note = assertRequiredString(input.note, 'note');
  const issueType = assertOptionalNonEmptyString(input.issueType, 'issueType');
  const changedBy = assertOptionalNonEmptyString(input.changedBy, 'changedBy');

  const validated: ValidatedCreateSettlementNoteInput = {
    formulaId,
    note,
  };

  if (issueType !== undefined) {
    validated.issueType = issueType;
  }

  if (changedBy !== undefined) {
    validated.changedBy = changedBy;
  }

  return validated;
}
