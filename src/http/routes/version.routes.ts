import type { FastifyInstance } from 'fastify';

import {
  createVersion,
  getLatestVersionByFormulaId,
  getVersionByFormulaIdAndVersionNo,
  getVersionById,
  listVersionsByFormulaId,
  type CreateVersionRequest,
} from '../../actions/version.actions.js';
import { runAction } from '../lib/handle-action.js';
import {
  formulaIdFromParam,
  requireFormulaScope,
  requireRole,
  resolveFormulaIdFromVersionId,
  ROLES_MANAGER_AND_ABOVE,
  ROLES_VIEWER_AND_ABOVE,
  withProtection,
} from '../plugins/rbac.js';

type CreateVersionBody = Omit<CreateVersionRequest, 'formula_id'>;

export async function registerVersionRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Params: { formulaId: string };
    Body: CreateVersionBody;
  }>(
    '/api/v1/formulas/:formulaId/versions',
    withProtection(
      requireRole(ROLES_MANAGER_AND_ABOVE),
      requireFormulaScope(formulaIdFromParam('formulaId')),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        createVersion({
          ...request.body,
          formula_id: request.params.formulaId,
        }),
      );

      if (result !== undefined) {
        return reply.status(201).send(result);
      }
    },
  );

  app.get<{ Params: { formulaId: string } }>(
    '/api/v1/formulas/:formulaId/versions/latest',
    withProtection(
      requireRole(ROLES_VIEWER_AND_ABOVE),
      requireFormulaScope(formulaIdFromParam('formulaId')),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        getLatestVersionByFormulaId(request.params.formulaId),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.get<{ Params: { formulaId: string; versionNo: string } }>(
    '/api/v1/formulas/:formulaId/versions/:versionNo',
    withProtection(
      requireRole(ROLES_VIEWER_AND_ABOVE),
      requireFormulaScope(formulaIdFromParam('formulaId')),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        getVersionByFormulaIdAndVersionNo(
          request.params.formulaId,
          Number(request.params.versionNo),
        ),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.get<{ Params: { formulaId: string } }>(
    '/api/v1/formulas/:formulaId/versions',
    withProtection(
      requireRole(ROLES_VIEWER_AND_ABOVE),
      requireFormulaScope(formulaIdFromParam('formulaId')),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        listVersionsByFormulaId(request.params.formulaId),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.get<{ Params: { versionId: string } }>(
    '/api/v1/versions/:versionId',
    withProtection(
      requireRole(ROLES_VIEWER_AND_ABOVE),
      requireFormulaScope(resolveFormulaIdFromVersionId),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () => getVersionById(request.params.versionId));

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );
}
