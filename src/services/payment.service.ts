import {
  PaymentDirection,
  PaymentGroup,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

import {
  PaymentRecordRepository,
  PaymentScheduleRepository,
  paymentRecordRepository,
  paymentScheduleRepository,
} from '../repositories/payment.repository.js';
import type {
  CancelPaymentRecordData,
  PaymentRecordCreateData,
  PaymentScheduleCreateData,
} from '../repositories/payment.repository.js';

export class PaymentScheduleNotFoundError extends Error {
  constructor(id: string) {
    super(`Payment schedule not found: ${id}`);
    this.name = 'PaymentScheduleNotFoundError';
  }
}

export class PaymentRecordNotFoundError extends Error {
  constructor(id: string) {
    super(`Payment record not found: ${id}`);
    this.name = 'PaymentRecordNotFoundError';
  }
}

export class PaymentRecordAlreadyCanceledError extends Error {
  readonly status = 409 as const;

  constructor(id: string) {
    super(`Payment record already canceled: ${id}`);
    this.name = 'PaymentRecordAlreadyCanceledError';
  }
}

export class PaymentValidationError extends Error {
  readonly status = 400 as const;

  constructor(message: string) {
    super(message);
    this.name = 'PaymentValidationError';
  }
}

export interface CreatePaymentScheduleInput {
  formulaId: string;
  direction: PaymentDirection;
  scheduledAmount: Prisma.Decimal | number | string;
  participantId?: string | null;
  paymentType?: PaymentGroup;
  counterpartyCompanyId?: string | null;
  scheduledDate?: Date | string | null;
  status?: PaymentStatus;
  memo?: string | null;
}

export interface CreatePaymentRecordInput {
  formulaId: string;
  direction: PaymentDirection;
  actualAmount: Prisma.Decimal | number | string;
  actualDate: Date | string;
  paymentScheduleId?: string | null;
  participantId?: string | null;
  counterpartyCompanyId?: string | null;
  bankName?: string | null;
  accountName?: string | null;
  accountNo?: string | null;
  bankAccountMemo?: string | null;
  confirmedBy?: string | null;
  confirmedAt?: Date | string | null;
  status?: PaymentStatus;
  memo?: string | null;
}

export interface CancelPaymentRecordInput {
  cancelReason?: string | null;
}

export class PaymentScheduleService {
  constructor(
    private readonly repository: PaymentScheduleRepository = paymentScheduleRepository,
  ) {}

  async createSchedule(input: CreatePaymentScheduleInput) {
    const data: PaymentScheduleCreateData = {
      formulaId: input.formulaId,
      direction: input.direction,
      scheduledAmount: input.scheduledAmount,
    };

    if (input.participantId !== undefined) data.participantId = input.participantId;
    if (input.paymentType !== undefined) data.paymentType = input.paymentType;
    if (input.counterpartyCompanyId !== undefined) {
      data.counterpartyCompanyId = input.counterpartyCompanyId;
    }
    if (input.scheduledDate !== undefined) data.scheduledDate = input.scheduledDate;
    if (input.status !== undefined) data.status = input.status;
    if (input.memo !== undefined) data.memo = input.memo;

    return this.repository.createSchedule(data);
  }

  async getScheduleById(id: string) {
    const schedule = await this.repository.findScheduleById(id);

    if (!schedule) {
      throw new PaymentScheduleNotFoundError(id);
    }

    return schedule;
  }

  async listSchedulesByFormulaId(formulaId: string) {
    return this.repository.listSchedulesByFormulaId(formulaId);
  }
}

export class PaymentRecordService {
  constructor(
    private readonly repository: PaymentRecordRepository = paymentRecordRepository,
  ) {}

  async createRecord(input: CreatePaymentRecordInput) {
    const data: PaymentRecordCreateData = {
      formulaId: input.formulaId,
      direction: input.direction,
      actualAmount: input.actualAmount,
      actualDate: input.actualDate,
    };

    if (input.paymentScheduleId !== undefined) {
      data.paymentScheduleId = input.paymentScheduleId;
    }
    if (input.participantId !== undefined) data.participantId = input.participantId;
    if (input.counterpartyCompanyId !== undefined) {
      data.counterpartyCompanyId = input.counterpartyCompanyId;
    }
    if (input.bankName !== undefined) data.bankName = input.bankName;
    if (input.accountName !== undefined) data.accountName = input.accountName;
    if (input.accountNo !== undefined) data.accountNo = input.accountNo;
    if (input.bankAccountMemo !== undefined) data.bankAccountMemo = input.bankAccountMemo;
    if (input.confirmedBy !== undefined) data.confirmedBy = input.confirmedBy;
    if (input.confirmedAt !== undefined) data.confirmedAt = input.confirmedAt;
    if (input.status !== undefined) data.status = input.status;
    if (input.memo !== undefined) data.memo = input.memo;

    return this.repository.createRecord(data);
  }

  async getRecordById(id: string) {
    const record = await this.repository.findRecordById(id);

    if (!record) {
      throw new PaymentRecordNotFoundError(id);
    }

    return record;
  }

  async listRecordsByFormulaId(formulaId: string) {
    return this.repository.listRecordsByFormulaId(formulaId);
  }

  async cancelRecord(id: string, input: CancelPaymentRecordInput = {}) {
    if (input.cancelReason !== undefined && input.cancelReason !== null) {
      if (input.cancelReason.trim() === '') {
        throw new PaymentValidationError('cancelReason must not be empty');
      }
    }

    const record = await this.repository.findRecordById(id);

    if (!record) {
      throw new PaymentRecordNotFoundError(id);
    }

    if (record.isCanceled) {
      throw new PaymentRecordAlreadyCanceledError(id);
    }

    const data: CancelPaymentRecordData = {};

    if (input.cancelReason !== undefined) {
      data.cancelReason = input.cancelReason;
    }

    return this.repository.cancelRecord(id, data);
  }
}

export const paymentScheduleService = new PaymentScheduleService();
export const paymentRecordService = new PaymentRecordService();
