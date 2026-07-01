import type { FastifyInstance } from 'fastify';

import {
  createCompany,
  getCompanyById,
  listCompanies,
  type CreateCompanyRequest,
  type ListCompaniesQuery,
} from '../../actions/company.actions.js';
import { runAction } from '../lib/handle-action.js';
import { getCompanyScopeFromRequest } from '../lib/company-scope-route.js';
import { requireCompanyContext } from '../plugins/company-context.js';
import {
  companyIdFromParam,
  requireCompanyScope,
  requireRole,
  ROLES_COMPANY_ADMIN_AND_ABOVE,
  ROLES_VIEWER_AND_ABOVE,
  withProtection,
} from '../plugins/rbac.js';

function parseListCompaniesQuery(query: Record<string, unknown>): ListCompaniesQuery {
  const result: ListCompaniesQuery = {};

  if (query.page !== undefined && query.page !== '') {
    result.page = Number(query.page);
  }

  if (query.page_size !== undefined && query.page_size !== '') {
    result.page_size = Number(query.page_size);
  }

  if (query.is_active !== undefined && query.is_active !== '') {
    const raw = String(query.is_active).toLowerCase();
    if (raw === 'true') {
      result.is_active = true;
    } else if (raw === 'false') {
      result.is_active = false;
    } else {
      result.is_active = String(query.is_active);
    }
  }

  return result;
}

export async function registerCompanyRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: CreateCompanyRequest }>(
    '/api/v1/companies',
    withProtection(requireRole(ROLES_COMPANY_ADMIN_AND_ABOVE)),
    async (request, reply) => {
      const result = await runAction(reply, () => createCompany(request.body));

      if (result !== undefined) {
        return reply.status(201).send(result);
      }
    },
  );

  app.get<{ Querystring: Record<string, unknown> }>(
    '/api/v1/companies',
    withProtection(requireRole(ROLES_VIEWER_AND_ABOVE), requireCompanyContext()),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        listCompanies(parseListCompaniesQuery(request.query), getCompanyScopeFromRequest(request)),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.get<{ Params: { companyId: string } }>(
    '/api/v1/companies/:companyId',
    withProtection(
      requireRole(ROLES_VIEWER_AND_ABOVE),
      requireCompanyScope(companyIdFromParam('companyId')),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () => getCompanyById(request.params.companyId));

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );
}
