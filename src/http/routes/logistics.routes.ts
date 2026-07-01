import type { FastifyInstance } from 'fastify';

import {
  createLogistics,
  getLogisticsById,
  listLogisticsByFormulaId,
  updateLogisticsStatus,
  type CreateLogisticsRequest,
  type UpdateLogisticsStatusRequest,
} from '../../actions/logistics.actions.js';
import { runAction } from '../lib/handle-action.js';
import { getCompanyScopeFromRequest } from '../lib/company-scope-route.js';
import { requireCompanyContext } from '../plugins/company-context.js';
import {
  formulaIdFromParam,
  requireFormulaScope,
  requireRole,
  resolveFormulaIdFromLogisticsId,
  ROLES_MANAGER_AND_ABOVE,
  ROLES_VIEWER_AND_ABOVE,
  withProtection,
} from '../plugins/rbac.js';

export async function registerLogisticsRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Params: { formulaId: string };
    Body: CreateLogisticsRequest;
  }>(
    '/api/v1/formulas/:formulaId/logistics',
    withProtection(
      requireRole(ROLES_MANAGER_AND_ABOVE),
      requireFormulaScope(formulaIdFromParam('formulaId')),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        createLogistics(request.params.formulaId, request.body),
      );

      if (result !== undefined) {
        return reply.status(201).send(result);
      }
    },
  );

  app.get<{ Params: { formulaId: string } }>(
    '/api/v1/formulas/:formulaId/logistics',
    withProtection(
      requireRole(ROLES_VIEWER_AND_ABOVE),
      requireCompanyContext(),
      requireFormulaScope(formulaIdFromParam('formulaId')),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        listLogisticsByFormulaId(
          request.params.formulaId,
          getCompanyScopeFromRequest(request),
        ),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.get<{ Params: { logisticsId: string } }>(
    '/api/v1/logistics/:logisticsId',
    withProtection(
      requireRole(ROLES_VIEWER_AND_ABOVE),
      requireFormulaScope(resolveFormulaIdFromLogisticsId),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        getLogisticsById(request.params.logisticsId),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.patch<{
    Params: { formulaId: string };
    Body: UpdateLogisticsStatusRequest;
  }>(
    '/api/v1/formulas/:formulaId/logistics-status',
    withProtection(
      requireRole(ROLES_MANAGER_AND_ABOVE),
      requireFormulaScope(formulaIdFromParam('formulaId')),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        updateLogisticsStatus(request.params.formulaId, request.body),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );
}
