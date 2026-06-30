import type { Prisma } from '@prisma/client';
import type { AuditLog, CalculationSnapshot, FormulaParticipant, FormulaVersion } from '@prisma/client';

import { ActionError } from './formula.actions.js';
import { FormulaNotFoundError } from '../services/formula.service.js';
import { CompanyNotFoundError } from '../services/company.service.js';
import {
  ClosedFormulaTradeMutationError,
} from '../services/guards/closed-formula.guard.js';
import {
  ParticipantEndPointConflictError,
  ParticipantNotFoundError,
  ParticipantSequenceConflictError,
  ParticipantService,
  ParticipantStartPointConflictError,
  participantService,
} from '../services/participant.service.js';
import type {
  CreateParticipantInput,
  CreateParticipantResult,
} from '../services/participant.service.js';
import { VersionConflictError } from '../services/version.service.js';
import type {
  CreateParticipantInputPayload,
  ParticipantVersionPayloadInput,
  ValidatedCreateParticipantInput,
} from '../types/participant.types.js';
import type { CompanyScopeFilter } from '../types/company-scope.types.js';
import {
  validateCreateParticipant,
  ValidationError,
} from '../utils/participant.validation.js';
import type {
  CreateVersionCalculationRequest,
  CreateVersionResponse,
} from './version.actions.js';

export interface ParticipantVersionRequest {
  snapshot: Prisma.InputJsonValue;
  calculation: CreateVersionCalculationRequest;
  changed_by?: string | null;
  change_reason?: string | null;
}

export interface CreateParticipantRequest {
  company_id?: string | null;
  sequence_order?: number | string | null;
  role_group?: string | null;
  nature_group?: string | null;
  payment_group?: string | null;
  buy_unit_price?: number | string | null;
  sell_unit_price?: number | string | null;
  quantity?: number | string | null;
  direct_cost_amount?: number | string | null;
  is_start_point?: boolean | string | null;
  is_end_point?: boolean | string | null;
  memo?: string | null;
  version?: ParticipantVersionRequest;
}

