import {
  PaymentDirection,
  PaymentGroup,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import type { AuditLog, PaymentSchedule } from '@prisma/client';

import {
  SettlementRepository,
  settlementRepository,
} from '../repositories/settlement.repository.js';
import type { SettlementPaymentScheduleCreateData } from '../repositories/settlement.repository.js';
import {
  assertClosedSettlementAllowedOperation,
  getFormulaClosedState,
} from './guards/closed-formula.guard.js';

export class SettlementFormulaNotClosedError extends Error {
  readonly status = 409 as const;

  constructor(formulaId?: string) {
    super(
      formulaId
        ? `Settlement API is allowed only for closed Formula: ${formulaId}`
        : 'Settlement API is allowed only for closed Formula.',
    );
    this.name = 'SettlementFormulaNotClosedError';
  }
}

export interface CreateSettlementPaymentScheduleInput {
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

export interface CreateSettlementNoteInput {
  formulaId: string;
  note?: string | null;
  issueType?: string | null;
  changedBy?: string | null;
  ipAddress?: string | null;
}

export class SettlementService {
  constructor(private readonly repository: SettlementRepository = settlementRepository) {}

  async createSettlementPaymentSchedule(
    input: CreateSettlementPaymentScheduleInput,
  ): Promise<PaymentSchedule> {
    const { isClosed } = await getFormulaClosedState(input.formulaId);

    if (!isClosed) {
      throw new SettlementFormulaNotClosedError(input.formulaId);
    }

    assertClosedSettlementAllowedOperation('payment_schedule_create_settlement');

    const data: SettlementPaymentScheduleCreateData = {
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

    return this.repository.createSettlementPaymentSchedule(data);
  }

  async createSettlementNote(input: CreateSettlementNoteInput): Promise<AuditLog> {
    const { isClosed } = await getFormulaClosedState(input.formulaId);

    if (!isClosed) {
      throw new SettlementFormulaNotClosedError(input.formulaId);
    }

    assertClosedSettlementAllowedOperation('settlement_note_create');

    const noteData: Parameters<SettlementRepository['createSettlementNote']>[0] = {
      formulaId: input.formulaId,
    };

    if (input.note !== undefined) noteData.note = input.note;
    if (input.issueType !== undefined) noteData.issueType = input.issueType;
    if (input.changedBy !== undefined) noteData.changedBy = input.changedBy;
    if (input.ipAddress !== undefined) noteData.ipAddress = input.ipAddress;

    return this.repository.createSettlementNote(noteData);
  }
}

export const settlementService = new SettlementService();
