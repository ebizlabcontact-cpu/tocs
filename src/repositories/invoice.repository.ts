import {
  type Invoice,
  type InvoiceStatus,
  type Prisma,
} from '@prisma/client';

import { prisma } from '../lib/prisma.js';

export type InvoiceCreateData = Omit<Prisma.InvoiceUncheckedCreateInput, 'id'>;

export interface UpdateInvoiceStatusData {
  invoiceId: string;
  status: InvoiceStatus;
}

export interface FormulaInvoiceStatusRow {
  formula_id: string;
  formula_no: string;
  active_count: bigint | number;
  revision_count: bigint | number;
  mismatched_count: bigint | number;
  in_progress_count: bigint | number;
  matched_count: bigint | number;
  derived_invoice_status: InvoiceStatus;
}

export class InvoiceRepository {
  async createInvoice(data: InvoiceCreateData): Promise<Invoice> {
    return prisma.invoice.create({ data });
  }

  async findInvoiceById(id: string): Promise<Invoice | null> {
    return prisma.invoice.findUnique({ where: { id } });
  }

  async listInvoicesByFormulaId(formulaId: string): Promise<Invoice[]> {
    return prisma.invoice.findMany({
      where: { formulaId },
      orderBy: [{ sequenceOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async listInvoicesByParticipantId(participantId: string): Promise<Invoice[]> {
    return prisma.invoice.findMany({
      where: {
        OR: [
          { issuerParticipantId: participantId },
          { receiverParticipantId: participantId },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateInvoiceStatus(data: UpdateInvoiceStatusData): Promise<Invoice> {
    return prisma.invoice.update({
      where: { id: data.invoiceId },
      data: { status: data.status },
    });
  }

  async getFormulaInvoiceStatus(formulaId: string): Promise<FormulaInvoiceStatusRow | null> {
    const rows = await prisma.$queryRaw<FormulaInvoiceStatusRow[]>`
      SELECT
        formula_id,
        formula_no,
        active_count,
        revision_count,
        mismatched_count,
        in_progress_count,
        matched_count,
        derived_invoice_status
      FROM v_formula_invoice_status
      WHERE formula_id = ${formulaId}::uuid
    `;

    return rows[0] ?? null;
  }
}

export const invoiceRepository = new InvoiceRepository();
