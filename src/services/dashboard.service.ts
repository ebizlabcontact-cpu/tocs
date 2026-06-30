import { Prisma } from '@prisma/client';

import {
  DashboardRepository,
  dashboardRepository,
} from '../repositories/dashboard.repository.js';
import type {
  DashboardListParams,
  FormulaConfirmedKpiRow,
  FormulaProfitEngineRow,
  ParticipantConfirmedKpiRow,
  PaymentUnmatchedRow,
} from '../repositories/dashboard.repository.js';
import type { CompanyScopeFilter } from '../types/company-scope.types.js';
import { resolveScopeCompanyId } from '../utils/company-scope.js';

export class DashboardDataNotFoundError extends Error {
  readonly status = 404 as const;

  constructor(message: string) {
    super(message);
    this.name = 'DashboardDataNotFoundError';
  }
}

export interface DashboardListInput {
  formulaId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  participantId?: string;
  limit?: number;
  offset?: number;
  companyScope?: CompanyScopeFilter;
}

export interface FormulaConfirmedKpi {
  formulaId: string;
  formulaNo: string;
  cashInStatus: string;
  cashOutStatus: string;
  confirmedRevenue: string;
  confirmedPayment: string;
  scheduledRevenue: string;
  scheduledPayment: string;
  receivable: string;
  payable: string;
  receiveRate: string | null;
  paymentRate: string | null;
}

export interface FormulaProfitEngine {
  formulaId: string;
  formulaNo: string;
  confirmedRevenue: string;
  confirmedCostTotal: string;
  confirmedNetProfit: string;
  expectedRevenue: string;
  expectedBuy: string;
  expectedCost: string;
  expectedShare: string;
  expectedNetProfit: string;
  expectedProfitRate: string;
}

export interface ParticipantConfirmedKpi {
  formulaId: string;
  formulaNo: string;
  participantId: string;
  companyId: string;
  companyName: string;
  roleGroup: string;
  sequenceOrder: number;
  totalBuyAmount: string;
  totalSellAmount: string;
  confirmedIn: string;
  confirmedOut: string;
  scheduledIn: string;
  scheduledOut: string;
  receivable: string;
  payable: string;
  confirmedNetProfit: string;
}

export interface PaymentUnmatched {
  id: string;
  formulaId: string;
  formulaNo: string;
  direction: string;
  actualAmount: string;
  actualDate: Date;
  bankName: string | null;
  accountNo: string | null;
  status: string;
  memo: string | null;
  createdAt: Date;
}

function toDecimalString(value: Prisma.Decimal | number | string): string {
  return value.toString();
}

function toNullableDecimalString(
  value: Prisma.Decimal | number | string | null,
): string | null {
  if (value === null) {
    return null;
  }

  return value.toString();
}

function toListParams(input: DashboardListInput): DashboardListParams {
  const params: DashboardListParams = {};

  if (input.formulaId !== undefined) params.formulaId = input.formulaId;
  if (input.dateFrom !== undefined) params.dateFrom = input.dateFrom;
  if (input.dateTo !== undefined) params.dateTo = input.dateTo;
  if (input.participantId !== undefined) params.participantId = input.participantId;
  if (input.limit !== undefined) params.limit = input.limit;
  if (input.offset !== undefined) params.offset = input.offset;

  const scopeCompanyId = resolveScopeCompanyId(input.companyScope);
  if (scopeCompanyId !== undefined) {
    params.scopeCompanyId = scopeCompanyId;
  }

  return params;
}

function toFormulaConfirmedKpi(row: FormulaConfirmedKpiRow): FormulaConfirmedKpi {
  return {
    formulaId: row.formula_id,
    formulaNo: row.formula_no,
    cashInStatus: row.cash_in_status,
    cashOutStatus: row.cash_out_status,
    confirmedRevenue: toDecimalString(row.confirmed_revenue),
    confirmedPayment: toDecimalString(row.confirmed_payment),
    scheduledRevenue: toDecimalString(row.scheduled_revenue),
    scheduledPayment: toDecimalString(row.scheduled_payment),
    receivable: toDecimalString(row.receivable),
    payable: toDecimalString(row.payable),
    receiveRate: toNullableDecimalString(row.receive_rate),
    paymentRate: toNullableDecimalString(row.payment_rate),
  };
}

