import {
  Prisma,
  InvoiceStatus,
  type Formula,
  type Invoice,
} from '@prisma/client';

import { prisma } from '../lib/prisma.js';
import {
  InvoiceRepository,
  invoiceRepository,
} from '../repositories/invoice.repository.js';
import type {
  FormulaInvoiceStatusRow,
  InvoiceCreateData,
} from '../repositories/invoice.repository.js';
import { getFormulaClosedState } from './guards/closed-formula.guard.js';

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

export class InvoiceStatusNotFoundError extends Error {
  constructor(formulaId: string) {
    super(`Formula invoice status not found: ${formulaId}`);
    this.name = 'InvoiceStatusNotFoundError';
  }
}

export type CreateInvoiceInput = InvoiceCreateData;

export interface FormulaInvoiceStatus {
  activeCount: number;
  matchedCount: number;
  mismatchedCount: number;
  inProgressCount: number;
  derivedInvoiceStatus: InvoiceStatus;
}

export interface SyncFormulaInvoiceStatusResult {
  formulaId: string;
  invoiceStatus: InvoiceStatus;
  formula: Formula;
}

interface DerivedInvoiceStatusRow {
  derived_invoice_status: InvoiceStatus;
}

function toCount(value: FormulaInvoiceStatusRow['active_count']): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

function toFormulaInvoiceStatus(row: FormulaInvoiceStatusRow): FormulaInvoiceStatus {
  return {
    activeCount: toCount(row.active_count),
    matchedCount: toCount(row.matched_count),
    mismatchedCount: toCount(row.mismatched_count),
    inProgressCount: toCount(row.in_progress_count),
    derivedInvoiceStatus: row.derived_invoice_status,
  };
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

  async getFormulaInvoiceStatus(formulaId: string): Promise<FormulaInvoiceStatus> {
    const row = await this.repository.getFormulaInvoiceStatus(formulaId);

    if (!row) {
      throw new InvoiceStatusNotFoundError(formulaId);
    }

    return toFormulaInvoiceStatus(row);
  }

  async syncFormulaInvoiceStatus(formulaId: string): Promise<SyncFormulaInvoiceStatusResult> {
    const [rows, closedState] = await Promise.all([
      prisma.$queryRaw<DerivedInvoiceStatusRow[]>`
        SELECT derived_invoice_status
        FROM v_formula_invoice_status
        WHERE formula_id = ${formulaId}::uuid
      `,
      getFormulaClosedState(formulaId),
    ]);

    const derivedStatus = rows[0]?.derived_invoice_status;

    if (!derivedStatus) {
      throw new InvoiceSyncError(
        `Unable to derive invoice status for formula: ${formulaId}`,
      );
    }

    const shouldUpdateFormulaInvoiceStatus =
      !closedState.isClosed || derivedStatus === InvoiceStatus.AMOUNT_MATCHED;

    if (!shouldUpdateFormulaInvoiceStatus) {
      const formula = await prisma.formula.findUnique({ where: { id: formulaId } });

      if (!formula) {
        throw new InvoiceSyncError(`Formula not found for invoice sync: ${formulaId}`);
      }

      return {
        formulaId,
        invoiceStatus: derivedStatus,
        formula,
      };
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
