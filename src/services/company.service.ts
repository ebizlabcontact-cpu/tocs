import {
  CompanyRepository,
  companyRepository,
} from '../repositories/company.repository.js';
import type {
  CompanyCreateData,
  CompanyListParams,
  CompanyListResult,
} from '../repositories/company.repository.js';
import type { CompanyScopeFilter } from '../types/company-scope.types.js';
import { resolveScopeCompanyId } from '../utils/company-scope.js';

export class CompanyNotFoundError extends Error {
  readonly status = 404 as const;

  constructor(id: string) {
    super(`Company not found: ${id}`);
    this.name = 'CompanyNotFoundError';
  }
}

export class CompanyConflictError extends Error {
  readonly status = 409 as const;

  constructor(businessRegNo: string) {
    super(`business_reg_no already exists: ${businessRegNo}`);
    this.name = 'CompanyConflictError';
  }
}

export interface CreateCompanyInput {
  companyName: string;
  businessRegNo?: string | null;
  representativeName?: string | null;
  mainPhone?: string | null;
  hqAddress?: string | null;
  memo?: string | null;
}

export interface ListCompaniesInput {
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  companyScope?: CompanyScopeFilter;
}

export class CompanyService {
  constructor(private readonly repository: CompanyRepository = companyRepository) {}

  async createCompany(input: CreateCompanyInput) {
    if (input.businessRegNo !== undefined && input.businessRegNo !== null) {
      const existing = await this.repository.findCompanyByBusinessRegNo(input.businessRegNo);

      if (existing) {
        throw new CompanyConflictError(input.businessRegNo);
      }
    }

    const data: CompanyCreateData = {
      companyName: input.companyName,
    };

    if (input.businessRegNo !== undefined) data.businessRegNo = input.businessRegNo;
    if (input.representativeName !== undefined) {
      data.representativeName = input.representativeName;
    }
    if (input.mainPhone !== undefined) data.mainPhone = input.mainPhone;
    if (input.hqAddress !== undefined) data.hqAddress = input.hqAddress;
    if (input.memo !== undefined) data.memo = input.memo;

    return this.repository.createCompany(data);
  }

  async getCompanyById(companyId: string) {
    const company = await this.repository.findCompanyById(companyId);

    if (!company) {
      throw new CompanyNotFoundError(companyId);
    }

    return company;
  }

  async listCompanies(input: ListCompaniesInput = {}): Promise<CompanyListResult> {
    const params: CompanyListParams = {};

    if (input.isActive !== undefined) params.isActive = input.isActive;
    if (input.page !== undefined) params.page = input.page;
    if (input.pageSize !== undefined) params.pageSize = input.pageSize;

    const scopeCompanyId = resolveScopeCompanyId(input.companyScope);
    if (scopeCompanyId !== undefined) {
      params.scopeCompanyId = scopeCompanyId;
    }

    return this.repository.listCompanies(params);
  }
}

export const companyService = new CompanyService();
