import { Prisma, TradeType } from '@prisma/client';

import { FormulaRepository, formulaRepository } from '../repositories/formula.repository.js';
import type {
  FormulaCreateData,
  FormulaListParams,
  FormulaListResult,
  FormulaPatchData,
} from '../repositories/formula.repository.js';
import { assertNotClosedForTradeMutation } from './guards/closed-formula.guard.js';

export class FormulaNotFoundError extends Error {
  constructor(message = 'Formula not found') {
    super(message);
    this.name = 'FormulaNotFoundError';
  }
}

/** formula_no 및 생성 시점 상태 컬럼은 Service 입력에서 제외 */
export interface CreateFormulaInput {
  tradeType: TradeType;
  itemId: string;
  quantity: Prisma.Decimal | number | string;
  unit?: string | null;
  baseCurrency?: string;
  foreignCurrency?: string | null;
  departureCountry?: string | null;
  arrivalCountry?: string | null;
  contractExchangeRate?: Prisma.Decimal | number | string | null;
  adjustedExchangeRate?: Prisma.Decimal | number | string | null;
  exchangeRateChangeReason?: string | null;
  content?: string | null;
  note?: string | null;
  createdBy?: string | null;
}

export interface ListFormulasInput {
  tradeStatus?: FormulaListParams['tradeStatus'];
  isClosed?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  page?: number;
  pageSize?: number;
}

export interface PatchFormulaInput {
  formulaId: string;
  content?: string | null;
  note?: string | null;
  unit?: string | null;
}

export class FormulaService {
  constructor(private readonly repository: FormulaRepository = formulaRepository) {}

  async create(input: CreateFormulaInput) {
    const data: FormulaCreateData = {
      tradeType: input.tradeType,
      itemId: input.itemId,
      quantity: input.quantity,
    };

    if (input.unit !== undefined) data.unit = input.unit;
    if (input.baseCurrency !== undefined) data.baseCurrency = input.baseCurrency;
    if (input.foreignCurrency !== undefined) data.foreignCurrency = input.foreignCurrency;
    if (input.departureCountry !== undefined) data.departureCountry = input.departureCountry;
    if (input.arrivalCountry !== undefined) data.arrivalCountry = input.arrivalCountry;
    if (input.contractExchangeRate !== undefined) {
      data.contractExchangeRate = input.contractExchangeRate;
    }
    if (input.adjustedExchangeRate !== undefined) {
      data.adjustedExchangeRate = input.adjustedExchangeRate;
    }
    if (input.exchangeRateChangeReason !== undefined) {
      data.exchangeRateChangeReason = input.exchangeRateChangeReason;
    }
    if (input.content !== undefined) data.content = input.content;
    if (input.note !== undefined) data.note = input.note;
    if (input.createdBy !== undefined) data.createdBy = input.createdBy;

    return this.repository.create(data);
  }

  async findById(id: string) {
    const formula = await this.repository.findById(id);

    if (!formula) {
      throw new FormulaNotFoundError(`Formula not found: ${id}`);
    }

    return formula;
  }

  async findByFormulaNo(formulaNo: string) {
    const formula = await this.repository.findByFormulaNo(formulaNo);

    if (!formula) {
      throw new FormulaNotFoundError(`Formula not found: ${formulaNo}`);
    }

    return formula;
  }

  async list(input: ListFormulasInput = {}): Promise<FormulaListResult> {
    const params: FormulaListParams = {};

    if (input.tradeStatus !== undefined) params.tradeStatus = input.tradeStatus;
    if (input.isClosed !== undefined) params.isClosed = input.isClosed;
    if (input.createdAfter !== undefined) params.createdAfter = input.createdAfter;
    if (input.createdBefore !== undefined) params.createdBefore = input.createdBefore;
    if (input.page !== undefined) params.page = input.page;
    if (input.pageSize !== undefined) params.pageSize = input.pageSize;

    return this.repository.list(params);
  }

  async patchFormula(input: PatchFormulaInput) {
    await assertNotClosedForTradeMutation(input.formulaId);

    await this.findById(input.formulaId);

    const data: FormulaPatchData = {
      updatedAt: new Date(),
    };

    if (input.content !== undefined) data.content = input.content;
    if (input.note !== undefined) data.note = input.note;
    if (input.unit !== undefined) data.unit = input.unit;

    return this.repository.updateFormulaMetadata(input.formulaId, data);
  }
}

export const formulaService = new FormulaService();
