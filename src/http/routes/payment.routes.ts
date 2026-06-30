import type { FastifyInstance } from 'fastify';

import {
  cancelPaymentRecord,
  createPaymentRecord,
  createPaymentSchedule,
  getPaymentRecordById,
  getPaymentScheduleById,
  listPaymentRecordsByFormulaId,
  listPaymentSchedulesByFormulaId,
  type CancelPaymentRecordRequest,
  type CreatePaymentRecordRequest,
  type CreatePaymentScheduleRequest,
} from '../../actions/payment.actions.js';
import { runAction } from '../lib/handle-action.js';
import {
  formulaIdFromParam,
  requireFormulaScope,
  requireRole,
  resolveFormulaIdFromPaymentRecordId,
  resolveFormulaIdFromPaymentScheduleId,
  ROLES_COMPANY_ADMIN_AND_ABOVE,
  ROLES_MANAGER_AND_ABOVE,
  ROLES_VIEWER_AND_ABOVE,
  withProtection,
} from '../plugins/rbac.js';

export async function registerPaymentRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Params: { formulaId: string };
    Body: CreatePaymentScheduleRequest;
  }>(
    '/api/v1/formulas/:formulaId/payment-schedules',
    withProtection(
      requireRole(ROLES_MANAGER_AND_ABOVE),
      requireFormulaScope(formulaIdFromParam('formulaId')),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        createPaymentSchedule(request.params.formulaId, request.body),
      );

      if (result !== undefined) {
        return reply.status(201).send(result);
      }
    },
  );

  app.get<{ Params: { formulaId: string } }>(
    '/api/v1/formulas/:formulaId/payment-schedules',
    withProtection(
      requireRole(ROLES_VIEWER_AND_ABOVE),
      requireFormulaScope(formulaIdFromParam('formulaId')),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        listPaymentSchedulesByFormulaId(request.params.formulaId),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.get<{ Params: { scheduleId: string } }>(
    '/api/v1/payment-schedules/:scheduleId',
    withProtection(
      requireRole(ROLES_VIEWER_AND_ABOVE),
      requireFormulaScope(resolveFormulaIdFromPaymentScheduleId),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        getPaymentScheduleById(request.params.scheduleId),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.post<{
    Params: { formulaId: string };
    Body: CreatePaymentRecordRequest;
  }>(
    '/api/v1/formulas/:formulaId/payment-records',
    withProtection(
      requireRole(ROLES_MANAGER_AND_ABOVE),
      requireFormulaScope(formulaIdFromParam('formulaId')),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        createPaymentRecord(request.params.formulaId, request.body),
      );

      if (result !== undefined) {
        return reply.status(201).send(result);
      }
    },
  );

  app.get<{ Params: { formulaId: string } }>(
    '/api/v1/formulas/:formulaId/payment-records',
    withProtection(
      requireRole(ROLES_VIEWER_AND_ABOVE),
      requireFormulaScope(formulaIdFromParam('formulaId')),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        listPaymentRecordsByFormulaId(request.params.formulaId),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.get<{ Params: { recordId: string } }>(
    '/api/v1/payment-records/:recordId',
    withProtection(
      requireRole(ROLES_VIEWER_AND_ABOVE),
      requireFormulaScope(resolveFormulaIdFromPaymentRecordId),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () => getPaymentRecordById(request.params.recordId));

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );

  app.patch<{
    Params: { recordId: string };
    Body: CancelPaymentRecordRequest;
  }>(
    '/api/v1/payment-records/:recordId/cancel',
    withProtection(
      requireRole(ROLES_COMPANY_ADMIN_AND_ABOVE),
      requireFormulaScope(resolveFormulaIdFromPaymentRecordId),
    ),
    async (request, reply) => {
      const result = await runAction(reply, () =>
        cancelPaymentRecord(request.params.recordId, request.body),
      );

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );
}
