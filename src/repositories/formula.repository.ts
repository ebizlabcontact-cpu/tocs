import { type Formula, type Prisma, type TradeStatus } from '@prisma/client';

import { prisma } from '../lib/prisma.js';

/** formula_no는 DB DEFAULT generate_formula_no()에 위임 — Repository 입력에서 제외 */
export type FormulaCreateData = Omit<
  Prisma.FormulaUncheckedCreateInput,
  | 'id'
  | 'formulaNo'
  | 'participants'
  | 'paymentSchedules'
  | 'paymentRecords'
  | 'logistics'
  | 'invoices'
  | 'shares'
  | 'versions'
  | 'calculationSnapshots'
  | 'statusLogs'
>;

export interface FormulaListParams {
  tradeStatus?: TradeStatus;
  isClosed?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  page?: number;
  pageSize?: number;
}

export interface FormulaListResult {
  items: Formula[];
  total: number;
  page: number;
  pageSize: number;
}

export class FormulaRepository {
  async create(data: FormulaCreateData): Promise<Formula> {
    return prisma.formula.create({ data });
  }

  async findById(id: string): Promise<Formula | null> {
    return prisma.formula.findUnique({ where: { id } });
  }

  async findByFormulaNo(formulaNo: string): Promise<Formula | null> {
    return prisma.formula.findUnique({ where: { formulaNo } });
  }

  async list(params: FormulaListParams = {}): Promise<FormulaListResult> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const where = this.buildListWhere(params);

    const [items, total] = await Promise.all([
      prisma.formula.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.formula.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  private buildListWhere(params: FormulaListParams): Prisma.FormulaWhereInput {
    const where: Prisma.FormulaWhereInput = {};

    if (params.tradeStatus !== undefined) {
      where.tradeStatus = params.tradeStatus;
    }

    if (params.isClosed !== undefined) {
      where.isClosed = params.isClosed;
    }

    if (params.createdAfter !== undefined || params.createdBefore !== undefined) {
      where.createdAt = {
        ...(params.createdAfter !== undefined && { gte: params.createdAfter }),
        ...(params.createdBefore !== undefined && { lte: params.createdBefore }),
      };
    }

    return where;
  }
}

export const formulaRepository = new FormulaRepository();
