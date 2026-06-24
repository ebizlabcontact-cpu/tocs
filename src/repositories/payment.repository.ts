import {
  type PaymentRecord,
  type PaymentSchedule,
  type Prisma,
} from '@prisma/client';

import { prisma } from '../lib/prisma.js';

export type PaymentScheduleCreateData = Omit<
  Prisma.PaymentScheduleUncheckedCreateInput,
  'id' | 'paymentRecords'
>;

export type PaymentRecordCreateData = Omit<
  Prisma.PaymentRecordUncheckedCreateInput,
  'id'
>;

export interface CancelPaymentRecordData {
  cancelReason?: string | null;
}

export class PaymentScheduleRepository {
  async createSchedule(data: PaymentScheduleCreateData): Promise<PaymentSchedule> {
    return prisma.paymentSchedule.create({ data });
  }

  async findScheduleById(id: string): Promise<PaymentSchedule | null> {
    return prisma.paymentSchedule.findUnique({ where: { id } });
  }

  async listSchedulesByFormulaId(formulaId: string): Promise<PaymentSchedule[]> {
    return prisma.paymentSchedule.findMany({
      where: { formulaId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export class PaymentRecordRepository {
  async createRecord(data: PaymentRecordCreateData): Promise<PaymentRecord> {
    return prisma.paymentRecord.create({ data });
  }

  async findRecordById(id: string): Promise<PaymentRecord | null> {
    return prisma.paymentRecord.findUnique({ where: { id } });
  }

  async listRecordsByFormulaId(formulaId: string): Promise<PaymentRecord[]> {
    return prisma.paymentRecord.findMany({
      where: { formulaId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async cancelRecord(
    id: string,
    data: CancelPaymentRecordData = {},
  ): Promise<PaymentRecord> {
    const updateData: Prisma.PaymentRecordUpdateInput = {
      isCanceled: true,
      canceledAt: new Date(),
    };

    if (data.cancelReason !== undefined) {
      updateData.cancelReason = data.cancelReason;
    }

    return prisma.paymentRecord.update({
      where: { id },
      data: updateData,
    });
  }
}

export const paymentScheduleRepository = new PaymentScheduleRepository();
export const paymentRecordRepository = new PaymentRecordRepository();
