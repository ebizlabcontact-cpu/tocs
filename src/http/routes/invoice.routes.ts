import type { FastifyInstance } from 'fastify';

import {
  createInvoice,
  getInvoiceById,
  listInvoicesByFormulaId,
  updateInvoiceStatus,
  type CreateInvoiceRequest,
  type UpdateInvoiceStatusRequest,
} from '../../actions/invoice.actions.js';
import { runAction } from '../lib/handle-action.js';

export async function registerInvoiceRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Params: { formulaId: string };
    Body: CreateInvoiceRequest;
  }>('/api/v1/formulas/:formulaId/invoices', async (request, reply) => {
    const result = await runAction(reply, () =>
      createInvoice(request.params.formulaId, request.body),
    );

    if (result !== undefined) {
      return reply.status(201).send(result);
    }
  });

  app.get<{ Params: { formulaId: string } }>(
    '/api/v1/formulas/:formulaId/invoices',
    async (request, reply) => {
      const result = await runAction(reply, () =>
        listInvoicesByFormulaId(request.params.formulaId),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.get<{ Params: { invoiceId: string } }>(
    '/api/v1/invoices/:invoiceId',
    async (request, reply) => {
      const result = await runAction(reply, () => getInvoiceById(request.params.invoiceId));

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.patch<{
    Params: { invoiceId: string };
    Body: UpdateInvoiceStatusRequest;
  }>('/api/v1/invoices/:invoiceId/status', async (request, reply) => {
    const result = await runAction(reply, () =>
      updateInvoiceStatus(request.params.invoiceId, request.body),
    );

    if (result !== undefined) {
      return reply.send(result);
    }
  });
}
