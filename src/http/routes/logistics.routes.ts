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

export async function registerLogisticsRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Params: { formulaId: string };
    Body: CreateLogisticsRequest;
  }>('/api/v1/formulas/:formulaId/logistics', async (request, reply) => {
    const result = await runAction(reply, () =>
      createLogistics(request.params.formulaId, request.body),
    );

    if (result !== undefined) {
      return reply.status(201).send(result);
    }
  });

  app.get<{ Params: { formulaId: string } }>(
    '/api/v1/formulas/:formulaId/logistics',
    async (request, reply) => {
      const result = await runAction(reply, () =>
        listLogisticsByFormulaId(request.params.formulaId),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.get<{ Params: { logisticsId: string } }>(
    '/api/v1/logistics/:logisticsId',
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
  }>('/api/v1/formulas/:formulaId/logistics-status', async (request, reply) => {
    const result = await runAction(reply, () =>
      updateLogisticsStatus(request.params.formulaId, request.body),
    );

    if (result !== undefined) {
      return reply.send(result);
    }
  });
}
