import type { Prisma } from '@prisma/client';
import type {
  AuditLog,
  CalculationSnapshot,
  Formula,
  FormulaVersion,
  Logistics,
  StatusLog,
  TradeStatus,
} from '@prisma/client';

import { ActionError, type FormulaCreateResponse } from './formula.actions.js';
import type {
  CreateVersionCalculationRequest,
  CreateVersionResponse,
} from './version.actions.js';
import { CompanyNotFoundError } from '../services/company.service.js';
import { FormulaNotFoundError } from '../services/formula.service.js';
import { ClosedFormulaTradeMutationError } from '../services/guards/closed-formula.guard.js';
import {
  LogisticsCostBearerRequiredError,
  LogisticsNotFoundError,
  LogisticsService,
  logisticsService,
} from '../services/logistics.service.js';
import type {
  CreateLogisticsInput,
  CreateLogisticsResult,
  UpdateLogisticsStatusResult,
} from '../services/logistics.service.js';
import { VersionConflictError } from '../services/version.service.js';
import type {
  CreateLogisticsInputPayload,
  LogisticsVersionPayloadInput,
  UpdateLogisticsStatusInputPayload,
  ValidatedCreateLogisticsInput,
  ValidatedUpdateLogisticsStatusInput,
} from '../types/logistics.types.js';
import {
  validateCreateLogistics,
  validateUpdateLogisticsStatus,
  ValidationError,
} from '../utils/logistics.validation.js';

export interface LogisticsVersionRequest {
  snapshot: Prisma.InputJsonValue;
  calculation: CreateVersionCalculationRequest;
  changed_by?: string | null;
  change_reason?: string | null;
}

export interface CreateLogisticsRequest {
  carrier_company_id?: string | null;
  departure_company_id?: string | null;
  arrival_company_id?: string | null;
  cost_bearer_company_id?: string | null;
  cost_type?: string | null;
  departure_location?: string | null;
  arrival_location?: string | null;
  item_description?: string | null;
  transport_quantity?: number | string | null;
  vehicle_count?: number | string | null;
  total_logistics_cost?: number | string | null;
  scheduled_date?: string | null;
  memo?: string | null;
  version?: LogisticsVersionRequest;
}

export interface UpdateLogisticsStatusRequest {
  status?: TradeStatus | string | null;
  changed_by?: string | null;
  change_reason?: string | null;
}

