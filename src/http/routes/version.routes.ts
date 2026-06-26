import type { FastifyInstance } from 'fastify';

import {
  createVersion,
  getLatestVersionByFormulaId,
  getVersionById,
  listVersionsByFormulaId,
  type CreateVersionRequest,
} from '../../actions/version.actions.js';
import { runAction } from '../lib/handle-action.js';

type CreateVersionBody = Omit<CreateVersionRequest, 'formula_id'>;

export async function registerVersionRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Params: { formulaId: string };
    Body: CreateVersionBody;
  }>('/api/v1/formulas/:formulaId/versions', async (request, reply) => {
    const result = await runAction(reply, () =>
      createVersion({
        ...request.body,
        formula_id: request.params.formulaId,
      }),
    );

    if (result !== undefined) {
      return reply.status(201).send(result);
    }
  });

  app.get<{ Params: { formulaId: string } }>(
    '/api/v1/formulas/:formulaId/versions/latest',
    async (request, reply) => {
      const result = await runAction(reply, () =>
        getLatestVersionByFormulaId(request.params.formulaId),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.get<{ Params: { formulaId: string } }>(
    '/api/v1/formulas/:formulaId/versions',
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
    async (request, reply) => {
      const result = await runAction(reply, () => getVersionById(request.params.versionId));

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );
}
