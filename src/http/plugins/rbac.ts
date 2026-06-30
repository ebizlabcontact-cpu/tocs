import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { MembershipRole } from '@prisma/client';

import { ActionError } from '../../actions/formula.actions.js';
import { formulaRepository } from '../../repositories/formula.repository.js';
import { invoiceRepository } from '../../repositories/invoice.repository.js';
import { logisticsRepository } from '../../repositories/logistics.repository.js';
import {
  participantRepository,
} from '../../repositories/participant.repository.js';
import {
  paymentRecordRepository,
  paymentScheduleRepository,
} from '../../repositories/payment.repository.js';
import { shareRepository } from '../../repositories/share.repository.js';
import { formulaVersionRepository } from '../../repositories/version.repository.js';
import { sendActionError } from '../lib/handle-action.js';
import type { RequestAuthContext } from '../types/auth-request.js';

export const RBAC_AUTHENTICATION_REQUIRED = 'Authentication required';
export const RBAC_FORBIDDEN = 'Forbidden';
export const RBAC_NOT_FOUND = 'Not found';

export const ROLES_VIEWER_AND_ABOVE: MembershipRole[] = [
  MembershipRole.VIEWER,
  MembershipRole.MANAGER,
  MembershipRole.COMPANY_ADMIN,
  MembershipRole.SUPER_ADMIN,
];

export const ROLES_MANAGER_AND_ABOVE: MembershipRole[] = [
  MembershipRole.MANAGER,
  MembershipRole.COMPANY_ADMIN,
  MembershipRole.SUPER_ADMIN,
];

export const ROLES_COMPANY_ADMIN_AND_ABOVE: MembershipRole[] = [
  MembershipRole.COMPANY_ADMIN,
  MembershipRole.SUPER_ADMIN,
];

export type ResolveCompanyId = (request: FastifyRequest) => string | undefined;
export type FormulaIdResolver = (
  request: FastifyRequest,
) => Promise<string | undefined> | string | undefined;

export function withProtection(
  ...handlers: preHandlerHookHandler[]
): { preHandler: preHandlerHookHandler[] } {
  return { preHandler: handlers };
}

export function paramString(request: FastifyRequest, key: string): string | undefined {
  const params = request.params as Record<string, unknown>;
  const value = params[key];

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function formulaIdFromParam(paramName = 'formulaId'): FormulaIdResolver {
  return (request) => paramString(request, paramName);
}

export function companyIdFromParam(paramName = 'companyId'): ResolveCompanyId {
  return (request) => paramString(request, paramName);
}

function isSuperAdmin(auth: RequestAuthContext): boolean {
  return auth.roles.includes(MembershipRole.SUPER_ADMIN);
}

export function requireRole(allowedRoles: MembershipRole[]): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.auth === null) {
      sendActionError(reply, new ActionError(401, RBAC_AUTHENTICATION_REQUIRED));
      return;
    }

    const authorized = request.auth.roles.some((role) => allowedRoles.includes(role));

    if (!authorized) {
      sendActionError(reply, new ActionError(403, RBAC_FORBIDDEN));
    }
  };
}

export function requireAnyActiveMembership(): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.auth === null) {
      sendActionError(reply, new ActionError(401, RBAC_AUTHENTICATION_REQUIRED));
      return;
    }

    if (isSuperAdmin(request.auth)) {
      return;
    }

    if (request.auth.memberships.length === 0) {
      sendActionError(reply, new ActionError(403, RBAC_FORBIDDEN));
    }
  };
}

export function requireCompanyScope(
  resolveCompanyId: ResolveCompanyId,
): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.auth === null) {
      sendActionError(reply, new ActionError(401, RBAC_AUTHENTICATION_REQUIRED));
      return;
    }

    if (isSuperAdmin(request.auth)) {
      return;
    }

    const companyId = resolveCompanyId(request);

    if (companyId === undefined || companyId.trim() === '') {
      sendActionError(reply, new ActionError(403, RBAC_FORBIDDEN));
      return;
    }

    const hasScope = request.auth.memberships.some(
      (membership) => membership.company_id === companyId,
    );

    if (!hasScope) {
      sendActionError(reply, new ActionError(403, RBAC_FORBIDDEN));
    }
  };
}