export interface LogisticsResponse {
  id: string;
  formula_id: string;
  carrier_company_id: string;
  departure_company_id: string | null;
  arrival_company_id: string | null;
  cost_bearer_company_id: string | null;
  cost_type: string;
  departure_location: string | null;
  arrival_location: string | null;
  item_description: string | null;
  transport_quantity: string | null;
  vehicle_count: number | null;
  scheduled_date: string | null;
  total_logistics_cost: string;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface LogisticsStatusLogResponse {
  id: string;
  formula_id: string;
  status: string;
  changed_by: string | null;
  change_reason: string | null;
  created_at: string;
}

export interface LogisticsListResponse {
  items: LogisticsResponse[];
}

export interface CreateLogisticsResponse {
  logistics: LogisticsResponse;
  version: CreateVersionResponse;
}

export interface UpdateLogisticsStatusResponse {
  formula: FormulaCreateResponse;
  status_log: LogisticsStatusLogResponse;
}

function decimalToString(value: { toString(): string }): string {
  return value.toString();
}

function toLogisticsResponse(logistics: Logistics): LogisticsResponse {
  return {
    id: logistics.id,
    formula_id: logistics.formulaId,
    carrier_company_id: logistics.carrierCompanyId,
    departure_company_id: logistics.departureCompanyId,
    arrival_company_id: logistics.arrivalCompanyId,
    cost_bearer_company_id: logistics.costBearerCompanyId,
    cost_type: logistics.costType,
    departure_location: logistics.departureLocation,
    arrival_location: logistics.arrivalLocation,
    item_description: logistics.itemDescription,
    transport_quantity: logistics.transportQuantity
      ? decimalToString(logistics.transportQuantity)
      : null,
    vehicle_count: logistics.vehicleCount,
    scheduled_date: logistics.scheduledDate?.toISOString().split('T')[0] ?? null,
    total_logistics_cost: decimalToString(logistics.totalLogisticsCost),
    memo: logistics.memo,
    created_at: logistics.createdAt.toISOString(),
    updated_at: logistics.updatedAt.toISOString(),
  };
}

function toFormulaCreateResponse(formula: Formula): FormulaCreateResponse {
  return {
    id: formula.id,
    formula_no: formula.formulaNo,
    trade_type: formula.tradeType,
    trade_status: formula.tradeStatus,
    delivery_status: formula.deliveryStatus,
    cash_in_status: formula.cashInStatus,
    cash_out_status: formula.cashOutStatus,
    invoice_status: formula.invoiceStatus,
    logistics_status: formula.logisticsStatus,
    is_closed: formula.isClosed,
    created_at: formula.createdAt.toISOString(),
  };
}

function toLogisticsStatusLogResponse(statusLog: StatusLog): LogisticsStatusLogResponse {
  return {
    id: statusLog.id,
    formula_id: statusLog.formulaId,
    status: statusLog.newStatus,
    changed_by: statusLog.changedBy,
    change_reason: statusLog.changeReason,
    created_at: statusLog.createdAt.toISOString(),
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

function toCreateLogisticsResponse(result: CreateLogisticsResult): CreateLogisticsResponse {
  return {
    logistics: toLogisticsResponse(result.logistics),
    version: {
      version: toVersionResponse(result.version.version),
      snapshot: toCalculationSnapshotResponse(result.version.snapshot),
      audit_log: toAuditLogResponse(result.version.auditLog),
    },
  };
}

function toUpdateLogisticsStatusResponse(
  result: UpdateLogisticsStatusResult,
): UpdateLogisticsStatusResponse {
  return {
    formula: toFormulaCreateResponse(result.formula),
    status_log: toLogisticsStatusLogResponse(result.statusLog),
  };
}

function mapVersionRequestToPayload(
  version: LogisticsVersionRequest,
): LogisticsVersionPayloadInput {
  const calculation: NonNullable<LogisticsVersionPayloadInput['calculation']> = {
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

  const payload: LogisticsVersionPayloadInput = {
    snapshot: version.snapshot,
    calculation,
  };

  if (version.changed_by !== undefined) payload.changedBy = version.changed_by;
  if (version.change_reason !== undefined) payload.changeReason = version.change_reason;

  return payload;
}

function mapCreateLogisticsPayload(
  formulaId: string,
  body: CreateLogisticsRequest,
): CreateLogisticsInputPayload {
  const payload: CreateLogisticsInputPayload = { formulaId };

  if (body.carrier_company_id !== undefined) payload.carrierCompanyId = body.carrier_company_id;
  if (body.departure_company_id !== undefined) {
    payload.departureCompanyId = body.departure_company_id;
  }
  if (body.arrival_company_id !== undefined) payload.arrivalCompanyId = body.arrival_company_id;
  if (body.cost_bearer_company_id !== undefined) {
    payload.costBearerCompanyId = body.cost_bearer_company_id;
  }
  if (body.cost_type !== undefined) payload.costType = body.cost_type;
  if (body.departure_location !== undefined) payload.departureLocation = body.departure_location;
  if (body.arrival_location !== undefined) payload.arrivalLocation = body.arrival_location;
  if (body.item_description !== undefined) payload.itemDescription = body.item_description;
  if (body.transport_quantity !== undefined) payload.transportQuantity = body.transport_quantity;
  if (body.vehicle_count !== undefined) payload.vehicleCount = body.vehicle_count;
  if (body.total_logistics_cost !== undefined) {
    payload.totalLogisticsCost = body.total_logistics_cost;
  }
  if (body.scheduled_date !== undefined) payload.scheduledDate = body.scheduled_date;
  if (body.memo !== undefined) payload.memo = body.memo;
  if (body.version !== undefined) payload.version = mapVersionRequestToPayload(body.version);

  return payload;
}

function mapValidatedToServiceInput(
  validated: ValidatedCreateLogisticsInput,
): CreateLogisticsInput {
  const input: CreateLogisticsInput = {
    formulaId: validated.formulaId,
    carrierCompanyId: validated.carrierCompanyId,
    totalLogisticsCost: validated.totalLogisticsCost,
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

  if (validated.departureCompanyId !== undefined) {
    input.departureCompanyId = validated.departureCompanyId;
  }
  if (validated.arrivalCompanyId !== undefined) input.arrivalCompanyId = validated.arrivalCompanyId;
  if (validated.costBearerCompanyId !== undefined) {
    input.costBearerCompanyId = validated.costBearerCompanyId;
  }
  if (validated.costType !== undefined) input.costType = validated.costType;
  if (validated.departureLocation !== undefined) input.departureLocation = validated.departureLocation;
  if (validated.arrivalLocation !== undefined) input.arrivalLocation = validated.arrivalLocation;
  if (validated.itemDescription !== undefined) input.itemDescription = validated.itemDescription;
  if (validated.transportQuantity !== undefined) {
    input.transportQuantity = validated.transportQuantity;
  }
  if (validated.vehicleCount !== undefined) input.vehicleCount = validated.vehicleCount;
  if (validated.scheduledDate !== undefined) input.scheduledDate = validated.scheduledDate;
  if (validated.memo !== undefined) input.memo = validated.memo;

  return input;
}

function mapUpdateLogisticsStatusPayload(
  formulaId: string,
  body: UpdateLogisticsStatusRequest,
): UpdateLogisticsStatusInputPayload {
  const payload: UpdateLogisticsStatusInputPayload = { formulaId };

  if (body.status !== undefined) payload.status = body.status;
  if (body.changed_by !== undefined) payload.changedBy = body.changed_by;
  if (body.change_reason !== undefined) payload.changeReason = body.change_reason;

  return payload;
}

function mapValidatedToUpdateStatusInput(
  validated: ValidatedUpdateLogisticsStatusInput,
): Parameters<LogisticsService['updateLogisticsStatus']>[0] {
  return {
    formulaId: validated.formulaId,
    status: validated.status,
    changedBy: validated.changedBy,
    changeReason: validated.changeReason,
  };
}

function mapLogisticsActionError(error: unknown): never {
  if (error instanceof ValidationError) {
    throw new ActionError(400, error.message);
  }

  if (error instanceof FormulaNotFoundError) {
    throw new ActionError(404, error.message);
  }

  if (error instanceof CompanyNotFoundError) {
    throw new ActionError(404, error.message);
  }

  if (error instanceof LogisticsNotFoundError) {
    throw new ActionError(404, error.message);
  }

  if (error instanceof LogisticsCostBearerRequiredError) {
    throw new ActionError(400, error.message);
  }

  if (error instanceof ClosedFormulaTradeMutationError) {
    throw new ActionError(409, error.message);
  }

  if (error instanceof VersionConflictError) {
    throw new ActionError(409, error.message);
  }

  throw error;
}

export class LogisticsActions {
  constructor(private readonly service: LogisticsService = logisticsService) {}

  async createLogistics(
    formulaId: string,
    body: CreateLogisticsRequest,
  ): Promise<CreateLogisticsResponse> {
    try {
      const validated = validateCreateLogistics(mapCreateLogisticsPayload(formulaId, body));
      const result = await this.service.createLogistics(mapValidatedToServiceInput(validated));
      return toCreateLogisticsResponse(result);
    } catch (error) {
      mapLogisticsActionError(error);
    }
  }

  async getLogisticsById(logisticsId: string): Promise<LogisticsResponse> {
    try {
      const logistics = await this.service.getLogisticsById(logisticsId);
      return toLogisticsResponse(logistics);
    } catch (error) {
      mapLogisticsActionError(error);
    }
  }

  async listLogisticsByFormulaId(formulaId: string): Promise<LogisticsListResponse> {
    try {
      const items = await this.service.listLogisticsByFormulaId(formulaId);
      return {
        items: items.map(toLogisticsResponse),
      };
    } catch (error) {
      mapLogisticsActionError(error);
    }
  }

  async updateLogisticsStatus(
    formulaId: string,
    body: UpdateLogisticsStatusRequest,
  ): Promise<UpdateLogisticsStatusResponse> {
    try {
      const validated = validateUpdateLogisticsStatus(
        mapUpdateLogisticsStatusPayload(formulaId, body),
      );
      const result = await this.service.updateLogisticsStatus(
        mapValidatedToUpdateStatusInput(validated),
      );
      return toUpdateLogisticsStatusResponse(result);
    } catch (error) {
      mapLogisticsActionError(error);
    }
  }
}

export const logisticsActions = new LogisticsActions();

export async function createLogistics(
  formulaId: string,
  body: CreateLogisticsRequest,
): Promise<CreateLogisticsResponse> {
  return logisticsActions.createLogistics(formulaId, body);
}

export async function getLogisticsById(logisticsId: string): Promise<LogisticsResponse> {
  return logisticsActions.getLogisticsById(logisticsId);
}

export async function listLogisticsByFormulaId(
  formulaId: string,
): Promise<LogisticsListResponse> {
  return logisticsActions.listLogisticsByFormulaId(formulaId);
}

export async function updateLogisticsStatus(
  formulaId: string,
  body: UpdateLogisticsStatusRequest,
): Promise<UpdateLogisticsStatusResponse> {
  return logisticsActions.updateLogisticsStatus(formulaId, body);
}
