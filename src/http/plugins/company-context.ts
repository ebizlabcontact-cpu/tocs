import type { FastifyInstance, FastifyRequest } from 'fastify';
import { MembershipRole } from '@prisma/client';

import { ActionError } from '../../actions/formula.actions.js';
import { sendActionError } from '../lib/handle-action.js';
import type { RequestAuthContext } from '../types/auth-request.js';
import type { RequestCompanyContext } from '../types/company-context-request.js';
import { RBAC_AUTHENTICATION_REQUIRED, RBAC_FORBIDDEN } from './rbac.js';

export const COMPANY_CONTEXT_INVALID_COMPANY_ID = 'Invalid company id';
export const COMPANY_CONTEXT_HEADERS_CONFLICT = 'Company context headers conflict';
export const COMPANY_CONTEXT_INVALID_SCOPE = 'Invalid company scope';

const HEADER_COMPANY_ID = 'x-company-id';
const HEADER_COMPANY_SCOPE = 'x-company-scope';
const SCOPE_ALL = 'all';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PUBLIC_ROUTES = new Set<string>([
  'GET /api/v1/health',
  'POST /api/v1/auth/login',
  'POST /api/v1/auth/refresh',
  'POST /api/v1/auth/logout',
]);

function normalizePath(url: string): string {
  const queryIndex = url.indexOf('?');
  return queryIndex === -1 ? url : url.slice(0, queryIndex);
}

function isPublicRoute(request: FastifyRequest): boolean {
  const key = `${request.method} ${normalizePath(request.url)}`;
  return PUBLIC_ROUTES.has(key);
}

function readHeader(request: FastifyRequest, headerName: string): string | undefined {
  const value = request.headers[headerName];

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isSuperAdmin(auth: RequestAuthContext): boolean {
  return auth.roles.includes(MembershipRole.SUPER_ADMIN);
}

function hasActiveMembership(auth: RequestAuthContext, companyId: string): boolean {
  return auth.memberships.some((membership) => membership.company_id === companyId);
}

function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export async function registerCompanyContext(app: FastifyInstance): Promise<void> {
  app.decorateRequest('companyContext', null);

  app.addHook('onRequest', async (request, reply) => {
    request.companyContext = null;

    if (isPublicRoute(request)) {
      return;
    }

    const companyIdHeader = readHeader(request, HEADER_COMPANY_ID);
    const companyScopeHeader = readHeader(request, HEADER_COMPANY_SCOPE);

    if (companyIdHeader === undefined && companyScopeHeader === undefined) {
      return;
    }

    if (request.auth === null) {
      sendActionError(reply, new ActionError(401, RBAC_AUTHENTICATION_REQUIRED));
      return;
    }

    if (companyIdHeader !== undefined && companyScopeHeader !== undefined) {
      sendActionError(reply, new ActionError(400, COMPANY_CONTEXT_HEADERS_CONFLICT));
      return;
    }

    if (companyScopeHeader !== undefined) {
      if (companyScopeHeader.toLowerCase() !== SCOPE_ALL) {
        sendActionError(reply, new ActionError(400, COMPANY_CONTEXT_INVALID_SCOPE));
        return;
      }

      if (!isSuperAdmin(request.auth)) {
        sendActionError(reply, new ActionError(403, RBAC_FORBIDDEN));
        return;
      }

      request.companyContext = { mode: 'all', companyId: null };
      return;
    }

    if (companyIdHeader !== undefined) {
      if (!isValidUuid(companyIdHeader)) {
        sendActionError(reply, new ActionError(400, COMPANY_CONTEXT_INVALID_COMPANY_ID));
        return;
      }

      if (!isSuperAdmin(request.auth) && !hasActiveMembership(request.auth, companyIdHeader)) {
        sendActionError(reply, new ActionError(403, RBAC_FORBIDDEN));
        return;
      }

      request.companyContext = { mode: 'company', companyId: companyIdHeader };
    }
  });
}

export type { RequestCompanyContext };
