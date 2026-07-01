import type { Prisma } from '@prisma/client';
import type { AuditLog, CalculationSnapshot, FormulaVersion } from '@prisma/client';

import { ActionError } from './formula.actions.js';
import { FormulaNotFoundError } from '../services/formula.service.js';
import {
  ClosedFormulaTradeMutationError,
  FormulaNotFoundForGuardError,
} from '../services/guards/closed-formula.guard.js';
import {
  VersionConflictError,
  VersionNotFoundError,
  VersionService,
  versionService,
} from '../services/version.service.js';
import type { CreateVersionInput } from '../services/version.service.js';
import type { CompanyScopeFilter } from '../types/company-scope.types.js';

export interface CreateVersionCalculationRequest {
  quantity: number | string;
  total_buy_amount: number | string;
  total_sell_amount: number | string;
  total_cost: number | string;
  total_share: number | string;
  net_profit: number | string;
  profit_rate?: number | string | null;
  exchange_rate_used?: number | string | null;
  snapshot_data: Prisma.InputJsonValue;
}

export interface CreateVersionRequest {
  formula_id: string;
  changed_by?: string | null;
  change_reason?: string | null;
  snapshot: Prisma.InputJsonValue;
  calculation: CreateVersionCalculationRequest;
}

export interface VersionResponse {
  id: string;
  formula_id: string;
  version_no: number;
  changed_by: string | null;
  change_reason: string | null;
  snapshot: Prisma.JsonValue;
  created_at: string;
}

export interface CalculationSnapshotResponse {
  id: string;
  formula_id: string;
  formula_version_id: string | null;
  quantity: string;
  total_buy_amount: string;
  total_sell_amount: string;
  total_cost: string;
  total_share: string;
  net_profit: string;
  profit_rate: string | null;
  exchange_rate_used: string | null;
  snapshot_data: Prisma.JsonValue;
  created_at: string;
}

export interface AuditLogResponse {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  changed_by: string | null;
  old_data: Prisma.JsonValue | null;
  new_data: Prisma.JsonValue | null;
  ip_address: string | null;
  created_at: string;
}

export interface CreateVersionResponse {
  version: VersionResponse;
  snapshot: CalculationSnapshotResponse;
  audit_log: AuditLogResponse;
}

export interface VersionListResponse {
  items: VersionResponse[];
}

function decimalToString(value: { toString(): string }): string {
  return value.toString();
}

