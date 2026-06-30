import type { FastifyInstance } from 'fastify';

import { closeFormula, type CloseFormulaRequest } from '../../actions/close.actions.js';
import { runAction } from '../lib/handle-action.js';
import {
  formulaIdFromParam,
  requireFormulaScope,
  requireRole,
  ROLES_COMPANY_ADMIN_AND_ABOVE,
  withProtection,
} from '../plugins/rbac.js';

export async function registerCloseRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Params: { formulaId: string };
    Body: CloseFormulaRequest;
  }>(
    '/api/v1/formulas/:formulaId/close',
    withProtection(
      requireRole(ROLES_COMPANY_ADMIN_AND_ABOVE),
      requireFormulaScope(formulaIdFromParam('formulaId')),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        closeFormula(request.params.formulaId, request.body),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );
}
