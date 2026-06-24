import type { PaymentDirection, PaymentGroup, PaymentRecord, PaymentSchedule, PaymentStatus } from '@prisma/client';

import { ActionError } from './formula.actions.js';
import {
  PaymentRecordAlreadyCanceledError,
  PaymentRecordNotFoundError,
  PaymentRecordService,
  PaymentScheduleNotFoundError,
  PaymentScheduleService,
  PaymentValidationError,
  paymentRecordService,
  paymentScheduleService,
} from '../services/payment.service.js';
import type {
  CancelPaymentRecordInput,
  CreatePaymentRecordInput,
  CreatePaymentScheduleInput,
} from '../services/payment.service.js';

export interface CreatePaymentScheduleRequest {
  direction: PaymentDirection;
  scheduled_amount: number | string;
  participant_id?: string | null;
  payment_type?: PaymentGroup;
  counterparty_company_id?: string | null;
  scheduled_date?: string | null;
  status?: PaymentStatus;
  memo?: string | null;
}

export interface CreatePaymentRecordRequest {
  direction: PaymentDirection;
  actual_amount: number | string;
  actual_date: string;
  payment_schedule_id?: string | null;
  participant_id?: string | null;
  counterparty_company_id?: string | null;
  bank_name?: string | null;
  account_name?: string | null;
  account_no?: string | null;
  bank_account_memo?: string | null;
  confirmed_by?: string | null;
  confirmed_at?: string | null;
  status?: PaymentStatus;
  memo?: string | null;
}

export interface CancelPaymentRecordRequest {
  cancel_reason?: string | null;
}

