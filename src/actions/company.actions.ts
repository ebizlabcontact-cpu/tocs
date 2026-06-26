import type { Company } from '@prisma/client';

import {
  CompanyConflictError,
  CompanyNotFoundError,
  CompanyService,
  companyService,
} from '../services/company.service.js';
import type { CreateCompanyInput, ListCompaniesInput } from '../services/company.service.js';
import type {
  CompanyListResponse,
  CompanyResponse,
  CreateCompanyInputPayload,
  ListCompaniesInputPayload,
  ValidatedCreateCompanyInput,
  ValidatedListCompaniesInput,
} from '../types/company.types.js';
import {
  validateCompanyId,
  validateCreateCompany,
  validateListCompanies,
  ValidationError,
} from '../utils/company.validation.js';

import { ActionError } from './formula.actions.js';

export interface CreateCompanyRequest {
  company_name?: string | null;
  business_reg_no?: string | null;
  representative_name?: string | null;
  main_phone?: string | null;
  hq_address?: string | null;
  memo?: string | null;
}

export interface ListCompaniesQuery {
  page?: number | string;
  page_size?: number | string;
  is_active?: boolean | string;
}

function toCompanyResponse(company: Company): CompanyResponse {
  return {
    id: company.id,
    company_name: company.companyName,
    business_reg_no: company.businessRegNo,
    representative_name: company.representativeName,
    main_phone: company.mainPhone,
    hq_address: company.hqAddress,
    is_active: company.isActive,
    memo: company.memo,
    created_at: company.createdAt.toISOString(),
    updated_at: company.updatedAt.toISOString(),
  };
}

function mapCreateRequest(body: CreateCompanyRequest): CreateCompanyInputPayload {
  const payload: CreateCompanyInputPayload = {};

  if (body.company_name !== undefined) payload.companyName = body.company_name;
  if (body.business_reg_no !== undefined) payload.businessRegNo = body.business_reg_no;
  if (body.representative_name !== undefined) {
    payload.representativeName = body.representative_name;
  }
  if (body.main_phone !== undefined) payload.mainPhone = body.main_phone;
  if (body.hq_address !== undefined) payload.hqAddress = body.hq_address;
  if (body.memo !== undefined) payload.memo = body.memo;

  return payload;
}

function mapListQuery(query: ListCompaniesQuery): ListCompaniesInputPayload {
  const payload: ListCompaniesInputPayload = {};

  if (query.page !== undefined) payload.page = query.page;
  if (query.page_size !== undefined) payload.pageSize = query.page_size;
  if (query.is_active !== undefined) payload.isActive = query.is_active;

  return payload;
}

function toCreateCompanyInput(validated: ValidatedCreateCompanyInput): CreateCompanyInput {
  const input: CreateCompanyInput = {
    companyName: validated.companyName,
  };

  if (validated.businessRegNo !== undefined) input.businessRegNo = validated.businessRegNo;
  if (validated.representativeName !== undefined) {
    input.representativeName = validated.representativeName;
  }
  if (validated.mainPhone !== undefined) input.mainPhone = validated.mainPhone;
  if (validated.hqAddress !== undefined) input.hqAddress = validated.hqAddress;
  if (validated.memo !== undefined) input.memo = validated.memo;

  return input;
}

function toListCompaniesInput(validated: ValidatedListCompaniesInput): ListCompaniesInput {
  const input: ListCompaniesInput = {};

  if (validated.page !== undefined) input.page = validated.page;
  if (validated.pageSize !== undefined) input.pageSize = validated.pageSize;
  if (validated.isActive !== undefined) input.isActive = validated.isActive;

  return input;
}

function mapCompanyActionError(error: unknown): never {
  if (error instanceof ValidationError) {
    throw new ActionError(400, error.message);
  }

  if (error instanceof CompanyConflictError) {
    throw new ActionError(409, error.message);
  }

  if (error instanceof CompanyNotFoundError) {
    throw new ActionError(404, error.message);
  }

  throw error;
}

export class CompanyActions {
  constructor(private readonly service: CompanyService = companyService) {}

  async createCompany(body: CreateCompanyRequest): Promise<CompanyResponse> {
    try {
      const validated = validateCreateCompany(mapCreateRequest(body));
      const company = await this.service.createCompany(toCreateCompanyInput(validated));
      return toCompanyResponse(company);
    } catch (error) {
      mapCompanyActionError(error);
    }
  }

  async getCompanyById(companyId: string): Promise<CompanyResponse> {
    try {
      const { companyId: validatedId } = validateCompanyId({ companyId });
      const company = await this.service.getCompanyById(validatedId);
      return toCompanyResponse(company);
    } catch (error) {
      mapCompanyActionError(error);
    }
  }

  async listCompanies(query: ListCompaniesQuery = {}): Promise<CompanyListResponse> {
    try {
      const validated = validateListCompanies(mapListQuery(query));
      const result = await this.service.listCompanies(toListCompaniesInput(validated));

      return {
        items: result.items.map(toCompanyResponse),
        total: result.total,
        page: result.page,
        page_size: result.pageSize,
      };
    } catch (error) {
      mapCompanyActionError(error);
    }
  }
}

export const companyActions = new CompanyActions();

export async function createCompany(body: CreateCompanyRequest): Promise<CompanyResponse> {
  return companyActions.createCompany(body);
}

export async function getCompanyById(companyId: string): Promise<CompanyResponse> {
  return companyActions.getCompanyById(companyId);
}

export async function listCompanies(query: ListCompaniesQuery = {}): Promise<CompanyListResponse> {
  return companyActions.listCompanies(query);
}