function toVersionResponse(version: FormulaVersion): VersionResponse {
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

function toCalculationSnapshotResponse(snapshot: CalculationSnapshot): CalculationSnapshotResponse {
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

function toAuditLogResponse(auditLog: AuditLog): AuditLogResponse {
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

function toCreateVersionResponse(result: {
  version: FormulaVersion;
  snapshot: CalculationSnapshot;
  auditLog: AuditLog;
}): CreateVersionResponse {
  return {
    version: toVersionResponse(result.version),
    snapshot: toCalculationSnapshotResponse(result.snapshot),
    audit_log: toAuditLogResponse(result.auditLog),
  };
}

function mapCreateVersionRequest(body: CreateVersionRequest): CreateVersionInput {
  const calculation: CreateVersionInput['calculation'] = {
    quantity: body.calculation.quantity,
    totalBuyAmount: body.calculation.total_buy_amount,
    totalSellAmount: body.calculation.total_sell_amount,
    totalCost: body.calculation.total_cost,
    totalShare: body.calculation.total_share,
    netProfit: body.calculation.net_profit,
    snapshotData: body.calculation.snapshot_data,
  };

  if (body.calculation.profit_rate !== undefined) {
    calculation.profitRate = body.calculation.profit_rate;
  }
  if (body.calculation.exchange_rate_used !== undefined) {
    calculation.exchangeRateUsed = body.calculation.exchange_rate_used;
  }

  const input: CreateVersionInput = {
    formulaId: body.formula_id,
    snapshot: body.snapshot,
    calculation,
  };

  if (body.changed_by !== undefined) input.changedBy = body.changed_by;
  if (body.change_reason !== undefined) input.changeReason = body.change_reason;

  return input;
}

function assertCreateVersionRequiredFields(body: CreateVersionRequest): void {
  if (!body.formula_id) {
    throw new ActionError(400, 'formula_id is required');
  }
  if (body.snapshot === undefined || body.snapshot === null) {
    throw new ActionError(400, 'snapshot is required');
  }
  if (!body.calculation) {
    throw new ActionError(400, 'calculation is required');
  }

  const { calculation } = body;

  if (calculation.quantity === undefined || calculation.quantity === null) {
    throw new ActionError(400, 'calculation.quantity is required');
  }
  if (calculation.total_buy_amount === undefined || calculation.total_buy_amount === null) {
    throw new ActionError(400, 'calculation.total_buy_amount is required');
  }
  if (calculation.total_sell_amount === undefined || calculation.total_sell_amount === null) {
    throw new ActionError(400, 'calculation.total_sell_amount is required');
  }
  if (calculation.total_cost === undefined || calculation.total_cost === null) {
    throw new ActionError(400, 'calculation.total_cost is required');
  }
  if (calculation.total_share === undefined || calculation.total_share === null) {
    throw new ActionError(400, 'calculation.total_share is required');
  }
  if (calculation.net_profit === undefined || calculation.net_profit === null) {
    throw new ActionError(400, 'calculation.net_profit is required');
  }
  if (calculation.snapshot_data === undefined || calculation.snapshot_data === null) {
    throw new ActionError(400, 'calculation.snapshot_data is required');
  }
}

function mapVersionServiceError(error: unknown): never {
  if (error instanceof FormulaNotFoundError) {
    throw new ActionError(404, error.message);
  }

  if (error instanceof FormulaNotFoundForGuardError) {
    throw new ActionError(404, error.message);
  }

  if (error instanceof VersionNotFoundError) {
    throw new ActionError(404, error.message);
  }

  if (error instanceof ClosedFormulaTradeMutationError) {
    throw new ActionError(409, error.message);
  }

  if (error instanceof VersionConflictError) {
    throw new ActionError(409, error.message);
  }

  throw error;
}

export class VersionActions {
  constructor(private readonly service: VersionService = versionService) {}

  async createVersion(body: CreateVersionRequest): Promise<CreateVersionResponse> {
    assertCreateVersionRequiredFields(body);

    try {
      const result = await this.service.createVersion(mapCreateVersionRequest(body));
      return toCreateVersionResponse(result);
    } catch (error) {
      mapVersionServiceError(error);
    }
  }

  async getVersionById(id: string): Promise<VersionResponse> {
    try {
      const version = await this.service.getVersionById(id);
      return toVersionResponse(version);
    } catch (error) {
      mapVersionServiceError(error);
    }
  }

  async getVersionByFormulaIdAndVersionNo(
    formulaId: string,
    versionNo: number,
  ): Promise<VersionResponse> {
    try {
      const version = await this.service.getVersionByFormulaIdAndVersionNo(formulaId, versionNo);
      return toVersionResponse(version);
    } catch (error) {
      mapVersionServiceError(error);
    }
  }

  async listVersionsByFormulaId(
    formulaId: string,
    companyScope?: CompanyScopeFilter,
  ): Promise<VersionListResponse> {
    try {
      const versions = await this.service.listVersionsByFormulaId(formulaId, companyScope);

      return {
        items: versions.map(toVersionResponse),
      };
    } catch (error) {
      mapVersionServiceError(error);
    }
  }

  async getLatestVersionByFormulaId(formulaId: string): Promise<VersionResponse> {
    try {
      const version = await this.service.getLatestVersionByFormulaId(formulaId);
      return toVersionResponse(version);
    } catch (error) {
      mapVersionServiceError(error);
    }
  }
}

export const versionActions = new VersionActions();

export async function createVersion(body: CreateVersionRequest): Promise<CreateVersionResponse> {
  return versionActions.createVersion(body);
}

export async function getVersionById(id: string): Promise<VersionResponse> {
  return versionActions.getVersionById(id);
}

export async function getVersionByFormulaIdAndVersionNo(
  formulaId: string,
  versionNo: number,
): Promise<VersionResponse> {
  return versionActions.getVersionByFormulaIdAndVersionNo(formulaId, versionNo);
}

export async function listVersionsByFormulaId(
  formulaId: string,
  companyScope?: CompanyScopeFilter,
): Promise<VersionListResponse> {
  return versionActions.listVersionsByFormulaId(formulaId, companyScope);
}

export async function getLatestVersionByFormulaId(formulaId: string): Promise<VersionResponse> {
  return versionActions.getLatestVersionByFormulaId(formulaId);
}
