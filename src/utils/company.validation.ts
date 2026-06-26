import type {
  CreateCompanyInputPayload,
  ListCompaniesInputPayload,
  ValidatedCreateCompanyInput,
  ValidatedListCompaniesInput,
} from '../types/company.types.js';

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

function assertMaxLength(value: string, max: number, field: string): void {
  if (value.length > max) {
    throw new ValidationError(`${field} must be at most ${max} characters`, field);
  }
}

function assertRequiredCompanyName(value: string | null | undefined): string {
  if (value === undefined || value === null) {
    throw new ValidationError('companyName is required', 'companyName');
  }

  const trimmed = value.trim();

  if (trimmed === '') {
    throw new ValidationError('companyName must not be empty', 'companyName');
  }

  assertMaxLength(trimmed, 200, 'companyName');

  return trimmed;
}

function assertNullableString(
  value: string | null,
  field: string,
  maxLength?: number,
): string | null {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();

  if (maxLength !== undefined) {
    assertMaxLength(trimmed, maxLength, field);
  }

  return trimmed;
}

function parseOptionalInteger(
  value: number | string | null | undefined,
  field: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    throw new ValidationError(`${field} must be an integer`, field);
  }

  const numeric = typeof value === 'number' ? value : Number(value);

  if (!Number.isInteger(numeric)) {
    throw new ValidationError(`${field} must be an integer`, field);
  }

  return numeric;
}

function parseOptionalBoolean(
  value: boolean | string | null | undefined,
  field: string,
): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    throw new ValidationError(`${field} must be a boolean`, field);
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = value.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw new ValidationError(`${field} must be a boolean`, field);
}

export function validateCreateCompany(
  input: CreateCompanyInputPayload,
): ValidatedCreateCompanyInput {
  const companyName = assertRequiredCompanyName(input.companyName);

  const validated: ValidatedCreateCompanyInput = { companyName };

  if (input.businessRegNo !== undefined) {
    validated.businessRegNo = assertNullableString(input.businessRegNo, 'businessRegNo', 20);
  }

  if (input.representativeName !== undefined) {
    validated.representativeName = assertNullableString(
      input.representativeName,
      'representativeName',
      100,
    );
  }

  if (input.mainPhone !== undefined) {
    validated.mainPhone = assertNullableString(input.mainPhone, 'mainPhone', 30);
  }

  if (input.hqAddress !== undefined) {
    validated.hqAddress = assertNullableString(input.hqAddress, 'hqAddress');
  }

  if (input.memo !== undefined) {
    validated.memo = assertNullableString(input.memo, 'memo');
  }

  return validated;
}

export function validateListCompanies(
  input: ListCompaniesInputPayload = {},
): ValidatedListCompaniesInput {
  const validated: ValidatedListCompaniesInput = {};

  const page = parseOptionalInteger(input.page, 'page');

  if (page !== undefined) {
    if (page < 1) {
      throw new ValidationError('page must be greater than or equal to 1', 'page');
    }

    validated.page = page;
  }

  const pageSize = parseOptionalInteger(input.pageSize, 'pageSize');

  if (pageSize !== undefined) {
    if (pageSize < 1 || pageSize > 100) {
      throw new ValidationError('pageSize must be between 1 and 100', 'pageSize');
    }

    validated.pageSize = pageSize;
  }

  const isActive = parseOptionalBoolean(input.isActive, 'isActive');

  if (isActive !== undefined) {
    validated.isActive = isActive;
  }

  return validated;
}

export function validateCompanyId(input: {
  companyId?: string | null;
}): { companyId: string } {
  if (input.companyId === undefined || input.companyId === null) {
    throw new ValidationError('companyId is required', 'companyId');
  }

  const companyId = input.companyId.trim();

  if (companyId === '') {
    throw new ValidationError('companyId must not be empty', 'companyId');
  }

  return { companyId };
}
