import { type Company, type Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma.js';

/** id는 DB DEFAULT gen_random_uuid()에 위임 — Repository 입력에서 제외 */
export type CompanyCreateData = Omit<
  Prisma.CompanyUncheckedCreateInput,
  | 'id'
  | 'contacts'
  | 'participants'
  | 'paymentSchedulesAsCounterparty'
  | 'paymentRecordsAsCounterparty'
  | 'logisticsAsCarrier'
  | 'logisticsAsDeparture'
  | 'logisticsAsArrival'
  | 'logisticsAsCostBearer'
  | 'invoicesAsIssuer'
  | 'invoicesAsReceiver'
  | 'sharesAsTarget'
>;

export interface CompanyListParams {
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CompanyListResult {
  items: Company[];
  total: number;
  page: number;
  pageSize: number;
}

export class CompanyRepository {
  async createCompany(data: CompanyCreateData): Promise<Company> {
    return prisma.company.create({ data });
  }

  async findCompanyById(id: string): Promise<Company | null> {
    return prisma.company.findUnique({ where: { id } });
  }

  async findCompanyByBusinessRegNo(businessRegNo: string): Promise<Company | null> {
    return prisma.company.findUnique({ where: { businessRegNo } });
  }

  async listCompanies(params: CompanyListParams = {}): Promise<CompanyListResult> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 20;
    const where = this.buildListWhere(params);

    const [items, total] = await Promise.all([
      prisma.company.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.company.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  private buildListWhere(params: CompanyListParams): Prisma.CompanyWhereInput {
    const where: Prisma.CompanyWhereInput = {};

    if (params.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    return where;
  }
}

export const companyRepository = new CompanyRepository();
