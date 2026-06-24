import type {
  CancelPaymentRecordInputPayload,
  CreatePaymentRecordInputPayload,
  CreatePaymentScheduleInputPayload,
  ValidatedCancelPaymentRecordInput,
  ValidatedPaymentRecordInput,
  ValidatedPaymentScheduleInput,
} from '../types/payment.types.js';

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

function parseAmount(
  value: CreatePaymentScheduleInputPayload['amount'],
  field = 'amount',
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

function assertRequiredId(value: string | undefined | null, field: string): string {
  if (!value || value.trim() === '') {
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

function assertPositiveAmount(value: number, field = 'amount'): void {
  if (value <= 0) {
    throw new ValidationError(`${field} must be greater than 0`, field);
  }
}

export function validateCreatePaymentSchedule(
  input: CreatePaymentScheduleInputPayload,
): ValidatedPaymentScheduleInput {
  const formulaId = assertRequiredId(input.formulaId, 'formulaId');
  const participantId = assertRequiredParticipantId(input.participantId);
  const amountValue = parseAmount(input.amount, 'amount');
  assertPositiveAmount(amountValue, 'amount');

  const validated: ValidatedPaymentScheduleInput = {
    formulaId,
    participantId,
    scheduledAmount: input.amount as ValidatedPaymentScheduleInput['scheduledAmount'],
  };

  if (input.direction !== undefined) validated.direction = input.direction;
  if (input.paymentType !== undefined) validated.paymentType = input.paymentType;
  if (input.counterpartyCompanyId !== undefined) {
    validated.counterpartyCompanyId = input.counterpartyCompanyId;
  }
  if (input.scheduledDate !== undefined) validated.scheduledDate = input.scheduledDate;
  if (input.status !== undefined) validated.status = input.status;
  if (input.memo !== undefined) validated.memo = input.memo;

  return validated;
}

export function validateCreatePaymentRecord(
  input: CreatePaymentRecordInputPayload,
): ValidatedPaymentRecordInput {
  const formulaId = assertRequiredId(input.formulaId, 'formulaId');
  const participantId = assertRequiredParticipantId(input.participantId);
  const amountValue = parseAmount(input.amount, 'amount');
  assertPositiveAmount(amountValue, 'amount');

  const validated: ValidatedPaymentRecordInput = {
    formulaId,
    participantId,
    actualAmount: input.amount as ValidatedPaymentRecordInput['actualAmount'],
  };

  if (input.direction !== undefined) validated.direction = input.direction;
  if (input.actualDate !== undefined) validated.actualDate = input.actualDate;
  if (input.paymentScheduleId !== undefined) {
    validated.paymentScheduleId = input.paymentScheduleId;
  }
  if (input.counterpartyCompanyId !== undefined) {
    validated.counterpartyCompanyId = input.counterpartyCompanyId;
  }
  if (input.bankName !== undefined) validated.bankName = input.bankName;
  if (input.accountName !== undefined) validated.accountName = input.accountName;
  if (input.accountNo !== undefined) validated.accountNo = input.accountNo;
  if (input.bankAccountMemo !== undefined) validated.bankAccountMemo = input.bankAccountMemo;
  if (input.confirmedBy !== undefined) validated.confirmedBy = input.confirmedBy;
  if (input.confirmedAt !== undefined) validated.confirmedAt = input.confirmedAt;
  if (input.status !== undefined) validated.status = input.status;
  if (input.memo !== undefined) validated.memo = input.memo;

  return validated;
}

export function validateCancelPaymentRecord(
  input: CancelPaymentRecordInputPayload,
): ValidatedCancelPaymentRecordInput {
  if (input.cancelReason === undefined || input.cancelReason === null) {
    throw new ValidationError('cancelReason is required', 'cancelReason');
  }

  if (input.cancelReason.trim() === '') {
    throw new ValidationError('cancelReason must not be empty', 'cancelReason');
  }

  return {
    cancelReason: input.cancelReason.trim(),
  };
}
