import type { FastifyInstance } from 'fastify';

import {
  createShare,
  deleteShare,
  getShareById,
  listSharesByFormulaId,
  updateShare,
  type CreateShareRequest,
  type DeleteShareRequest,
  type UpdateShareRequest,
} from '../../actions/share.actions.js';
import { runAction } from '../lib/handle-action.js';
import {
  formulaIdFromParam,
  requireFormulaScope,
  requireRole,
  resolveFormulaIdFromShareId,
  ROLES_MANAGER_AND_ABOVE,
  ROLES_VIEWER_AND_ABOVE,
  withProtection,
} from '../plugins/rbac.js';

export async function registerShareRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Params: { formulaId: string };
    Body: CreateShareRequest;
  }>(
    '/api/v1/formulas/:formulaId/shares',
    withProtection(
      requireRole(ROLES_MANAGER_AND_ABOVE),
      requireFormulaScope(formulaIdFromParam('formulaId')),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        createShare(request.params.formulaId, request.body),
      );

      if (result !== undefined) {
        return reply.status(201).send(result);
      }
    },
  );

  app.get<{ Params: { formulaId: string } }>(
    '/api/v1/formulas/:formulaId/shares',
    withProtection(
      requireRole(ROLES_VIEWER_AND_ABOVE),
      requireFormulaScope(formulaIdFromParam('formulaId')),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        listSharesByFormulaId(request.params.formulaId),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.get<{ Params: { shareId: string } }>(
    '/api/v1/shares/:shareId',
    withProtection(
      requireRole(ROLES_VIEWER_AND_ABOVE),
      requireFormulaScope(resolveFormulaIdFromShareId),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () => getShareById(request.params.shareId));

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.patch<{
    Params: { shareId: string };
    Body: UpdateShareRequest;
  }>(
    '/api/v1/shares/:shareId',
    withProtection(
      requireRole(ROLES_MANAGER_AND_ABOVE),
      requireFormulaScope(resolveFormulaIdFromShareId),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        updateShare(request.params.shareId, request.body),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.delete<{
    Params: { shareId: string };
    Body: DeleteShareRequest;
  }>(
    '/api/v1/shares/:shareId',
    withProtection(
      requireRole(ROLES_MANAGER_AND_ABOVE),
      requireFormulaScope(resolveFormulaIdFromShareId),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        deleteShare(request.params.shareId, request.body),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );
}
