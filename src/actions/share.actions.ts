import type { Prisma } from '@prisma/client';
import type { AuditLog, CalculationSnapshot, FormulaVersion, Share } from '@prisma/client';

import { ActionError } from './formula.actions.js';
import type {
  CreateVersionCalculationRequest,
  CreateVersionResponse,
} from './version.actions.js';
import {
  ShareNotFoundError,
  ShareService,
  ShareVersionRequiredError,
  shareService,
} from '../services/share.service.js';
import type {
  CreateShareInput,
  ShareMutationResult,
  ShareVersionPayload,
  UpdateShareInput,
} from '../services/share.service.js';
import { VersionConflictError } from '../services/version.service.js';

export interface ShareVersionRequest {
  snapshot: Prisma.InputJsonValue;
  calculation: CreateVersionCalculationRequest;
  changed_by?: string | null;
  change_reason?: string | null;
}

export interface CreateShareRequest {
  participant_id?: string | null;
  target_company_id?: string | null;
  share_basis?: string;
  share_method?: string;
  share_rate?: number | string | null;
  share_amount?: number | string;
  memo?: string | null;
  version: ShareVersionRequest;
}

export interface UpdateShareRequest {
  participant_id?: string | null;
  target_company_id?: string | null;
  share_basis?: string;
  share_method?: string;
  share_rate?: number | string | null;
  share_amount?: number | string;
  memo?: string | null;
  version: ShareVersionRequest;
}

export interface DeleteShareRequest {
  version: ShareVersionRequest;
}

