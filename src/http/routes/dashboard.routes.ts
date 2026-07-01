import type { FastifyInstance } from 'fastify';

import {
  getFormulaConfirmedKpi,
  getFormulaProfitEngine,
  getFormulaReceivablePayable,
  listParticipantConfirmedKpi,
  listUnmatchedPayments,
  type DashboardListRequest,
} from '../../actions/dashboard.actions.js';
import { runAction } from '../lib/handle-action.js';
import { getCompanyScopeFromRequest } from '../lib/company-scope-route.js';
import { requireCompanyContext } from '../plugins/company-context.js';
import {
  formulaIdFromParam,
  requireFormulaScope,
  requireRole,
  ROLES_VIEWER_AND_ABOVE,
  withProtection,
} from '../plugins/rbac.js';

function parseDashboardListQuery(query: Record<string, unknown>): DashboardListRequest {
  const result: DashboardListRequest = {};

  if (query.formula_id !== undefined && query.formula_id !== '') {
    result.formula_id = String(query.formula_id);
  }

  if (query.participant_id !== undefined && query.participant_id !== '') {
    result.participant_id = String(query.participant_id);
  }

  if (query.date_from !== undefined && query.date_from !== '') {
    result.date_from = String(query.date_from);
  }

  if (query.date_to !== undefined && query.date_to !== '') {
    result.date_to = String(query.date_to);
  }

  if (query.limit !== undefined && query.limit !== '') {
    result.limit = Number(query.limit);
  }

  if (query.offset !== undefined && query.offset !== '') {
    result.offset = Number(query.offset);
  }

  return result;
}

export async function registerDashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { formulaId: string } }>(
    '/api/v1/formulas/:formulaId/receivable-payable',
    withProtection(
      requireRole(ROLES_VIEWER_AND_ABOVE),
      requireCompanyContext(),
      requireFormulaScope(formulaIdFromParam('formulaId')),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        getFormulaReceivablePayable(
          request.params.formulaId,
          getCompanyScopeFromRequest(request),
        ),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.get<{ Params: { formulaId: string } }>(
    '/api/v1/formulas/:formulaId/kpi/confirmed',
    withProtection(
      requireRole(ROLES_VIEWER_AND_ABOVE),
      requireCompanyContext(),
      requireFormulaScope(formulaIdFromParam('formulaId')),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        getFormulaConfirmedKpi(
          request.params.formulaId,
          getCompanyScopeFromRequest(request),
        ),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.get<{ Params: { formulaId: string } }>(
    '/api/v1/formulas/:formulaId/kpi/expected',
    withProtection(
      requireRole(ROLES_VIEWER_AND_ABOVE),
      requireCompanyContext(),
      requireFormulaScope(formulaIdFromParam('formulaId')),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        getFormulaProfitEngine(
          request.params.formulaId,
          getCompanyScopeFromRequest(request),
        ),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.get<{
    Params: { formulaId: string };
    Querystring: Record<string, unknown>;
  }>(
    '/api/v1/formulas/:formulaId/kpi/participants',
    withProtection(
      requireRole(ROLES_VIEWER_AND_ABOVE),
      requireCompanyContext(),
      requireFormulaScope(formulaIdFromParam('formulaId')),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        listParticipantConfirmedKpi(
          {
            ...parseDashboardListQuery(request.query),
            formula_id: request.params.formulaId,
          },
          getCompanyScopeFromRequest(request),
        ),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.get<{ Querystring: Record<string, unknown> }>(
    '/api/v1/payments/unmatched',
    withProtection(requireRole(ROLES_VIEWER_AND_ABOVE), requireCompanyContext()),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        listUnmatchedPayments(
          parseDashboardListQuery(request.query),
          getCompanyScopeFromRequest(request),
        ),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );
}