function toFormulaProfitEngine(row: FormulaProfitEngineRow): FormulaProfitEngine {
  return {
    formulaId: row.formula_id,
    formulaNo: row.formula_no,
    confirmedRevenue: toDecimalString(row.confirmed_revenue),
    confirmedCostTotal: toDecimalString(row.confirmed_cost_total),
    confirmedNetProfit: toDecimalString(row.confirmed_net_profit),
    expectedRevenue: toDecimalString(row.expected_revenue),
    expectedBuy: toDecimalString(row.expected_buy),
    expectedCost: toDecimalString(row.expected_cost),
    expectedShare: toDecimalString(row.expected_share),
    expectedNetProfit: toDecimalString(row.expected_net_profit),
    expectedProfitRate: toDecimalString(row.expected_profit_rate),
  };
}

function toParticipantConfirmedKpi(row: ParticipantConfirmedKpiRow): ParticipantConfirmedKpi {
  return {
    formulaId: row.formula_id,
    formulaNo: row.formula_no,
    participantId: row.participant_id,
    companyId: row.company_id,
    companyName: row.company_name,
    roleGroup: row.role_group,
    sequenceOrder: row.sequence_order,
    totalBuyAmount: toDecimalString(row.total_buy_amount),
    totalSellAmount: toDecimalString(row.total_sell_amount),
    confirmedIn: toDecimalString(row.confirmed_in),
    confirmedOut: toDecimalString(row.confirmed_out),
    scheduledIn: toDecimalString(row.scheduled_in),
    scheduledOut: toDecimalString(row.scheduled_out),
    receivable: toDecimalString(row.receivable),
    payable: toDecimalString(row.payable),
    confirmedNetProfit: toDecimalString(row.confirmed_net_profit),
  };
}

function toPaymentUnmatched(row: PaymentUnmatchedRow): PaymentUnmatched {
  return {
    id: row.id,
    formulaId: row.formula_id,
    formulaNo: row.formula_no,
    direction: row.direction,
    actualAmount: toDecimalString(row.actual_amount),
    actualDate: row.actual_date,
    bankName: row.bank_name,
    accountNo: row.account_no,
    status: row.status,
    memo: row.memo,
    createdAt: row.created_at,
  };
}

export class DashboardService {
  constructor(private readonly repository: DashboardRepository = dashboardRepository) {}

  async getFormulaConfirmedKpi(formulaId: string): Promise<FormulaConfirmedKpi> {
    const row = await this.repository.getFormulaConfirmedKpi(formulaId);

    if (!row) {
      throw new DashboardDataNotFoundError(`Confirmed KPI not found for formula: ${formulaId}`);
    }

    return toFormulaConfirmedKpi(row);
  }

  async listFormulaConfirmedKpi(input: DashboardListInput = {}): Promise<FormulaConfirmedKpi[]> {
    const rows = await this.repository.listFormulaConfirmedKpi(toListParams(input));
    return rows.map(toFormulaConfirmedKpi);
  }

  async getFormulaProfitEngine(formulaId: string): Promise<FormulaProfitEngine> {
    const row = await this.repository.getFormulaProfitEngine(formulaId);

    if (!row) {
      throw new DashboardDataNotFoundError(`Profit engine data not found for formula: ${formulaId}`);
    }

    return toFormulaProfitEngine(row);
  }

  async listFormulaProfitEngine(input: DashboardListInput = {}): Promise<FormulaProfitEngine[]> {
    const rows = await this.repository.listFormulaProfitEngine(toListParams(input));
    return rows.map(toFormulaProfitEngine);
  }

  async listParticipantConfirmedKpi(
    input: DashboardListInput = {},
  ): Promise<ParticipantConfirmedKpi[]> {
    const rows = await this.repository.listParticipantConfirmedKpi(toListParams(input));
    return rows.map(toParticipantConfirmedKpi);
  }

  async listUnmatchedPayments(input: DashboardListInput = {}): Promise<PaymentUnmatched[]> {
    const rows = await this.repository.listUnmatchedPayments(toListParams(input));
    return rows.map(toPaymentUnmatched);
  }
}

export const dashboardService = new DashboardService();
