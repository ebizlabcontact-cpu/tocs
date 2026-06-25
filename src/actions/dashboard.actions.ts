import { ActionError } from './formula.actions.js';
import {
  DashboardDataNotFoundError,
  DashboardService,
  dashboardService,
} from '../services/dashboard.service.js';
import type {
  DashboardListInput,
  FormulaConfirmedKpi,
  FormulaProfitEngine,
  ParticipantConfirmedKpi,
  PaymentUnmatched,
} from '../services/dashboard.service.js';

export interface DashboardListRequest {
  formula_id?: string;
  participant_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export interface FormulaConfirmedKpiResponse {
  formula_id: string;
  formula_no: string;
  cash_in_status: string;
  cash_out_status: string;
  confirmed_revenue: string;
  confirmed_payment: string;
  scheduled_revenue: string;
  scheduled_payment: string;
  receivable: string;
  payable: string;
  receive_rate: string | null;
  payment_rate: string | null;
}

export interface FormulaProfitEngineResponse {
  formula_id: string;
  formula_no: string;
  confirmed_revenue: string;
  confirmed_cost_total: string;
  confirmed_net_profit: string;
  expected_revenue: string;
  expected_buy: string;
  expected_cost: string;
  expected_share: string;
  expected_net_profit: string;
  expected_profit_rate: string;
}

export interface ParticipantConfirmedKpiResponse {
  formula_id: string;
  formula_no: string;
  participant_id: string;
  company_id: string;
  company_name: string;
  role_group: string;
  sequence_order: number;
  total_buy_amount: string;
  total_sell_amount: string;
  confirmed_in: string;
  confirmed_out: string;
  scheduled_in: string;
  scheduled_out: string;
  receivable: string;
  payable: string;
  confirmed_net_profit: string;
}

export interface PaymentUnmatchedResponse {
  id: string;
  formula_id: string;
  formula_no: string;
  direction: string;
  actual_amount: string;
  actual_date: string;
  bank_name: string | null;
  account_no: string | null;
  status: string;
  memo: string | null;
  created_at: string;
}

export interface DashboardListResponse<T> {
  items: T[];
}

function formatDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function mapDashboardListRequest(query: DashboardListRequest = {}): DashboardListInput {
  const input: DashboardListInput = {};

  if (query.formula_id !== undefined) input.formulaId = query.formula_id;
  if (query.participant_id !== undefined) input.participantId = query.participant_id;
  if (query.limit !== undefined) input.limit = query.limit;
  if (query.offset !== undefined) input.offset = query.offset;

  if (query.date_from !== undefined) {
    const dateFrom = new Date(query.date_from);
    if (Number.isNaN(dateFrom.getTime())) {
      throw new ActionError(400, 'Invalid date_from');
    }
    input.dateFrom = dateFrom;
  }

  if (query.date_to !== undefined) {
    const dateTo = new Date(query.date_to);
    if (Number.isNaN(dateTo.getTime())) {
      throw new ActionError(400, 'Invalid date_to');
    }
    input.dateTo = dateTo;
  }

  return input;
}

function toFormulaConfirmedKpiResponse(kpi: FormulaConfirmedKpi): FormulaConfirmedKpiResponse {
  return {
    formula_id: kpi.formulaId,
    formula_no: kpi.formulaNo,
    cash_in_status: kpi.cashInStatus,
    cash_out_status: kpi.cashOutStatus,
    confirmed_revenue: kpi.confirmedRevenue,
    confirmed_payment: kpi.confirmedPayment,
    scheduled_revenue: kpi.scheduledRevenue,
    scheduled_payment: kpi.scheduledPayment,
    receivable: kpi.receivable,
    payable: kpi.payable,
    receive_rate: kpi.receiveRate,
    payment_rate: kpi.paymentRate,
  };
}

function toFormulaProfitEngineResponse(
  profit: FormulaProfitEngine,
): FormulaProfitEngineResponse {
  return {
    formula_id: profit.formulaId,
    formula_no: profit.formulaNo,
    confirmed_revenue: profit.confirmedRevenue,
    confirmed_cost_total: profit.confirmedCostTotal,
    confirmed_net_profit: profit.confirmedNetProfit,
    expected_revenue: profit.expectedRevenue,
    expected_buy: profit.expectedBuy,
    expected_cost: profit.expectedCost,
    expected_share: profit.expectedShare,
    expected_net_profit: profit.expectedNetProfit,
    expected_profit_rate: profit.expectedProfitRate,
  };
}

function toParticipantConfirmedKpiResponse(
  kpi: ParticipantConfirmedKpi,
): ParticipantConfirmedKpiResponse {
  return {
    formula_id: kpi.formulaId,
    formula_no: kpi.formulaNo,
    participant_id: kpi.participantId,
    company_id: kpi.companyId,
    company_name: kpi.companyName,
    role_group: kpi.roleGroup,
    sequence_order: kpi.sequenceOrder,
    total_buy_amount: kpi.totalBuyAmount,
    total_sell_amount: kpi.totalSellAmount,
    confirmed_in: kpi.confirmedIn,
    confirmed_out: kpi.confirmedOut,
    scheduled_in: kpi.scheduledIn,
    scheduled_out: kpi.scheduledOut,
    receivable: kpi.receivable,
    payable: kpi.payable,
    confirmed_net_profit: kpi.confirmedNetProfit,
  };
}

function toPaymentUnmatchedResponse(payment: PaymentUnmatched): PaymentUnmatchedResponse {
  return {
    id: payment.id,
    formula_id: payment.formulaId,
    formula_no: payment.formulaNo,
    direction: payment.direction,
    actual_amount: payment.actualAmount,
    actual_date: formatDate(payment.actualDate),
    bank_name: payment.bankName,
    account_no: payment.accountNo,
    status: payment.status,
    memo: payment.memo,
    created_at: payment.createdAt.toISOString(),
  };
}

function mapDashboardServiceError(error: unknown): never {
  if (error instanceof DashboardDataNotFoundError) {
    throw new ActionError(404, error.message);
  }

  throw error;
}

export class DashboardActions {
  constructor(private readonly service: DashboardService = dashboardService) {}