export interface PaymentScheduleResponse {
  id: string;
  formula_id: string;
  participant_id: string | null;
  direction: PaymentDirection;
  payment_type: PaymentGroup;
  counterparty_company_id: string | null;
  scheduled_amount: string;
  scheduled_date: string | null;
  status: PaymentStatus;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentRecordResponse {
  id: string;
  formula_id: string;
  payment_schedule_id: string | null;
  participant_id: string | null;
  direction: PaymentDirection;
  counterparty_company_id: string | null;
  actual_amount: string;
  actual_date: string;
  bank_name: string | null;
  account_name: string | null;
  account_no: string | null;
  bank_account_memo: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  status: PaymentStatus;
  is_canceled: boolean;
  canceled_at: string | null;
  cancel_reason: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentScheduleListResponse {
  items: PaymentScheduleResponse[];
}

export interface PaymentRecordListResponse {
  items: PaymentRecordResponse[];
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

function toPaymentScheduleResponse(schedule: PaymentSchedule): PaymentScheduleResponse {
  return {
    id: schedule.id,
    formula_id: schedule.formulaId,
    participant_id: schedule.participantId,
    direction: schedule.direction,
    payment_type: schedule.paymentType,
    counterparty_company_id: schedule.counterpartyCompanyId,
    scheduled_amount: decimalToString(schedule.scheduledAmount),
    scheduled_date: formatDate(schedule.scheduledDate),
    status: schedule.status,
    memo: schedule.memo,
    created_at: schedule.createdAt.toISOString(),
    updated_at: schedule.updatedAt.toISOString(),
  };
}

function toPaymentRecordResponse(record: PaymentRecord): PaymentRecordResponse {
  return {
    id: record.id,
    formula_id: record.formulaId,
    payment_schedule_id: record.paymentScheduleId,
    participant_id: record.participantId,
    direction: record.direction,
    counterparty_company_id: record.counterpartyCompanyId,
    actual_amount: decimalToString(record.actualAmount),
    actual_date: formatDate(record.actualDate) ?? record.actualDate.toISOString().slice(0, 10),
    bank_name: record.bankName,
    account_name: record.accountName,
    account_no: record.accountNo,
    bank_account_memo: record.bankAccountMemo,
    confirmed_by: record.confirmedBy,
    confirmed_at: record.confirmedAt?.toISOString() ?? null,
    status: record.status,
    is_canceled: record.isCanceled,
    canceled_at: record.canceledAt?.toISOString() ?? null,
    cancel_reason: record.cancelReason,
    memo: record.memo,
    created_at: record.createdAt.toISOString(),
    updated_at: record.updatedAt.toISOString(),
  };
}

function mapCreatePaymentScheduleRequest(
  formulaId: string,
  body: CreatePaymentScheduleRequest,
): CreatePaymentScheduleInput {
  const input: CreatePaymentScheduleInput = {
    formulaId,
    direction: body.direction,
    scheduledAmount: body.scheduled_amount,
  };

  if (body.participant_id !== undefined) input.participantId = body.participant_id;
  if (body.payment_type !== undefined) input.paymentType = body.payment_type;
  if (body.counterparty_company_id !== undefined) {
    input.counterpartyCompanyId = body.counterparty_company_id;
  }
  if (body.scheduled_date !== undefined) input.scheduledDate = body.scheduled_date;
  if (body.status !== undefined) input.status = body.status;
  if (body.memo !== undefined) input.memo = body.memo;

  return input;
}

function mapCreatePaymentRecordRequest(
  formulaId: string,
  body: CreatePaymentRecordRequest,
): CreatePaymentRecordInput {
  const input: CreatePaymentRecordInput = {
    formulaId,
    direction: body.direction,
    actualAmount: body.actual_amount,
    actualDate: body.actual_date,
  };

  if (body.payment_schedule_id !== undefined) {
    input.paymentScheduleId = body.payment_schedule_id;
  }
  if (body.participant_id !== undefined) input.participantId = body.participant_id;
  if (body.counterparty_company_id !== undefined) {
    input.counterpartyCompanyId = body.counterparty_company_id;
  }
  if (body.bank_name !== undefined) input.bankName = body.bank_name;
  if (body.account_name !== undefined) input.accountName = body.account_name;
  if (body.account_no !== undefined) input.accountNo = body.account_no;
  if (body.bank_account_memo !== undefined) input.bankAccountMemo = body.bank_account_memo;
  if (body.confirmed_by !== undefined) input.confirmedBy = body.confirmed_by;
  if (body.confirmed_at !== undefined) input.confirmedAt = body.confirmed_at;
  if (body.status !== undefined) input.status = body.status;
  if (body.memo !== undefined) input.memo = body.memo;

  return input;
}

function mapCancelPaymentRecordRequest(
  body: CancelPaymentRecordRequest,
): CancelPaymentRecordInput {
  const input: CancelPaymentRecordInput = {};

  if (body.cancel_reason !== undefined) input.cancelReason = body.cancel_reason;

  return input;
}

function mapPaymentServiceError(error: unknown): never {
  if (error instanceof PaymentScheduleNotFoundError) {
    throw new ActionError(404, error.message);
  }

  if (error instanceof PaymentRecordNotFoundError) {
    throw new ActionError(404, error.message);
  }

  if (error instanceof PaymentRecordAlreadyCanceledError) {
    throw new ActionError(409, error.message);
  }

  if (error instanceof PaymentValidationError) {
    throw new ActionError(400, error.message);
  }

  throw error;
}

export class PaymentScheduleActions {
  constructor(private readonly service: PaymentScheduleService = paymentScheduleService) {}

  async createPaymentSchedule(
    formulaId: string,
    body: CreatePaymentScheduleRequest,
  ): Promise<PaymentScheduleResponse> {
    try {
      const schedule = await this.service.createSchedule(
        mapCreatePaymentScheduleRequest(formulaId, body),
      );
      return toPaymentScheduleResponse(schedule);
    } catch (error) {
      mapPaymentServiceError(error);
    }
  }

  async getPaymentScheduleById(id: string): Promise<PaymentScheduleResponse> {
    try {
      const schedule = await this.service.getScheduleById(id);
      return toPaymentScheduleResponse(schedule);
    } catch (error) {
      mapPaymentServiceError(error);
    }
  }

  async listPaymentSchedulesByFormulaId(formulaId: string): Promise<PaymentScheduleListResponse> {
    const schedules = await this.service.listSchedulesByFormulaId(formulaId);

    return {
      items: schedules.map(toPaymentScheduleResponse),
    };
  }
}

export class PaymentRecordActions {
  constructor(private readonly service: PaymentRecordService = paymentRecordService) {}

  async createPaymentRecord(
    formulaId: string,
    body: CreatePaymentRecordRequest,
  ): Promise<PaymentRecordResponse> {
    try {
      const record = await this.service.createRecord(
        mapCreatePaymentRecordRequest(formulaId, body),
      );
      return toPaymentRecordResponse(record);
    } catch (error) {
      mapPaymentServiceError(error);
    }
  }

  async getPaymentRecordById(id: string): Promise<PaymentRecordResponse> {
    try {
      const record = await this.service.getRecordById(id);
      return toPaymentRecordResponse(record);
    } catch (error) {
      mapPaymentServiceError(error);
    }
  }

  async listPaymentRecordsByFormulaId(formulaId: string): Promise<PaymentRecordListResponse> {
    const records = await this.service.listRecordsByFormulaId(formulaId);

    return {
      items: records.map(toPaymentRecordResponse),
    };
  }

  async cancelPaymentRecord(
    id: string,
    body: CancelPaymentRecordRequest = {},
  ): Promise<PaymentRecordResponse> {
    try {
      const record = await this.service.cancelRecord(id, mapCancelPaymentRecordRequest(body));
      return toPaymentRecordResponse(record);
    } catch (error) {
      mapPaymentServiceError(error);
    }
  }
}

export const paymentScheduleActions = new PaymentScheduleActions();
export const paymentRecordActions = new PaymentRecordActions();

export async function createPaymentSchedule(
  formulaId: string,
  body: CreatePaymentScheduleRequest,
): Promise<PaymentScheduleResponse> {
  return paymentScheduleActions.createPaymentSchedule(formulaId, body);
}

export async function getPaymentScheduleById(id: string): Promise<PaymentScheduleResponse> {
  return paymentScheduleActions.getPaymentScheduleById(id);
}

export async function listPaymentSchedulesByFormulaId(
  formulaId: string,
): Promise<PaymentScheduleListResponse> {
  return paymentScheduleActions.listPaymentSchedulesByFormulaId(formulaId);
}

export async function createPaymentRecord(
  formulaId: string,
  body: CreatePaymentRecordRequest,
): Promise<PaymentRecordResponse> {
  return paymentRecordActions.createPaymentRecord(formulaId, body);
}

export async function getPaymentRecordById(id: string): Promise<PaymentRecordResponse> {
  return paymentRecordActions.getPaymentRecordById(id);
}

export async function listPaymentRecordsByFormulaId(
  formulaId: string,
): Promise<PaymentRecordListResponse> {
  return paymentRecordActions.listPaymentRecordsByFormulaId(formulaId);
}

export async function cancelPaymentRecord(
  id: string,
  body: CancelPaymentRecordRequest = {},
): Promise<PaymentRecordResponse> {
  return paymentRecordActions.cancelPaymentRecord(id, body);
}
