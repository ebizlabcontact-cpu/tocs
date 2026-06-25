import type { FastifyInstance } from 'fastify';

import {
  createSettlementNote,
  createSettlementPaymentSchedule,
  type CreateSettlementNoteRequest,
  type CreateSettlementPaymentScheduleRequest,
} from '../../actions/settlement.actions.js';
import { runAction } from '../lib/handle-action.js';

export async function registerSettlementRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Params: { formulaId: string };
    Body: CreateSettlementPaymentScheduleRequest;
  }>(
    '/api/v1/formulas/:formulaId/settlement/payment-schedules',
    async (request, reply) => {
      const result = await runAction(reply, () =>
        createSettlementPaymentSchedule(request.params.formulaId, request.body),
      );

      if (result !== undefined) {
        return reply.status(201).send(result);
      }
    },
  );

  app.post<{
    Params: { formulaId: string };
    Body: CreateSettlementNoteRequest;
  }>('/api/v1/formulas/:formulaId/settlement/notes', async (request, reply) => {
    const result = await runAction(reply, () =>
      createSettlementNote(request.params.formulaId, request.body),
    );

    if (result !== undefined) {
      return reply.status(201).send(result);
    }
  });
}
