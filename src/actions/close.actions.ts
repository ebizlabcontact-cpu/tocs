import type { Formula } from '@prisma/client';

import { ActionError } from './formula.actions.js';
import type { FormulaDetailResponse } from './formula.actions.js';
import {
  CloseService,
  FormulaCloseStatusNotFoundError,
  FormulaNotCloseableError,
  closeService,
} from '../services/close.service.js';
import type {
  CloseFormulaInput,
  CloseFormulaResult,
  FormulaCloseStatus,
} from '../services/close.service.js';

export interface CloseFormulaRequest {
  closed_by?: string | null;
}

export interface FormulaCloseStatusResponse {
  formula_id: string;
  can_close: boolean;
  pending_statuses: string[];
  invoice_status: boolean;
  payment_status: boolean;
  receive_status: boolean;
  shipment_status: boolean;
  close_reason: null;
  is_closed: boolean;
  formula_no: string;
  trade_done: boolean;
  delivery_done: boolean;
}

export interface CloseFormulaResponse {
  formula: FormulaDetailResponse;
  status: FormulaCloseStatusResponse;
}

function decimalToString(value: { toString(): string }): string {
  return value.toString();
}

function toFormulaDetailResponse(formula: Formula): FormulaDetailResponse {
  return {
    id: formula.id,
    formula_no: formula.formulaNo,
    trade_type: formula.tradeType,
    trade_status: formula.tradeStatus,
    delivery_status: formula.deliveryStatus,
    cash_in_status: formula.cashInStatus,
    cash_out_status: formula.cashOutStatus,
    invoice_status: formula.invoiceStatus,
    logistics_status: formula.logisticsStatus,
    is_closed: formula.isClosed,
    created_at: formula.createdAt.toISOString(),
    item_id: formula.itemId,
    unit: formula.unit,
    quantity: decimalToString(formula.quantity),
    closed_at: formula.closedAt?.toISOString() ?? null,
  };
}

function toPendingStatuses(status: FormulaCloseStatus): string[] {
  const pending: string[] = [];

  if (!status.tradeDone) pending.push('trade_status');
  if (!status.deliveryDone) pending.push('delivery_status');
  if (!status.cashInDone) pending.push('cash_in_status');
  if (!status.cashOutDone) pending.push('cash_out_status');
  if (!status.invoiceDone) pending.push('invoice_status');
  if (!status.logisticsDone) pending.push('logistics_status');

  return pending;
}

function toFormulaCloseStatusResponse(status: FormulaCloseStatus): FormulaCloseStatusResponse {
  return {
    formula_id: status.formulaId,
    formula_no: status.formulaNo,
    can_close: status.canClose,
    is_closed: status.isClosed,
    pending_statuses: toPendingStatuses(status),
    invoice_status: status.invoiceDone,
    payment_status: status.cashOutDone,
    receive_status: status.cashInDone,
    shipment_status: status.logisticsDone,
    close_reason: null,
    trade_done: status.tradeDone,
    delivery_done: status.deliveryDone,
  };
}

function mapCloseFormulaRequest(formulaId: string, body: CloseFormulaRequest): CloseFormulaInput {
  const input: CloseFormulaInput = { formulaId };

  if (body.closed_by !== undefined) {
    input.closedBy = body.closed_by;
  }

  return input;
}

function mapCloseServiceError(error: unknown): never {
  if (error instanceof FormulaCloseStatusNotFoundError) {
    throw new ActionError(404, error.message);
  }

  if (error instanceof FormulaNotCloseableError) {
    throw new ActionError(409, error.message);
  }

  throw error;
}

function toCloseFormulaResponse(result: CloseFormulaResult): CloseFormulaResponse {
  return {
    formula: toFormulaDetailResponse(result.formula),
    status: toFormulaCloseStatusResponse(result.status),
  };
}

export class CloseActions {
  constructor(private readonly service: CloseService = closeService) {}

  async getFormulaCloseStatus(formulaId: string): Promise<FormulaCloseStatusResponse> {
    try {
      const status = await this.service.getFormulaCloseStatus(formulaId);
      return toFormulaCloseStatusResponse(status);
    } catch (error) {
      mapCloseServiceError(error);
    }
  }

  async closeFormula(
    formulaId: string,
    body: CloseFormulaRequest = {},
  ): Promise<CloseFormulaResponse> {
    try {
      const result = await this.service.closeFormula(mapCloseFormulaRequest(formulaId, body));
      return toCloseFormulaResponse(result);
    } catch (error) {
      mapCloseServiceError(error);
    }
  }
}

export const closeActions = new CloseActions();

export async function getFormulaCloseStatus(
  formulaId: string,
): Promise<FormulaCloseStatusResponse> {
  return closeActions.getFormulaCloseStatus(formulaId);
}

export async function closeFormula(
  formulaId: string,
  body: CloseFormulaRequest = {},
): Promise<CloseFormulaResponse> {
  return closeActions.closeFormula(formulaId, body);
}