export interface ParticipantResponse {
  id: string;
  formula_id: string;
  company_id: string;
  sequence_order: number;
  role_group: string;
  nature_group: string | null;
  payment_group: string | null;
  buy_unit_price: string;
  sell_unit_price: string;
  quantity: string;
  direct_cost_amount: string;
  is_start_point: boolean;
  is_end_point: boolean;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParticipantListResponse {
  items: ParticipantResponse[];
}

export interface CreateParticipantResponse {
  participant: ParticipantResponse;
  version: CreateVersionResponse;
}

function decimalToString(value: { toString(): string }): string {
  return value.toString();
}

function toParticipantResponse(participant: FormulaParticipant): ParticipantResponse {
  return {
    id: participant.id,
    formula_id: participant.formulaId,
    company_id: participant.companyId,
    sequence_order: participant.sequenceOrder,
    role_group: participant.roleGroup,
    nature_group: participant.natureGroup,
    payment_group: participant.paymentGroup,
    buy_unit_price: decimalToString(participant.buyUnitPrice),
    sell_unit_price: decimalToString(participant.sellUnitPrice),
    quantity: decimalToString(participant.quantity),
    direct_cost_amount: decimalToString(participant.directCostAmount),
    is_start_point: participant.isStartPoint,
    is_end_point: participant.isEndPoint,
    memo: participant.memo,
    created_at: participant.createdAt.toISOString(),
    updated_at: participant.updatedAt.toISOString(),
  };
}

function toVersionResponse(version: FormulaVersion) {
  return {
    id: version.id,
    formula_id: version.formulaId,
    version_no: version.versionNo,
    changed_by: version.changedBy,
    change_reason: version.changeReason,
    snapshot: version.snapshot,
    created_at: version.createdAt.toISOString(),
  };
}

function toCalculationSnapshotResponse(snapshot: CalculationSnapshot) {
  return {
    id: snapshot.id,
    formula_id: snapshot.formulaId,
    formula_version_id: snapshot.formulaVersionId,
    quantity: decimalToString(snapshot.quantity),
    total_buy_amount: decimalToString(snapshot.totalBuyAmount),
    total_sell_amount: decimalToString(snapshot.totalSellAmount),
    total_cost: decimalToString(snapshot.totalCost),
    total_share: decimalToString(snapshot.totalShare),
    net_profit: decimalToString(snapshot.netProfit),
    profit_rate: snapshot.profitRate ? decimalToString(snapshot.profitRate) : null,
    exchange_rate_used: snapshot.exchangeRateUsed
      ? decimalToString(snapshot.exchangeRateUsed)
      : null,
    snapshot_data: snapshot.snapshotData,
    created_at: snapshot.createdAt.toISOString(),
  };
}

function toAuditLogResponse(auditLog: AuditLog) {
  return {
    id: auditLog.id,
    table_name: auditLog.tableName,
    record_id: auditLog.recordId,
    action: auditLog.action,
    changed_by: auditLog.changedBy,
    old_data: auditLog.oldData,
    new_data: auditLog.newData,
    ip_address: auditLog.ipAddress,
    created_at: auditLog.createdAt.toISOString(),
  };
}

function toCreateParticipantResponse(result: CreateParticipantResult): CreateParticipantResponse {
  return {
    participant: toParticipantResponse(result.participant),
    version: {
      version: toVersionResponse(result.version.version),
      snapshot: toCalculationSnapshotResponse(result.version.snapshot),
      audit_log: toAuditLogResponse(result.version.auditLog),
    },
  };
}

function mapVersionRequestToPayload(
  version: ParticipantVersionRequest,
): ParticipantVersionPayloadInput {
  const calculation: NonNullable<ParticipantVersionPayloadInput['calculation']> = {
    quantity: version.calculation.quantity,
    totalBuyAmount: version.calculation.total_buy_amount,
    totalSellAmount: version.calculation.total_sell_amount,
    totalCost: version.calculation.total_cost,
    totalShare: version.calculation.total_share,
    netProfit: version.calculation.net_profit,
    snapshotData: version.calculation.snapshot_data,
  };

  if (version.calculation.profit_rate !== undefined) {
    calculation.profitRate = version.calculation.profit_rate;
  }

  const payload: ParticipantVersionPayloadInput = {
    snapshot: version.snapshot,
    calculation,
  };

  if (version.changed_by !== undefined) payload.changedBy = version.changed_by;
  if (version.change_reason !== undefined) payload.changeReason = version.change_reason;

  return payload;
}

function mapCreateParticipantPayload(
  formulaId: string,
  body: CreateParticipantRequest,
): CreateParticipantInputPayload {
  const payload: CreateParticipantInputPayload = { formulaId };

  if (body.company_id !== undefined) payload.companyId = body.company_id;
  if (body.sequence_order !== undefined) payload.sequenceOrder = body.sequence_order;
  if (body.role_group !== undefined) payload.roleGroup = body.role_group;
  if (body.nature_group !== undefined) payload.natureGroup = body.nature_group;
  if (body.payment_group !== undefined) payload.paymentGroup = body.payment_group;
  if (body.buy_unit_price !== undefined) payload.buyUnitPrice = body.buy_unit_price;
  if (body.sell_unit_price !== undefined) payload.sellUnitPrice = body.sell_unit_price;
  if (body.quantity !== undefined) payload.quantity = body.quantity;
  if (body.direct_cost_amount !== undefined) payload.directCostAmount = body.direct_cost_amount;
  if (body.is_start_point !== undefined) payload.isStartPoint = body.is_start_point;
  if (body.is_end_point !== undefined) payload.isEndPoint = body.is_end_point;
  if (body.memo !== undefined) payload.memo = body.memo;
  if (body.version !== undefined) payload.version = mapVersionRequestToPayload(body.version);

  return payload;
}

function mapValidatedToServiceInput(
  validated: ValidatedCreateParticipantInput,
): CreateParticipantInput {
  const input: CreateParticipantInput = {
    formulaId: validated.formulaId,
    companyId: validated.companyId,
    sequenceOrder: validated.sequenceOrder,
    roleGroup: validated.roleGroup,
    version: {
      changedBy: validated.version.changedBy,
      changeReason: validated.version.changeReason,
      snapshot: validated.version.snapshot,
      calculation: {
        quantity: validated.version.calculation.quantity,
        totalBuyAmount: validated.version.calculation.totalBuyAmount,
        totalSellAmount: validated.version.calculation.totalSellAmount,
        totalCost: validated.version.calculation.totalCost,
        totalShare: validated.version.calculation.totalShare,
        netProfit: validated.version.calculation.netProfit,
        snapshotData: validated.version.calculation.snapshotData,
      },
    },
  };

  if (validated.version.calculation.profitRate !== undefined) {
    input.version.calculation.profitRate = validated.version.calculation.profitRate;
  }

  if (validated.natureGroup !== undefined) input.natureGroup = validated.natureGroup;
  if (validated.paymentGroup !== undefined) input.paymentGroup = validated.paymentGroup;
  if (validated.buyUnitPrice !== undefined) input.buyUnitPrice = validated.buyUnitPrice;
  if (validated.sellUnitPrice !== undefined) input.sellUnitPrice = validated.sellUnitPrice;
  if (validated.quantity !== undefined) input.quantity = validated.quantity;
  if (validated.directCostAmount !== undefined) input.directCostAmount = validated.directCostAmount;
  if (validated.isStartPoint !== undefined) input.isStartPoint = validated.isStartPoint;
  if (validated.isEndPoint !== undefined) input.isEndPoint = validated.isEndPoint;
  if (validated.memo !== undefined) input.memo = validated.memo;

  return input;
}

function mapParticipantActionError(error: unknown): never {
  if (error instanceof ValidationError) {
    throw new ActionError(400, error.message);
  }

  if (error instanceof FormulaNotFoundError) {
    throw new ActionError(404, error.message);
  }

  if (error instanceof CompanyNotFoundError) {
    throw new ActionError(404, error.message);
  }

  if (error instanceof ParticipantNotFoundError) {
    throw new ActionError(404, error.message);
  }

  if (error instanceof ParticipantSequenceConflictError) {
    throw new ActionError(409, error.message);
  }

  if (error instanceof ParticipantStartPointConflictError) {
    throw new ActionError(409, error.message);
  }

  if (error instanceof ParticipantEndPointConflictError) {
    throw new ActionError(409, error.message);
  }

  if (error instanceof ClosedFormulaTradeMutationError) {
    throw new ActionError(409, error.message);
  }

  if (error instanceof VersionConflictError) {
    throw new ActionError(409, error.message);
  }

  throw error;
}

export class ParticipantActions {
  constructor(private readonly service: ParticipantService = participantService) {}

