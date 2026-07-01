import type { RequestCompanyContext } from '../http/types/company-context-request.js';
import type { CompanyScopeFilter } from '../types/company-scope.types.js';

export function toCompanyScopeFilter(context: RequestCompanyContext): CompanyScopeFilter {
  return {
    mode: context.mode,
    companyId: context.companyId,
  };
}

export function resolveScopeCompanyId(scope?: CompanyScopeFilter): string | undefined {
  if (scope?.mode === 'company' && scope.companyId) {
    return scope.companyId;
  }

  return undefined;
}
