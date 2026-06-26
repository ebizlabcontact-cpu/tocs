import type { FastifyInstance } from 'fastify';

import type { TradeStatus } from '@prisma/client';

import { getFormulaCloseStatus } from '../../actions/close.actions.js';
import {
  createFormula,
  getFormulaById,
  listFormulas,
  type CreateFormulaRequest,
  type ListFormulasQuery,
} from '../../actions/formula.actions.js';
import { runAction } from '../lib/handle-action.js';

function parseListFormulasQuery(query: Record<string, unknown>): ListFormulasQuery {
  const result: ListFormulasQuery = {};

  if (query.trade_status !== undefined && query.trade_status !== '') {
    result.trade_status = String(query.trade_status) as TradeStatus;
  }

  if (query.is_closed !== undefined && query.is_closed !== '') {
    const raw = String(query.is_closed).toLowerCase();
    if (raw === 'true') {
      result.is_closed = true;
    } else if (raw === 'false') {
      result.is_closed = false;
    }
  }

  if (query.created_after !== undefined && query.created_after !== '') {
    result.created_after = String(query.created_after);
  }

  if (query.created_before !== undefined && query.created_before !== '') {
    result.created_before = String(query.created_before);
  }

  if (query.page !== undefined && query.page !== '') {
    result.page = Number(query.page);
  }

  if (query.page_size !== undefined && query.page_size !== '') {
    result.page_size = Number(query.page_size);
  }

  return result;
}

export async function registerFormulaRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: CreateFormulaRequest }>('/api/v1/formulas', async (request, reply) => {
    const result = await runAction(reply, () => createFormula(request.body));

    if (result !== undefined) {
      return reply.status(201).send(result);
    }
  });

  app.get<{ Querystring: Record<string, unknown> }>('/api/v1/formulas', async (request, reply) => {
    const result = await runAction(reply, () =>
      listFormulas(parseListFormulasQuery(request.query)),
    );

    if (result !== undefined) {
      return reply.send(result);
    }
  });

  app.get<{ Params: { formulaId: string } }>(
    '/api/v1/formulas/:formulaId/status',
    async (request, reply) => {
      const result = await runAction(reply, () =>
        getFormulaCloseStatus(request.params.formulaId),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.get<{ Params: { formulaId: string } }>(
    '/api/v1/formulas/:formulaId',
    async (request, reply) => {
      const result = await runAction(reply, () => getFormulaById(request.params.formulaId));

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );
}
