import type { FastifyInstance } from 'fastify';

import {
  getFormulaConfirmedKpi,
  getFormulaProfitEngine,
  listParticipantConfirmedKpi,
  listUnmatchedPayments,
  type DashboardListRequest,
} from '../../actions/dashboard.actions.js';
import { runAction } from '../lib/handle-action.js';

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
    '/api/v1/formulas/:formulaId/kpi/confirmed',
    async (request, reply) => {
      const result = await runAction(reply, () =>
        getFormulaConfirmedKpi(request.params.formulaId),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.get<{ Params: { formulaId: string } }>(
    '/api/v1/formulas/:formulaId/kpi/expected',
    async (request, reply) => {
      const result = await runAction(reply, () =>
        getFormulaProfitEngine(request.params.formulaId),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.get<{
    Params: { formulaId: string };
    Querystring: Record<string, unknown>;
  }>('/api/v1/formulas/:formulaId/kpi/participants', async (request, reply) => {
    const result = await runAction(reply, () =>
      listParticipantConfirmedKpi({
        ...parseDashboardListQuery(request.query),
        formula_id: request.params.formulaId,
      }),
    );

    if (result !== undefined) {
      return reply.send(result);
    }
  });

  app.get<{ Querystring: Record<string, unknown> }>(
    '/api/v1/payments/unmatched',
    async (request, reply) => {
      const result = await runAction(reply, () =>
        listUnmatchedPayments(parseDashboardListQuery(request.query)),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );
}
