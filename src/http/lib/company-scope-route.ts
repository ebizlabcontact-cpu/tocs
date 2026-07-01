import type { FastifyRequest } from 'fastify';

import type { CompanyScopeFilter } from '../../types/company-scope.types.js';
import { toCompanyScopeFilter } from '../../utils/company-scope.js';

export function getCompanyScopeFromRequest(request: FastifyRequest): CompanyScopeFilter {
  if (request.companyContext === null) {
    throw new Error('Company context is required');
  }

  return toCompanyScopeFilter(request.companyContext);
}
