import { Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma.js';

export interface DashboardListParams {
  formulaId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  participantId?: string;
  limit?: number;
  offset?: number;
}

export interface FormulaConfirmedKpiRow {
  formula_id: string;
  formula_no: string;
  cash_in_status: string;
  cash_out_status: string;
  confirmed_revenue: Prisma.Decimal | number | string;
  confirmed_payment: Prisma.Decimal | number | string;
  scheduled_revenue: Prisma.Decimal | number | string;
  scheduled_payment: Prisma.Decimal | number | string;
  receivable: Prisma.Decimal | number | string;
  payable: Prisma.Decimal | number | string;
  receive_rate: Prisma.Decimal | number | string | null;
  payment_rate: Prisma.Decimal | number | string | null;
}

export interface FormulaProfitEngineRow {
  formula_id: string;
  formula_no: string;
  confirmed_revenue: Prisma.Decimal | number | string;
  confirmed_cost_total: Prisma.Decimal | number | string;
  confirmed_net_profit: Prisma.Decimal | number | string;
  expected_revenue: Prisma.Decimal | number | string;
  expected_buy: Prisma.Decimal | number | string;
  expected_cost: Prisma.Decimal | number | string;
  expected_share: Prisma.Decimal | number | string;
  expected_net_profit: Prisma.Decimal | number | string;
  expected_profit_rate: Prisma.Decimal | number | string;
}

export interface ParticipantConfirmedKpiRow {
  formula_id: string;
  formula_no: string;
  participant_id: string;
  company_id: string;
  company_name: string;
  role_group: string;
  sequence_order: number;
  total_buy_amount: Prisma.Decimal | number | string;
  total_sell_amount: Prisma.Decimal | number | string;
  confirmed_in: Prisma.Decimal | number | string;
  confirmed_out: Prisma.Decimal | number | string;
  scheduled_in: Prisma.Decimal | number | string;
  scheduled_out: Prisma.Decimal | number | string;
  receivable: Prisma.Decimal | number | string;
  payable: Prisma.Decimal | number | string;
  confirmed_net_profit: Prisma.Decimal | number | string;
}

export interface PaymentUnmatchedRow {
  id: string;
  formula_id: string;
  formula_no: string;
  direction: string;
  actual_amount: Prisma.Decimal | number | string;
  actual_date: Date;
  bank_name: string | null;
  account_no: string | null;
  status: string;
  memo: string | null;
  created_at: Date;
}

function buildFormulaCreatedAtFilters(params: DashboardListParams): Prisma.Sql {
  return Prisma.sql`
    (${params.formulaId ?? null}::uuid IS NULL OR v.formula_id = ${params.formulaId ?? null}::uuid)
    AND (${params.dateFrom ?? null}::timestamptz IS NULL OR f.created_at >= ${params.dateFrom ?? null})
    AND (${params.dateTo ?? null}::timestamptz IS NULL OR f.created_at <= ${params.dateTo ?? null})
  `;
}

function buildPaginationClause(params: DashboardListParams): Prisma.Sql {
  if (params.limit !== undefined) {
    return Prisma.sql`LIMIT ${params.limit} OFFSET ${params.offset ?? 0}`;
  }

  if (params.offset !== undefined) {
    return Prisma.sql`OFFSET ${params.offset}`;
  }

  return Prisma.empty;
}

export class DashboardRepository {
  async getFormulaConfirmedKpi(formulaId: string): Promise<FormulaConfirmedKpiRow | null> {
    const rows = await prisma.$queryRaw<FormulaConfirmedKpiRow[]>`
      SELECT
        formula_id,
        formula_no,
        cash_in_status,
        cash_out_status,
        confirmed_revenue,
        confirmed_payment,
        scheduled_revenue,
        scheduled_payment,
        receivable,
        payable,
        receive_rate,
        payment_rate
      FROM v_formula_confirmed_kpi
      WHERE formula_id = ${formulaId}::uuid
    `;

    return rows[0] ?? null;
  }

  async listFormulaConfirmedKpi(params: DashboardListParams = {}): Promise<FormulaConfirmedKpiRow[]> {
    const whereClause = buildFormulaCreatedAtFilters(params);

    return prisma.$queryRaw<FormulaConfirmedKpiRow[]>`
      SELECT
        v.formula_id,
        v.formula_no,
        v.cash_in_status,
        v.cash_out_status,
        v.confirmed_revenue,
        v.confirmed_payment,
        v.scheduled_revenue,
        v.scheduled_payment,
        v.receivable,
        v.payable,
        v.receive_rate,
        v.payment_rate
      FROM v_formula_confirmed_kpi v
      INNER JOIN formulas f ON f.id = v.formula_id
      WHERE ${whereClause}
      ORDER BY f.created_at DESC, v.formula_id ASC
      ${buildPaginationClause(params)}
    `;
  }

  async getFormulaProfitEngine(formulaId: string): Promise<FormulaProfitEngineRow | null> {
    const rows = await prisma.$queryRaw<FormulaProfitEngineRow[]>`
      SELECT
        formula_id,
        formula_no,
        confirmed_revenue,
        confirmed_cost_total,
        confirmed_net_profit,
        expected_revenue,
        expected_buy,
        expected_cost,
        expected_share,
        expected_net_profit,
        expected_profit_rate
      FROM v_formula_profit_engine
      WHERE formula_id = ${formulaId}::uuid
    `;

    return rows[0] ?? null;
  }

  async listFormulaProfitEngine(params: DashboardListParams = {}): Promise<FormulaProfitEngineRow[]> {
    const whereClause = buildFormulaCreatedAtFilters(params);

    return prisma.$queryRaw<FormulaProfitEngineRow[]>`
      SELECT
        v.formula_id,
        v.formula_no,
        v.confirmed_revenue,
        v.confirmed_cost_total,
        v.confirmed_net_profit,
        v.expected_revenue,
        v.expected_buy,
        v.expected_cost,
        v.expected_share,
        v.expected_net_profit,
        v.expected_profit_rate
      FROM v_formula_profit_engine v
      INNER JOIN formulas f ON f.id = v.formula_id
      WHERE ${whereClause}
      ORDER BY f.created_at DESC, v.formula_id ASC
      ${buildPaginationClause(params)}
    `;
  }

  async listParticipantConfirmedKpi(
    params: DashboardListParams = {},
  ): Promise<ParticipantConfirmedKpiRow[]> {
    const whereClause = Prisma.sql`
      (${params.formulaId ?? null}::uuid IS NULL OR v.formula_id = ${params.formulaId ?? null}::uuid)
      AND (${params.participantId ?? null}::uuid IS NULL OR v.participant_id = ${params.participantId ?? null}::uuid)
      AND (${params.dateFrom ?? null}::timestamptz IS NULL OR f.created_at >= ${params.dateFrom ?? null})
      AND (${params.dateTo ?? null}::timestamptz IS NULL OR f.created_at <= ${params.dateTo ?? null})
    `;

    return prisma.$queryRaw<ParticipantConfirmedKpiRow[]>`
      SELECT
        v.formula_id,
        v.formula_no,
        v.participant_id,
        v.company_id,
        v.company_name,
        v.role_group,
        v.sequence_order,
        v.total_buy_amount,
        v.total_sell_amount,
        v.confirmed_in,
        v.confirmed_out,
        v.scheduled_in,
        v.scheduled_out,
        v.receivable,
        v.payable,
        v.confirmed_net_profit
      FROM v_participant_confirmed_kpi v
      INNER JOIN formulas f ON f.id = v.formula_id
      WHERE ${whereClause}
      ORDER BY f.created_at DESC, v.formula_id ASC, v.sequence_order ASC
      ${buildPaginationClause(params)}
    `;
  }

  async listUnmatchedPayments(params: DashboardListParams = {}): Promise<PaymentUnmatchedRow[]> {
    const whereClause = Prisma.sql`
      (${params.formulaId ?? null}::uuid IS NULL OR v.formula_id = ${params.formulaId ?? null}::uuid)
      AND (${params.dateFrom ?? null}::timestamptz IS NULL OR v.created_at >= ${params.dateFrom ?? null})
      AND (${params.dateTo ?? null}::timestamptz IS NULL OR v.created_at <= ${params.dateTo ?? null})
    `;

    return prisma.$queryRaw<PaymentUnmatchedRow[]>`
      SELECT
        v.id,
        v.formula_id,
        v.formula_no,
        v.direction,
        v.actual_amount,
        v.actual_date,
        v.bank_name,
        v.account_no,
        v.status,
        v.memo,
        v.created_at
      FROM v_payment_unmatched v
      WHERE ${whereClause}
      ORDER BY v.created_at DESC, v.formula_id ASC, v.id ASC
      ${buildPaginationClause(params)}
    `;
  }
}

export const dashboardRepository = new DashboardRepository();
