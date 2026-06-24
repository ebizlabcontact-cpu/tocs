import {
  Prisma,
  type Formula,
  type Invoice,
  type InvoiceStatus,
} from '@prisma/client';

import { prisma } from '../lib/prisma.js';
import {
  InvoiceRepository,
  invoiceRepository,
} from '../repositories/invoice.repository.js';
import type { InvoiceCreateData } from '../repositories/invoice.repository.js';

export class InvoiceNotFoundError extends Error {
  constructor(id: string) {
    super(`Invoice not found: ${id}`);
    this.name = 'InvoiceNotFoundError';
  }
}

export class InvoiceSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvoiceSyncError';
  }
}

export type CreateInvoiceInput = InvoiceCreateData;

export interface SyncFormulaInvoiceStatusResult {
  formulaId: string;
  invoiceStatus: InvoiceStatus;
  formula: Formula;
}

interface DerivedInvoiceStatusRow {
  derived_invoice_status: InvoiceStatus;
}

export class InvoiceService {
  constructor(private readonly repository: InvoiceRepository = invoiceRepository) {}

  async createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    const invoice = await this.repository.createInvoice(input);
    await this.syncFormulaInvoiceStatus(invoice.formulaId);
    return invoice;
  }

  async getInvoiceById(id: string): Promise<Invoice> {
    const invoice = await this.repository.findInvoiceById(id);

    if (!invoice) {
      throw new InvoiceNotFoundError(id);
    }

    return invoice;
  }

  async listInvoicesByFormulaId(formulaId: string): Promise<Invoice[]> {
    return this.repository.listInvoicesByFormulaId(formulaId);
  }

  async listInvoicesByParticipantId(participantId: string): Promise<Invoice[]> {
    return this.repository.listInvoicesByParticipantId(participantId);
  }

  async updateInvoiceStatus(invoiceId: string, status: InvoiceStatus): Promise<Invoice> {
    const existing = await this.repository.findInvoiceById(invoiceId);

    if (!existing) {
      throw new InvoiceNotFoundError(invoiceId);
    }

    const invoice = await this.repository.updateInvoiceStatus({ invoiceId, status });
    await this.syncFormulaInvoiceStatus(invoice.formulaId);
    return invoice;
  }

  async syncFormulaInvoiceStatus(formulaId: string): Promise<SyncFormulaInvoiceStatusResult> {
    const rows = await prisma.$queryRaw<DerivedInvoiceStatusRow[]>`
      SELECT derived_invoice_status
      FROM v_formula_invoice_status
      WHERE formula_id = ${formulaId}::uuid
    `;

    const derivedStatus = rows[0]?.derived_invoice_status;

    if (!derivedStatus) {
      throw new InvoiceSyncError(
        `Unable to derive invoice status for formula: ${formulaId}`,
      );
    }

    try {
      const formula = await prisma.formula.update({
        where: { id: formulaId },
        data: { invoiceStatus: derivedStatus },
      });

      return {
        formulaId,
        invoiceStatus: derivedStatus,
        formula,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new InvoiceSyncError(`Formula not found for invoice sync: ${formulaId}`);
      }

      throw error;
    }
  }
}

export const invoiceService = new InvoiceService();
