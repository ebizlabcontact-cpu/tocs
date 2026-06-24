import { InvoiceStatus } from '@prisma/client';

import type {
  CreateInvoiceInputPayload,
  UpdateInvoiceStatusInputPayload,
  ValidatedCreateInvoiceInput,
  ValidatedUpdateInvoiceStatusInput,
} from '../types/invoice.types.js';

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

function parseRequiredInteger(value: number | null | undefined, field: string): number {
  if (value === undefined || value === null) {
    throw new ValidationError(`${field} is required`, field);
  }

  if (!Number.isInteger(value)) {
    throw new ValidationError(`${field} must be an integer`, field);
  }

  return value;
}

function parseIssueAmount(
  value: CreateInvoiceInputPayload['issueAmount'],
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

function assertSequenceOrderMinimum(value: number, field: string): void {
  if (value < 1) {
    throw new ValidationError(`${field} must be greater than or equal to 1`, field);
  }
}

function assertRequiredInvoiceStatus(
  value: UpdateInvoiceStatusInputPayload['status'],
  field: string,
): InvoiceStatus {
  if (value === undefined || value === null) {
    throw new ValidationError(`${field} is required`, field);
  }

  if (typeof value === 'string' && value.trim() === '') {
    throw new ValidationError(`${field} must not be empty`, field);
  }

  const status = typeof value === 'string' ? value.trim() : value;

  if (!Object.values(InvoiceStatus).includes(status as InvoiceStatus)) {
    throw new ValidationError(`${field} is invalid`, field);
  }

  return status as InvoiceStatus;
}

export function validateCreateInvoice(
  input: CreateInvoiceInputPayload,
): ValidatedCreateInvoiceInput {
  const formulaId = assertRequiredId(input.formulaId, 'formulaId');
  const issuerParticipantId = assertRequiredId(input.issuerParticipantId, 'issuerParticipantId');
  const receiverParticipantId = assertRequiredId(
    input.receiverParticipantId,
    'receiverParticipantId',
  );
  const sequenceOrderValue = parseRequiredInteger(input.sequenceOrder, 'sequenceOrder');
  assertSequenceOrderMinimum(sequenceOrderValue, 'sequenceOrder');
  const invoiceType = assertRequiredString(input.invoiceType, 'invoiceType');
  const issueAmountValue = parseIssueAmount(input.issueAmount, 'issueAmount');
  assertPositiveAmount(issueAmountValue, 'issueAmount');

  return {
    formulaId,
    issuerParticipantId,
    receiverParticipantId,
    sequenceOrder: sequenceOrderValue,
    invoiceType,
    issueAmount: input.issueAmount as ValidatedCreateInvoiceInput['issueAmount'],
  };
}

export function validateUpdateInvoiceStatus(
  input: UpdateInvoiceStatusInputPayload,
): ValidatedUpdateInvoiceStatusInput {
  const status = assertRequiredInvoiceStatus(input.status, 'status');

  return { status };
}
