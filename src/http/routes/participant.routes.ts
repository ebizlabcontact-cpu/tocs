import type { FastifyInstance } from 'fastify';

import {
  createParticipant,
  getParticipantById,
  listParticipantsByFormulaId,
  type CreateParticipantRequest,
} from '../../actions/participant.actions.js';
import { runAction } from '../lib/handle-action.js';
import { getCompanyScopeFromRequest } from '../lib/company-scope-route.js';
import { requireCompanyContext } from '../plugins/company-context.js';
import {
  formulaIdFromParam,
  requireFormulaScope,
  requireRole,
  resolveFormulaIdFromParticipantId,
  ROLES_MANAGER_AND_ABOVE,
  ROLES_VIEWER_AND_ABOVE,
  withProtection,
} from '../plugins/rbac.js';

export async function registerParticipantRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Params: { formulaId: string };
    Body: CreateParticipantRequest;
  }>(
    '/api/v1/formulas/:formulaId/participants',
    withProtection(
      requireRole(ROLES_MANAGER_AND_ABOVE),
      requireFormulaScope(formulaIdFromParam('formulaId')),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        createParticipant(request.params.formulaId, request.body),
      );

      if (result !== undefined) {
        return reply.status(201).send(result);
      }
    },
  );

  app.get<{ Params: { formulaId: string } }>(
    '/api/v1/formulas/:formulaId/participants',
    withProtection(
      requireRole(ROLES_VIEWER_AND_ABOVE),
      requireCompanyContext(),
      requireFormulaScope(formulaIdFromParam('formulaId')),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        listParticipantsByFormulaId(
          request.params.formulaId,
          getCompanyScopeFromRequest(request),
        ),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.get<{ Params: { participantId: string } }>(
    '/api/v1/participants/:participantId',
    withProtection(
      requireRole(ROLES_VIEWER_AND_ABOVE),
      requireFormulaScope(resolveFormulaIdFromParticipantId),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        getParticipantById(request.params.participantId),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );
}