  async createParticipant(
    formulaId: string,
    body: CreateParticipantRequest,
  ): Promise<CreateParticipantResponse> {
    try {
      const validated = validateCreateParticipant(mapCreateParticipantPayload(formulaId, body));
      const result = await this.service.createParticipant(mapValidatedToServiceInput(validated));
      return toCreateParticipantResponse(result);
    } catch (error) {
      mapParticipantActionError(error);
    }
  }

  async getParticipantById(participantId: string): Promise<ParticipantResponse> {
    try {
      const participant = await this.service.getParticipantById(participantId);
      return toParticipantResponse(participant);
    } catch (error) {
      mapParticipantActionError(error);
    }
  }

  async listParticipantsByFormulaId(
    formulaId: string,
    companyScope?: CompanyScopeFilter,
  ): Promise<ParticipantListResponse> {
    try {
      const participants = await this.service.listParticipantsByFormulaId(formulaId, companyScope);
      return {
        items: participants.map(toParticipantResponse),
      };
    } catch (error) {
      mapParticipantActionError(error);
    }
  }
}

export const participantActions = new ParticipantActions();

export async function createParticipant(
  formulaId: string,
  body: CreateParticipantRequest,
): Promise<CreateParticipantResponse> {
  return participantActions.createParticipant(formulaId, body);
}

export async function getParticipantById(participantId: string): Promise<ParticipantResponse> {
  return participantActions.getParticipantById(participantId);
}

export async function listParticipantsByFormulaId(
  formulaId: string,
  companyScope?: CompanyScopeFilter,
): Promise<ParticipantListResponse> {
  return participantActions.listParticipantsByFormulaId(formulaId, companyScope);
}
