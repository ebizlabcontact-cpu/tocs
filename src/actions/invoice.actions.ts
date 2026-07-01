import type { Invoice, InvoiceStatus } from '@prisma/client';

import { ActionError } from './formula.actions.js';
import { FormulaNotFoundError } from '../services/formula.service.js';
import {
  InvoiceNotFoundError,
  InvoiceService,
  InvoiceStatusNotFoundError,
  InvoiceSyncError,
  invoiceService,
} from '../services/invoice.service.js';
import type { CreateInvoiceInput, FormulaInvoiceStatus } from '../services/invoice.service.js';
import type { CompanyScopeFilter } from '../types/company-scope.types.js';

export interface CreateInvoiceRequest {
  issuer_company_id: string;
  receiver_company_id: string;
  issuer_participant_id?: string | null;
  receiver_participant_id?: string | null;
  sequence_order?: number | null;
  invoice_no?: string | null;
  invoice_date?: string | null;
  external_invoice_amount?: number | string | null;
  supply_amount?: number | string | null;
  tax_amount?: number | string | null;
  status?: InvoiceStatus;
  memo?: string | null;
}

export interface UpdateInvoiceStatusRequest {
  status: InvoiceStatus;
}

export interface InvoiceResponse {
  id: string;
  formula_id: string;
  issuer_company_id: string;
  receiver_company_id: string;
  issuer_participant_id: string | null;
  receiver_participant_id: string | null;
  sequence_order: number | null;
  invoice_no: string | null;
  invoice_date: string | null;
  external_invoice_amount: string | null;
  supply_amount: string | null;
  tax_amount: string | null;
  status: InvoiceStatus;
  amount_verified: boolean;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceListResponse {
  items: InvoiceResponse[];
}

export interface SyncFormulaInvoiceStatusResponse {
  formula_id: string;
  invoice_status: InvoiceStatus;
  formula_no: string;
}

export interface FormulaInvoiceStatusResponse {
  active_count: number;
  matched_count: number;
  mismatched_count: number;
  in_progress_count: number;
  derived_invoice_status: InvoiceStatus;
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

function toInvoiceResponse(invoice: Invoice): InvoiceResponse {
  return {
    id: invoice.id,
    formula_id: invoice.formulaId,
    issuer_company_id: invoice.issuerCompanyId,
    receiver_company_id: invoice.receiverCompanyId,
    issuer_participant_id: invoice.issuerParticipantId,
    receiver_participant_id: invoice.receiverParticipantId,
    sequence_order: invoice.sequenceOrder,
    invoice_no: invoice.invoiceNo,
    invoice_date: formatDate(invoice.invoiceDate),
    external_invoice_amount: invoice.externalInvoiceAmount
      ? decimalToString(invoice.externalInvoiceAmount)
      : null,
    supply_amount: invoice.supplyAmount ? decimalToString(invoice.supplyAmount) : null,
    tax_amount: invoice.taxAmount ? decimalToString(invoice.taxAmount) : null,
    status: invoice.status,
    amount_verified: invoice.amountVerified,
    memo: invoice.memo,
    created_at: invoice.createdAt.toISOString(),
    updated_at: invoice.updatedAt.toISOString(),
  };
}

function toFormulaInvoiceStatusResponse(
  status: FormulaInvoiceStatus,
): FormulaInvoiceStatusResponse {
  return {
    active_count: status.activeCount,
    matched_count: status.matchedCount,
    mismatched_count: status.mismatchedCount,
    in_progress_count: status.inProgressCount,
    derived_invoice_status: status.derivedInvoiceStatus,
  };
}

function mapCreateInvoiceRequest(
  formulaId: string,
  body: CreateInvoiceRequest,
): CreateInvoiceInput {
  const input: CreateInvoiceInput = {
    formulaId,
    issuerCompanyId: body.issuer_company_id,
    receiverCompanyId: body.receiver_company_id,
  };

  if (body.issuer_participant_id !== undefined) {
    input.issuerParticipantId = body.issuer_participant_id;
  }
  if (body.receiver_participant_id !== undefined) {
    input.receiverParticipantId = body.receiver_participant_id;
  }
  if (body.sequence_order !== undefined) input.sequenceOrder = body.sequence_order;
  if (body.invoice_no !== undefined) input.invoiceNo = body.invoice_no;
  if (body.invoice_date !== undefined) {
    input.invoiceDate = body.invoice_date ? new Date(body.invoice_date) : null;
  }
  if (body.external_invoice_amount !== undefined) {
    input.externalInvoiceAmount = body.external_invoice_amount;
  }
  if (body.supply_amount !== undefined) input.supplyAmount = body.supply_amount;
  if (body.tax_amount !== undefined) input.taxAmount = body.tax_amount;
  if (body.status !== undefined) input.status = body.status;
  if (body.memo !== undefined) input.memo = body.memo;

  return input;
}

function assertCreateInvoiceRequiredFields(body: CreateInvoiceRequest): void {
  if (!body.issuer_company_id) {
    throw new ActionError(400, 'issuer_company_id is required');
  }
  if (!body.receiver_company_id) {
    throw new ActionError(400, 'receiver_company_id is required');
  }
}

function assertUpdateInvoiceStatusRequiredFields(body: UpdateInvoiceStatusRequest): void {
  if (!body.status) {
    throw new ActionError(400, 'status is required');
  }
}

function mapInvoiceServiceError(error: unknown): never {
  if (error instanceof FormulaNotFoundError) {
    throw new ActionError(404, error.message);
  }

  if (error instanceof InvoiceNotFoundError) {
    throw new ActionError(404, error.message);
  }

  if (error instanceof InvoiceStatusNotFoundError) {
    throw new ActionError(404, error.message);
  }

  if (error instanceof InvoiceSyncError) {
    throw new ActionError(500, error.message);
  }

  throw error;
}

export class InvoiceActions {
  constructor(private readonly service: InvoiceService = invoiceService) {}