async function resolveFormulaIdValue(
  request: FastifyRequest,
  resolveFormulaId: FormulaIdResolver,
): Promise<string | undefined> {
  const resolved = resolveFormulaId(request);
  return resolved instanceof Promise ? resolved : resolved;
}

export async function hasFormulaScope(
  auth: RequestAuthContext,
  formulaId: string,
): Promise<boolean> {
  if (isSuperAdmin(auth)) {
    return true;
  }

  const participants = await participantRepository.listParticipantsByFormulaId(formulaId);

  if (participants.length === 0) {
    return false;
  }

  const formulaCompanyIds = new Set(participants.map((participant) => participant.companyId));
  return auth.memberships.some((membership) => formulaCompanyIds.has(membership.company_id));
}

export function requireFormulaScope(
  resolveFormulaId: FormulaIdResolver,
): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.auth === null) {
      sendActionError(reply, new ActionError(401, RBAC_AUTHENTICATION_REQUIRED));
      return;
    }

    if (isSuperAdmin(request.auth)) {
      return;
    }

    const formulaId = await resolveFormulaIdValue(request, resolveFormulaId);

    if (formulaId === undefined) {
      sendActionError(reply, new ActionError(404, RBAC_NOT_FOUND));
      return;
    }

    const allowed = await hasFormulaScope(request.auth, formulaId);

    if (!allowed) {
      sendActionError(reply, new ActionError(404, RBAC_NOT_FOUND));
    }
  };
}

export const resolveFormulaIdFromFormulaNo: FormulaIdResolver = async (request) => {
  const formulaNo = paramString(request, 'formulaNo');

  if (!formulaNo) {
    return undefined;
  }

  const formula = await formulaRepository.findByFormulaNo(formulaNo);
  return formula?.id;
};

export const resolveFormulaIdFromParticipantId: FormulaIdResolver = async (request) => {
  const participantId = paramString(request, 'participantId');

  if (!participantId) {
    return undefined;
  }

  const participant = await participantRepository.findParticipantById(participantId);
  return participant?.formulaId;
};

export const resolveFormulaIdFromPaymentScheduleId: FormulaIdResolver = async (request) => {
  const scheduleId = paramString(request, 'scheduleId');

  if (!scheduleId) {
    return undefined;
  }

  const schedule = await paymentScheduleRepository.findScheduleById(scheduleId);
  return schedule?.formulaId;
};

export const resolveFormulaIdFromPaymentRecordId: FormulaIdResolver = async (request) => {
  const recordId = paramString(request, 'recordId');

  if (!recordId) {
    return undefined;
  }

  const record = await paymentRecordRepository.findRecordById(recordId);
  return record?.formulaId;
};

export const resolveFormulaIdFromInvoiceId: FormulaIdResolver = async (request) => {
  const invoiceId = paramString(request, 'invoiceId');

  if (!invoiceId) {
    return undefined;
  }

  const invoice = await invoiceRepository.findInvoiceById(invoiceId);
  return invoice?.formulaId;
};

export const resolveFormulaIdFromShareId: FormulaIdResolver = async (request) => {
  const shareId = paramString(request, 'shareId');

  if (!shareId) {
    return undefined;
  }

  const share = await shareRepository.findShareById(shareId);
  return share?.formulaId;
};

export const resolveFormulaIdFromVersionId: FormulaIdResolver = async (request) => {
  const versionId = paramString(request, 'versionId');

  if (!versionId) {
    return undefined;
  }

  const version = await formulaVersionRepository.findVersionById(versionId);
  return version?.formulaId;
};

export const resolveFormulaIdFromLogisticsId: FormulaIdResolver = async (request) => {
  const logisticsId = paramString(request, 'logisticsId');

  if (!logisticsId) {
    return undefined;
  }

  const logistics = await logisticsRepository.findLogisticsById(logisticsId);
  return logistics?.formulaId;
};
