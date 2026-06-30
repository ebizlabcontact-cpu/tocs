import {
  InvoiceStatus,
  PaymentStatus,
  Prisma,
  StatusTarget,
  TradeStatus,
  TradeType,
  type AuditLog,
  type Formula,
  type StatusLog,
} from '@prisma/client';

import { prisma } from '../lib/prisma.js';
import { FormulaRepository, formulaRepository } from '../repositories/formula.repository.js';
import type {
  FormulaCreateData,
  FormulaListParams,
  FormulaListResult,
  FormulaPatchData,
} from '../repositories/formula.repository.js';
import type { CompanyScopeFilter } from '../types/company-scope.types.js';
import { resolveScopeCompanyId } from '../utils/company-scope.js';
import { assertNotClosedForTradeMutation } from './guards/closed-formula.guard.js';

export class FormulaNotFoundError extends Error {
  constructor(message = 'Formula not found') {
    super(message);
    this.name = 'FormulaNotFoundError';
  }
}

export class FormulaAlreadyCanceledError extends Error {
  readonly status = 409 as const;

  constructor(formulaId: string) {
    super(`Formula already canceled: ${formulaId}`);
    this.name = 'FormulaAlreadyCanceledError';
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
  companyScope?: CompanyScopeFilter;
}

export interface PatchFormulaInput {
  formulaId: string;
  content?: string | null;
  note?: string | null;
  unit?: string | null;
}

export interface CancelFormulaInput {
  formulaId: string;
  cancelReason: string;
  changedBy: string;
}

export interface FormulaCancelResult {
  formula: Formula;
  statusLogs: StatusLog[];
  auditLog: AuditLog;
}

const CANCELED_STATUS = 'CANCELED';

function isFormulaFullyCanceled(formula: Formula): boolean {
  return (
    formula.tradeStatus === TradeStatus.CANCELED &&
    formula.deliveryStatus === TradeStatus.CANCELED &&
    formula.cashInStatus === PaymentStatus.CANCELED &&
    formula.cashOutStatus === PaymentStatus.CANCELED &&
    formula.invoiceStatus === InvoiceStatus.CANCELED &&
    formula.logisticsStatus === TradeStatus.CANCELED
  );
}

function buildCancelPrevStatusSnapshot(formula: Formula): Prisma.JsonObject {
  return {
    trade_status: formula.tradeStatus,
    delivery_status: formula.deliveryStatus,
    cash_in_status: formula.cashInStatus,
    cash_out_status: formula.cashOutStatus,
    invoice_status: formula.invoiceStatus,
    logistics_status: formula.logisticsStatus,
  };
}

function buildCancelNewStatusSnapshot(input: CancelFormulaInput): Prisma.JsonObject {
  return {
    trade_status: TradeStatus.CANCELED,
    delivery_status: TradeStatus.CANCELED,
    cash_in_status: PaymentStatus.CANCELED,
    cash_out_status: PaymentStatus.CANCELED,
    invoice_status: InvoiceStatus.CANCELED,
    logistics_status: TradeStatus.CANCELED,
    cancel_reason: input.cancelReason,
    changed_by: input.changedBy,
  };
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

    const scopeCompanyId = resolveScopeCompanyId(input.companyScope);
    if (scopeCompanyId !== undefined) {
      params.scopeCompanyId = scopeCompanyId;
    }

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

  async cancelFormula(input: CancelFormulaInput): Promise<FormulaCancelResult> {
    await assertNotClosedForTradeMutation(input.formulaId);

    const formula = await this.findById(input.formulaId);

    if (isFormulaFullyCanceled(formula)) {
      throw new FormulaAlreadyCanceledError(input.formulaId);
    }

    const oldData = buildCancelPrevStatusSnapshot(formula);
    const newData = buildCancelNewStatusSnapshot(input);

    const statusLogEntries: Array<{
      statusTarget: StatusTarget;
      prevStatus: string;
    }> = [
      { statusTarget: StatusTarget.TRADE_STATUS, prevStatus: formula.tradeStatus },
      { statusTarget: StatusTarget.DELIVERY_STATUS, prevStatus: formula.deliveryStatus },
      { statusTarget: StatusTarget.CASH_IN_STATUS, prevStatus: formula.cashInStatus },
      { statusTarget: StatusTarget.CASH_OUT_STATUS, prevStatus: formula.cashOutStatus },
      { statusTarget: StatusTarget.INVOICE_STATUS, prevStatus: formula.invoiceStatus },
      { statusTarget: StatusTarget.LOGISTICS_STATUS, prevStatus: formula.logisticsStatus },
    ];

    return prisma.$transaction(async (tx) => {
      const updatedFormula = await tx.formula.update({
        where: { id: input.formulaId },
        data: {
          tradeStatus: TradeStatus.CANCELED,
          deliveryStatus: TradeStatus.CANCELED,
          cashInStatus: PaymentStatus.CANCELED,
          cashOutStatus: PaymentStatus.CANCELED,
          invoiceStatus: InvoiceStatus.CANCELED,
          logisticsStatus: TradeStatus.CANCELED,
          updatedAt: new Date(),
        },
      });

      const statusLogs = await Promise.all(
        statusLogEntries.map((entry) =>
          tx.statusLog.create({
            data: {
              formulaId: input.formulaId,
              statusTarget: entry.statusTarget,
              prevStatus: entry.prevStatus,
              newStatus: CANCELED_STATUS,
              changedBy: input.changedBy,
              changeReason: input.cancelReason,
            },
          }),
        ),
      );

      const auditLog = await tx.auditLog.create({
        data: {
          tableName: 'formulas',
          recordId: input.formulaId,
          action: 'FORMULA_CANCEL',
          changedBy: input.changedBy,
          oldData,
          newData,
        },
      });

      return { formula: updatedFormula, statusLogs, auditLog };
    });
  }
}

export const formulaService = new FormulaService();