export interface ShareResponse {
  id: string;
  formula_id: string;
  participant_id: string | null;
  target_company_id: string | null;
  share_basis: string;
  share_method: string;
  share_rate: string | null;
  share_amount: string;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShareListResponse {
  items: ShareResponse[];
}

export interface ShareMutationResponse {
  share: ShareResponse;
  version: CreateVersionResponse;
}

function decimalToString(value: { toString(): string }): string {
  return value.toString();
}

function toShareResponse(share: Share): ShareResponse {
  return {
    id: share.id,
    formula_id: share.formulaId,
    participant_id: share.participantId,
    target_company_id: share.targetCompanyId,
    share_basis: share.shareBasis,
    share_method: share.shareMethod,
    share_rate: share.shareRate ? decimalToString(share.shareRate) : null,
    share_amount: decimalToString(share.shareAmount),
    memo: share.memo,
    created_at: share.createdAt.toISOString(),
    updated_at: share.updatedAt.toISOString(),
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

function toShareMutationResponse(result: ShareMutationResult): ShareMutationResponse {
  return {
    share: toShareResponse(result.share),
    version: {
      version: toVersionResponse(result.version.version),
      snapshot: toCalculationSnapshotResponse(result.version.snapshot),
      audit_log: toAuditLogResponse(result.version.auditLog),
    },
  };
}

function mapVersionCalculationRequest(
  calculation: CreateVersionCalculationRequest,
): ShareVersionPayload['calculation'] {
  const mapped: ShareVersionPayload['calculation'] = {
    quantity: calculation.quantity,
    totalBuyAmount: calculation.total_buy_amount,
    totalSellAmount: calculation.total_sell_amount,
    totalCost: calculation.total_cost,
    totalShare: calculation.total_share,
    netProfit: calculation.net_profit,
    snapshotData: calculation.snapshot_data,
  };

  if (calculation.profit_rate !== undefined) {
    mapped.profitRate = calculation.profit_rate;
  }
  if (calculation.exchange_rate_used !== undefined) {
    mapped.exchangeRateUsed = calculation.exchange_rate_used;
  }

  return mapped;
}

function mapShareVersionPayload(version: ShareVersionRequest): ShareVersionPayload {
  const payload: ShareVersionPayload = {
    snapshot: version.snapshot,
    calculation: mapVersionCalculationRequest(version.calculation),
  };

  if (version.changed_by !== undefined) payload.changedBy = version.changed_by;
  if (version.change_reason !== undefined) payload.changeReason = version.change_reason;

  return payload;
}

function mapCreateShareInput(formulaId: string, body: CreateShareRequest): CreateShareInput {
  const share: CreateShareInput['share'] = { formulaId };

  if (body.participant_id !== undefined) share.participantId = body.participant_id;
  if (body.target_company_id !== undefined) share.targetCompanyId = body.target_company_id;
  if (body.share_basis !== undefined) share.shareBasis = body.share_basis;
  if (body.share_method !== undefined) share.shareMethod = body.share_method;
  if (body.share_rate !== undefined) share.shareRate = body.share_rate;
  if (body.share_amount !== undefined) share.shareAmount = body.share_amount;
  if (body.memo !== undefined) share.memo = body.memo;

  return {
    share,
    version: mapShareVersionPayload(body.version),
  };
}

function mapUpdateShareInput(body: UpdateShareRequest): UpdateShareInput {
  const data: UpdateShareInput['data'] = {};

  if (body.participant_id !== undefined) data.participantId = body.participant_id;
  if (body.target_company_id !== undefined) data.targetCompanyId = body.target_company_id;
  if (body.share_basis !== undefined) data.shareBasis = body.share_basis;
  if (body.share_method !== undefined) data.shareMethod = body.share_method;
  if (body.share_rate !== undefined) data.shareRate = body.share_rate;
  if (body.share_amount !== undefined) data.shareAmount = body.share_amount;
  if (body.memo !== undefined) data.memo = body.memo;

  return {
    data,
    version: mapShareVersionPayload(body.version),
  };
}

function assertShareVersionRequest(version: ShareVersionRequest | undefined): void {
  if (!version) {
    throw new ActionError(400, 'version is required');
  }
  if (version.snapshot === undefined || version.snapshot === null) {
    throw new ActionError(400, 'version.snapshot is required');
  }
  if (!version.calculation) {
    throw new ActionError(400, 'version.calculation is required');
  }
}

function mapShareServiceError(error: unknown): never {
  if (error instanceof ShareNotFoundError) {
    throw new ActionError(404, error.message);
  }

  if (error instanceof ShareVersionRequiredError) {
    throw new ActionError(400, error.message);
  }

  if (error instanceof VersionConflictError) {
    throw new ActionError(409, error.message);
  }

  throw error;
}

export class ShareActions {
  constructor(private readonly service: ShareService = shareService) {}

  async createShare(formulaId: string, body: CreateShareRequest): Promise<ShareMutationResponse> {
    assertShareVersionRequest(body.version);

    try {
      const result = await this.service.createShare(mapCreateShareInput(formulaId, body));
      return toShareMutationResponse(result);
    } catch (error) {
      mapShareServiceError(error);
    }
  }

  async getShareById(id: string): Promise<ShareResponse> {
    try {
      const share = await this.service.getShareById(id);
      return toShareResponse(share);
    } catch (error) {
      mapShareServiceError(error);
    }
  }

  async listSharesByFormulaId(formulaId: string): Promise<ShareListResponse> {
    const shares = await this.service.listSharesByFormulaId(formulaId);

    return {
      items: shares.map(toShareResponse),
    };
  }

  async listSharesByParticipantId(participantId: string): Promise<ShareListResponse> {
    const shares = await this.service.listSharesByParticipantId(participantId);

    return {
      items: shares.map(toShareResponse),
    };
  }

  async updateShare(id: string, body: UpdateShareRequest): Promise<ShareMutationResponse> {
    assertShareVersionRequest(body.version);

    try {
      const result = await this.service.updateShare(id, mapUpdateShareInput(body));
      return toShareMutationResponse(result);
    } catch (error) {
      mapShareServiceError(error);
    }
  }

  async deleteShare(id: string, body: DeleteShareRequest): Promise<ShareMutationResponse> {
    assertShareVersionRequest(body.version);

    try {
      const result = await this.service.deleteShare(id, mapShareVersionPayload(body.version));
      return toShareMutationResponse(result);
    } catch (error) {
      mapShareServiceError(error);
    }
  }
}

export const shareActions = new ShareActions();

export async function createShare(
  formulaId: string,
  body: CreateShareRequest,
): Promise<ShareMutationResponse> {
  return shareActions.createShare(formulaId, body);
}

export async function getShareById(id: string): Promise<ShareResponse> {
  return shareActions.getShareById(id);
}

export async function listSharesByFormulaId(formulaId: string): Promise<ShareListResponse> {
  return shareActions.listSharesByFormulaId(formulaId);
}

export async function listSharesByParticipantId(participantId: string): Promise<ShareListResponse> {
  return shareActions.listSharesByParticipantId(participantId);
}

export async function updateShare(
  id: string,
  body: UpdateShareRequest,
): Promise<ShareMutationResponse> {
  return shareActions.updateShare(id, body);
}

export async function deleteShare(
  id: string,
  body: DeleteShareRequest,
): Promise<ShareMutationResponse> {
  return shareActions.deleteShare(id, body);
}
