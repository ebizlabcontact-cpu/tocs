import { type AuditLog, type PaymentSchedule, type Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma.js';

export type SettlementPaymentScheduleCreateData = Omit<
  Prisma.PaymentScheduleUncheckedCreateInput,
  'id' | 'paymentRecords'
>;

export interface SettlementNoteCreateData {
  formulaId: string;
  note?: string | null;
  issueType?: string | null;
  changedBy?: string | null;
  ipAddress?: string | null;
}

export class SettlementRepository {
  async createSettlementPaymentSchedule(
    data: SettlementPaymentScheduleCreateData,
  ): Promise<PaymentSchedule> {
    return prisma.paymentSchedule.create({ data });
  }

  async createSettlementNote(data: SettlementNoteCreateData): Promise<AuditLog> {
    return prisma.auditLog.create({
      data: {
        tableName: 'formulas',
        recordId: data.formulaId,
        action: 'SETTLEMENT_NOTE',
        changedBy: data.changedBy ?? null,
        newData: {
          note: data.note ?? null,
          issue_type: data.issueType ?? null,
          changed_by: data.changedBy ?? null,
        },
        ipAddress: data.ipAddress ?? null,
      },
    });
  }
}

export const settlementRepository = new SettlementRepository();