  async createInvoice(
    formulaId: string,
    body: CreateInvoiceRequest,
  ): Promise<InvoiceResponse> {
    assertCreateInvoiceRequiredFields(body);

    try {
      const invoice = await this.service.createInvoice(mapCreateInvoiceRequest(formulaId, body));
      return toInvoiceResponse(invoice);
    } catch (error) {
      mapInvoiceServiceError(error);
    }
  }

  async getInvoiceById(id: string): Promise<InvoiceResponse> {
    try {
      const invoice = await this.service.getInvoiceById(id);
      return toInvoiceResponse(invoice);
    } catch (error) {
      mapInvoiceServiceError(error);
    }
  }

  async listInvoicesByFormulaId(
    formulaId: string,
    companyScope?: CompanyScopeFilter,
  ): Promise<InvoiceListResponse> {
    try {
      const invoices = await this.service.listInvoicesByFormulaId(formulaId, companyScope);

      return {
        items: invoices.map(toInvoiceResponse),
      };
    } catch (error) {
      mapInvoiceServiceError(error);
    }
  }

  async getFormulaInvoiceStatus(formulaId: string): Promise<FormulaInvoiceStatusResponse> {
    try {
      const status = await this.service.getFormulaInvoiceStatus(formulaId);
      return toFormulaInvoiceStatusResponse(status);
    } catch (error) {
      mapInvoiceServiceError(error);
    }
  }

  async listInvoicesByParticipantId(participantId: string): Promise<InvoiceListResponse> {
    const invoices = await this.service.listInvoicesByParticipantId(participantId);

    return {
      items: invoices.map(toInvoiceResponse),
    };
  }

  async updateInvoiceStatus(
    invoiceId: string,
    body: UpdateInvoiceStatusRequest,
  ): Promise<InvoiceResponse> {
    assertUpdateInvoiceStatusRequiredFields(body);

    try {
      const invoice = await this.service.updateInvoiceStatus(invoiceId, body.status);
      return toInvoiceResponse(invoice);
    } catch (error) {
      mapInvoiceServiceError(error);
    }
  }

  async syncFormulaInvoiceStatus(formulaId: string): Promise<SyncFormulaInvoiceStatusResponse> {
    try {
      const result = await this.service.syncFormulaInvoiceStatus(formulaId);

      return {
        formula_id: result.formulaId,
        invoice_status: result.invoiceStatus,
        formula_no: result.formula.formulaNo,
      };
    } catch (error) {
      mapInvoiceServiceError(error);
    }
  }
}

export const invoiceActions = new InvoiceActions();

export async function createInvoice(
  formulaId: string,
  body: CreateInvoiceRequest,
): Promise<InvoiceResponse> {
  return invoiceActions.createInvoice(formulaId, body);
}

export async function getInvoiceById(id: string): Promise<InvoiceResponse> {
  return invoiceActions.getInvoiceById(id);
}

export async function listInvoicesByFormulaId(
  formulaId: string,
  companyScope?: CompanyScopeFilter,
): Promise<InvoiceListResponse> {
  return invoiceActions.listInvoicesByFormulaId(formulaId, companyScope);
}

export async function getFormulaInvoiceStatus(
  formulaId: string,
): Promise<FormulaInvoiceStatusResponse> {
  return invoiceActions.getFormulaInvoiceStatus(formulaId);
}

export async function listInvoicesByParticipantId(
  participantId: string,
): Promise<InvoiceListResponse> {
  return invoiceActions.listInvoicesByParticipantId(participantId);
}

export async function updateInvoiceStatus(
  invoiceId: string,
  body: UpdateInvoiceStatusRequest,
): Promise<InvoiceResponse> {
  return invoiceActions.updateInvoiceStatus(invoiceId, body);
}

export async function syncFormulaInvoiceStatus(
  formulaId: string,
): Promise<SyncFormulaInvoiceStatusResponse> {
  return invoiceActions.syncFormulaInvoiceStatus(formulaId);
}
