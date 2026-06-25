import type { AuditLog, PaymentDirection, PaymentSchedule, PaymentGroup, PaymentStatus } from '@prisma/client';

import { ActionError } from './formula.actions.js';
import {
  ClosedFormulaTradeMutationError,
  FormulaNotFoundForGuardError,
} from '../services/guards/closed-formula.guard.js';
import {
  SettlementFormulaNotClosedError,
  SettlementService,
  settlementService,
} from '../services/settlement.service.js';
import type {
  CreateSettlementNoteInput,
  CreateSettlementPaymentScheduleInput,
} from '../services/settlement.service.js';
import type {
  ValidatedCreateSettlementNoteInput,
  ValidatedCreateSettlementPaymentScheduleInput,
} from '../types/settlement.types.js';
import {
  validateCreateSettlementNote,
  validateCreateSettlementPaymentSchedule,
  ValidationError,
} from '../utils/settlement.validation.js';

export interface CreateSettlementPaymentScheduleRequest {
  participant_id?: string | null;
  direction: PaymentDirection;
  scheduled_amount: number | string;
  due_date: string;
  memo?: string | null;
}

export interface CreateSettlementNoteRequest {
  note: string;
  issue_type?: string | null;
  changed_by?: string | null;
}

export interface SettlementPaymentScheduleResponse {
  id: string;
  formula_id: string;
  participant_id: string | null;
  direction: PaymentDirection;
  payment_type: PaymentGroup;
  counterparty_company_id: string | null;
  scheduled_amount: string;
  due_date: string | null;
  status: PaymentStatus;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface SettlementNoteResponse {
  id: string;
  formula_id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  note: string | null;
  issue_type: string | null;
  changed_by: string | null;
  created_at: string;
}

function decimalToString(value: { toString(): string }): string {
  return value.toString();
}

function formatDate(value: Date | null): string | null {
  if (!value) {
    return null;
  }

  return value.toISOString().slice(0, 10);
}

function toCreateSettlementPaymentScheduleInput(
  validated: ValidatedCreateSettlementPaymentScheduleInput,
): CreateSettlementPaymentScheduleInput {
  const input: CreateSettlementPaymentScheduleInput = {
    formulaId: validated.formulaId,
    participantId: validated.participantId,
    direction: validated.direction,
    scheduledAmount: validated.scheduledAmount,
    scheduledDate: validated.dueDate,
  };

  if (validated.memo !== undefined) {
    input.memo = validated.memo;
  }

  return input;
}

function parseCreateSettlementPaymentScheduleInput(
  formulaId: string,
  body: CreateSettlementPaymentScheduleRequest,
): CreateSettlementPaymentScheduleInput {
  try {
    const payload: Parameters<typeof validateCreateSettlementPaymentSchedule>[0] = {
      formulaId,
      direction: body.direction,
      scheduledAmount: body.scheduled_amount,
      dueDate: body.due_date,
    };

    if (body.participant_id !== undefined) payload.participantId = body.participant_id;
    if (body.memo !== undefined) payload.memo = body.memo;

    const validated = validateCreateSettlementPaymentSchedule(payload);

    return toCreateSettlementPaymentScheduleInput(validated);
  } catch (error) {
    mapSettlementValidationError(error);
  }
}

function toCreateSettlementNoteInput(
  validated: ValidatedCreateSettlementNoteInput,
): CreateSettlementNoteInput {
  const input: CreateSettlementNoteInput = {
    formulaId: validated.formulaId,
    note: validated.note,
  };

  if (validated.issueType !== undefined) {
    input.issueType = validated.issueType;
  }

  if (validated.changedBy !== undefined) {
    input.changedBy = validated.changedBy;
  }

  return input;
}

function parseCreateSettlementNoteInput(
  formulaId: string,
  body: CreateSettlementNoteRequest,
): CreateSettlementNoteInput {
  try {
    const payload: Parameters<typeof validateCreateSettlementNote>[0] = {
      formulaId,
      note: body.note,
    };

    if (body.issue_type !== undefined) payload.issueType = body.issue_type;
    if (body.changed_by !== undefined) payload.changedBy = body.changed_by;

    const validated = validateCreateSettlementNote(payload);

    return toCreateSettlementNoteInput(validated);
  } catch (error) {
    mapSettlementValidationError(error);
  }
}

function mapSettlementValidationError(error: unknown): never {
  if (error instanceof ValidationError) {
    throw new ActionError(400, error.message);
  }

  throw error;
}

function toSettlementPaymentScheduleResponse(
  schedule: PaymentSchedule,
): SettlementPaymentScheduleResponse {
  return {
    id: schedule.id,
    formula_id: schedule.formulaId,
    participant_id: schedule.participantId,
    direction: schedule.direction,
    payment_type: schedule.paymentType,
    counterparty_company_id: schedule.counterpartyCompanyId,
    scheduled_amount: decimalToString(schedule.scheduledAmount),
    due_date: formatDate(schedule.scheduledDate),
    status: schedule.status,
    memo: schedule.memo,
    created_at: schedule.createdAt.toISOString(),
    updated_at: schedule.updatedAt.toISOString(),
  };
}

function readSettlementNoteField(
  auditLog: AuditLog,
  field: 'note' | 'issue_type' | 'changed_by',
): string | null {
  if (!auditLog.newData || typeof auditLog.newData !== 'object' || Array.isArray(auditLog.newData)) {
    return null;
  }

  const value = (auditLog.newData as Record<string, unknown>)[field];

  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

function toSettlementNoteResponse(auditLog: AuditLog): SettlementNoteResponse {
  return {
    id: auditLog.id,
    formula_id: auditLog.recordId ?? '',
    table_name: auditLog.tableName,
    record_id: auditLog.recordId,
    action: auditLog.action,
    note: readSettlementNoteField(auditLog, 'note'),
    issue_type: readSettlementNoteField(auditLog, 'issue_type'),
    changed_by: auditLog.changedBy,
    created_at: auditLog.createdAt.toISOString(),
  };
}

function mapSettlementServiceError(error: unknown): never {
  if (error instanceof FormulaNotFoundForGuardError) {
    throw new ActionError(404, error.message);
  }

  if (error instanceof SettlementFormulaNotClosedError) {
    throw new ActionError(409, error.message);
  }

  if (error instanceof ClosedFormulaTradeMutationError) {
    throw new ActionError(409, error.message);
  }

  throw error;
}

export class SettlementActions {
  constructor(private readonly service: SettlementService = settlementService) {}

  async createSettlementPaymentSchedule(
    formulaId: string,
    body: CreateSettlementPaymentScheduleRequest,
  ): Promise<SettlementPaymentScheduleResponse> {
    try {
      const schedule = await this.service.createSettlementPaymentSchedule(
        parseCreateSettlementPaymentScheduleInput(formulaId, body),
      );
      return toSettlementPaymentScheduleResponse(schedule);
    } catch (error) {
      mapSettlementServiceError(error);
    }
  }

  async createSettlementNote(
    formulaId: string,
    body: CreateSettlementNoteRequest,
  ): Promise<SettlementNoteResponse> {
    try {
      const auditLog = await this.service.createSettlementNote(
        parseCreateSettlementNoteInput(formulaId, body),
      );
      return toSettlementNoteResponse(auditLog);
    } catch (error) {
      mapSettlementServiceError(error);
    }
  }
}

export const settlementActions = new SettlementActions();

export async function createSettlementPaymentSchedule(
  formulaId: string,
  body: CreateSettlementPaymentScheduleRequest,
): Promise<SettlementPaymentScheduleResponse> {
  return settlementActions.createSettlementPaymentSchedule(formulaId, body);
}

export async function createSettlementNote(
  formulaId: string,
  body: CreateSettlementNoteRequest,
): Promise<SettlementNoteResponse> {
  return settlementActions.createSettlementNote(formulaId, body);
}
