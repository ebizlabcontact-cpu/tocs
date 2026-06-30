import type { FastifyInstance } from 'fastify';

import {
  createInvoice,
  getFormulaInvoiceStatus,
  getInvoiceById,
  listInvoicesByFormulaId,
  updateInvoiceStatus,
  type CreateInvoiceRequest,
  type UpdateInvoiceStatusRequest,
} from '../../actions/invoice.actions.js';
import { runAction } from '../lib/handle-action.js';
import {
  formulaIdFromParam,
  requireFormulaScope,
  requireRole,
  resolveFormulaIdFromInvoiceId,
  ROLES_MANAGER_AND_ABOVE,
  ROLES_VIEWER_AND_ABOVE,
  withProtection,
} from '../plugins/rbac.js';

export async function registerInvoiceRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Params: { formulaId: string };
    Body: CreateInvoiceRequest;
  }>(
    '/api/v1/formulas/:formulaId/invoices',
    withProtection(
      requireRole(ROLES_MANAGER_AND_ABOVE),
      requireFormulaScope(formulaIdFromParam('formulaId')),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        createInvoice(request.params.formulaId, request.body),
      );

      if (result !== undefined) {
        return reply.status(201).send(result);
      }
    },
  );

  app.get<{ Params: { formulaId: string } }>(
    '/api/v1/formulas/:formulaId/invoices/status',
    withProtection(
      requireRole(ROLES_VIEWER_AND_ABOVE),
      requireFormulaScope(formulaIdFromParam('formulaId')),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        getFormulaInvoiceStatus(request.params.formulaId),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.get<{ Params: { formulaId: string } }>(
    '/api/v1/formulas/:formulaId/invoices',
    withProtection(
      requireRole(ROLES_VIEWER_AND_ABOVE),
      requireFormulaScope(formulaIdFromParam('formulaId')),
    ),
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
    withProtection(
      requireRole(ROLES_VIEWER_AND_ABOVE),
      requireFormulaScope(resolveFormulaIdFromInvoiceId),
    ),
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
  }>(
    '/api/v1/invoices/:invoiceId/status',
    withProtection(
      requireRole(ROLES_MANAGER_AND_ABOVE),
      requireFormulaScope(resolveFormulaIdFromInvoiceId),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        updateInvoiceStatus(request.params.invoiceId, request.body),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );
}
