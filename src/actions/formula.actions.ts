import type { Formula, TradeStatus, TradeType } from '@prisma/client';

import {
  FormulaNotFoundError,
  FormulaService,
  formulaService,
} from '../services/formula.service.js';
import type { CreateFormulaInput, ListFormulasInput } from '../services/formula.service.js';

export class ActionError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ActionError';
  }
}

export interface CreateFormulaRequest {
  trade_type: TradeType;
  item_id: string;
  quantity: number | string;
  unit?: string | null;
  base_currency?: string;
  foreign_currency?: string | null;
  departure_country?: string | null;
  arrival_country?: string | null;
  contract_exchange_rate?: number | string | null;
  adjusted_exchange_rate?: number | string | null;
  content?: string | null;
  note?: string | null;
  created_by?: string | null;
}

export interface ListFormulasQuery {
  trade_status?: TradeStatus;
  is_closed?: boolean;
  created_after?: string;
  created_before?: string;
  page?: number;
  page_size?: number;
}

export interface FormulaCreateResponse {
  id: string;
  formula_no: string;
  trade_type: TradeType;
  trade_status: TradeStatus;
  delivery_status: TradeStatus;
  cash_in_status: string;
  cash_out_status: string;
  invoice_status: string;
  logistics_status: TradeStatus;
  is_closed: boolean;
  created_at: string;
}

export interface FormulaDetailResponse extends FormulaCreateResponse {
  item_id: string;
  unit: string | null;
  quantity: string;
  closed_at: string | null;
}

export interface FormulaListResponse {
  items: FormulaDetailResponse[];
  total: number;
  page: number;
  page_size: number;
}

function decimalToString(value: { toString(): string }): string {
  return value.toString();
}

function toFormulaCreateResponse(formula: Formula): FormulaCreateResponse {
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
  };
}

function toFormulaDetailResponse(formula: Formula): FormulaDetailResponse {
  return {
    ...toFormulaCreateResponse(formula),
    item_id: formula.itemId,
    unit: formula.unit,
    quantity: decimalToString(formula.quantity),
    closed_at: formula.closedAt?.toISOString() ?? null,
  };
}

function mapCreateRequest(body: CreateFormulaRequest): CreateFormulaInput {
  const input: CreateFormulaInput = {
    tradeType: body.trade_type,
    itemId: body.item_id,
    quantity: body.quantity,
  };

  if (body.unit !== undefined) input.unit = body.unit;
  if (body.base_currency !== undefined) input.baseCurrency = body.base_currency;
  if (body.foreign_currency !== undefined) input.foreignCurrency = body.foreign_currency;
  if (body.departure_country !== undefined) input.departureCountry = body.departure_country;
  if (body.arrival_country !== undefined) input.arrivalCountry = body.arrival_country;
  if (body.contract_exchange_rate !== undefined) {
    input.contractExchangeRate = body.contract_exchange_rate;
  }
  if (body.adjusted_exchange_rate !== undefined) {
    input.adjustedExchangeRate = body.adjusted_exchange_rate;
  }
  if (body.content !== undefined) input.content = body.content;
  if (body.note !== undefined) input.note = body.note;
  if (body.created_by !== undefined) input.createdBy = body.created_by;

  return input;
}

function mapListQuery(query: ListFormulasQuery): ListFormulasInput {
  const input: ListFormulasInput = {};

  if (query.trade_status !== undefined) input.tradeStatus = query.trade_status;
  if (query.is_closed !== undefined) input.isClosed = query.is_closed;
  if (query.page !== undefined) input.page = query.page;
  if (query.page_size !== undefined) input.pageSize = query.page_size;

  if (query.created_after !== undefined) {
    const createdAfter = new Date(query.created_after);
    if (Number.isNaN(createdAfter.getTime())) {
      throw new ActionError(400, 'Invalid created_after');
    }
    input.createdAfter = createdAfter;
  }

  if (query.created_before !== undefined) {
    const createdBefore = new Date(query.created_before);
    if (Number.isNaN(createdBefore.getTime())) {
      throw new ActionError(400, 'Invalid created_before');
    }
    input.createdBefore = createdBefore;
  }

  return input;
}

function assertCreateRequiredFields(body: CreateFormulaRequest): void {
  if (!body.trade_type) {
    throw new ActionError(400, 'trade_type is required');
  }
  if (!body.item_id) {
    throw new ActionError(400, 'item_id is required');
  }
  if (body.quantity === undefined || body.quantity === null) {
    throw new ActionError(400, 'quantity is required');
  }
}

function mapNotFoundError(error: unknown): never {
  if (error instanceof FormulaNotFoundError) {
    throw new ActionError(404, error.message);
  }
  throw error;
}

export class FormulaActions {
  constructor(private readonly service: FormulaService = formulaService) {}

  async createFormula(body: CreateFormulaRequest): Promise<FormulaCreateResponse> {
    assertCreateRequiredFields(body);

    const formula = await this.service.create(mapCreateRequest(body));
    return toFormulaCreateResponse(formula);
  }

  async getFormulaById(id: string): Promise<FormulaDetailResponse> {
    try {
      const formula = await this.service.findById(id);
      return toFormulaDetailResponse(formula);
    } catch (error) {
      mapNotFoundError(error);
    }
  }

  async getFormulaByFormulaNo(formulaNo: string): Promise<FormulaDetailResponse> {
    try {
      const formula = await this.service.findByFormulaNo(formulaNo);
      return toFormulaDetailResponse(formula);
    } catch (error) {
      mapNotFoundError(error);
    }
  }

  async listFormulas(query: ListFormulasQuery = {}): Promise<FormulaListResponse> {
    const result = await this.service.list(mapListQuery(query));

    return {
      items: result.items.map(toFormulaDetailResponse),
      total: result.total,
      page: result.page,
      page_size: result.pageSize,
    };
  }
}

export const formulaActions = new FormulaActions();

export async function createFormula(body: CreateFormulaRequest): Promise<FormulaCreateResponse> {
  return formulaActions.createFormula(body);
}

export async function getFormulaById(id: string): Promise<FormulaDetailResponse> {
  return formulaActions.getFormulaById(id);
}

export async function getFormulaByFormulaNo(formulaNo: string): Promise<FormulaDetailResponse> {
  return formulaActions.getFormulaByFormulaNo(formulaNo);
}

export async function listFormulas(query: ListFormulasQuery = {}): Promise<FormulaListResponse> {
  return formulaActions.listFormulas(query);
}