  async getFormulaConfirmedKpi(formulaId: string): Promise<FormulaConfirmedKpiResponse> {
    try {
      const kpi = await this.service.getFormulaConfirmedKpi(formulaId);
      return toFormulaConfirmedKpiResponse(kpi);
    } catch (error) {
      mapDashboardServiceError(error);
    }
  }

  async listFormulaConfirmedKpi(
    query: DashboardListRequest = {},
  ): Promise<DashboardListResponse<FormulaConfirmedKpiResponse>> {
    const items = await this.service.listFormulaConfirmedKpi(mapDashboardListRequest(query));

    return {
      items: items.map(toFormulaConfirmedKpiResponse),
    };
  }

  async getFormulaProfitEngine(formulaId: string): Promise<FormulaProfitEngineResponse> {
    try {
      const profit = await this.service.getFormulaProfitEngine(formulaId);
      return toFormulaProfitEngineResponse(profit);
    } catch (error) {
      mapDashboardServiceError(error);
    }
  }

  async listFormulaProfitEngine(
    query: DashboardListRequest = {},
  ): Promise<DashboardListResponse<FormulaProfitEngineResponse>> {
    const items = await this.service.listFormulaProfitEngine(mapDashboardListRequest(query));

    return {
      items: items.map(toFormulaProfitEngineResponse),
    };
  }

  async listParticipantConfirmedKpi(
    query: DashboardListRequest = {},
  ): Promise<DashboardListResponse<ParticipantConfirmedKpiResponse>> {
    const items = await this.service.listParticipantConfirmedKpi(mapDashboardListRequest(query));

    return {
      items: items.map(toParticipantConfirmedKpiResponse),
    };
  }

  async listUnmatchedPayments(
    query: DashboardListRequest = {},
  ): Promise<DashboardListResponse<PaymentUnmatchedResponse>> {
    const items = await this.service.listUnmatchedPayments(mapDashboardListRequest(query));

    return {
      items: items.map(toPaymentUnmatchedResponse),
    };
  }
}

export const dashboardActions = new DashboardActions();

export async function getFormulaConfirmedKpi(
  formulaId: string,
): Promise<FormulaConfirmedKpiResponse> {
  return dashboardActions.getFormulaConfirmedKpi(formulaId);
}

export async function listFormulaConfirmedKpi(
  query: DashboardListRequest = {},
): Promise<DashboardListResponse<FormulaConfirmedKpiResponse>> {
  return dashboardActions.listFormulaConfirmedKpi(query);
}

export async function getFormulaProfitEngine(
  formulaId: string,
): Promise<FormulaProfitEngineResponse> {
  return dashboardActions.getFormulaProfitEngine(formulaId);
}

export async function listFormulaProfitEngine(
  query: DashboardListRequest = {},
): Promise<DashboardListResponse<FormulaProfitEngineResponse>> {
  return dashboardActions.listFormulaProfitEngine(query);
}

export async function listParticipantConfirmedKpi(
  query: DashboardListRequest = {},
): Promise<DashboardListResponse<ParticipantConfirmedKpiResponse>> {
  return dashboardActions.listParticipantConfirmedKpi(query);
}

export async function listUnmatchedPayments(
  query: DashboardListRequest = {},
): Promise<DashboardListResponse<PaymentUnmatchedResponse>> {
  return dashboardActions.listUnmatchedPayments(query);
}
