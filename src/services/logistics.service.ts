import {
  LogisticsCostType,
  Prisma,
  StatusTarget,
  TradeStatus,
  type Formula,
  type Logistics,
  type StatusLog,
} from '@prisma/client';

import { prisma } from '../lib/prisma.js';
import {
  FormulaRepository,
  formulaRepository,
} from '../repositories/formula.repository.js';
import {
  LogisticsRepository,
  logisticsRepository,
} from '../repositories/logistics.repository.js';
import type { LogisticsCreateData } from '../repositories/logistics.repository.js';
import { CompanyService, companyService } from './company.service.js';
import { FormulaNotFoundError } from './formula.service.js';
import { assertNotClosedForTradeMutation } from './guards/closed-formula.guard.js';
import {
  VersionService,
  versionService as defaultVersionService,
} from './version.service.js';
import type {
  CreateVersionCalculationInput,
  CreateVersionInput,
  CreateVersionResult,
} from './version.service.js';

export class LogisticsNotFoundError extends Error {
  readonly status = 404 as const;

  constructor(id: string) {
    super(`Logistics not found: ${id}`);
    this.name = 'LogisticsNotFoundError';
  }
}

export class LogisticsCostBearerRequiredError extends Error {
  readonly status = 400 as const;

  constructor() {
    super('costBearerCompanyId is required when totalLogisticsCost is greater than 0');
    this.name = 'LogisticsCostBearerRequiredError';
  }
}

export interface LogisticsVersionPayload {
  changedBy: string;
  changeReason: string;
  snapshot: Prisma.InputJsonValue;
  calculation: CreateVersionCalculationInput;
}

export interface CreateLogisticsInput {
  formulaId: string;
  carrierCompanyId: string;
  totalLogisticsCost: Prisma.Decimal | number | string;
  version: LogisticsVersionPayload;
  departureCompanyId?: string;
  arrivalCompanyId?: string;
  costBearerCompanyId?: string;
  costType?: LogisticsCostType;
  departureLocation?: string | null;
  arrivalLocation?: string | null;
  itemDescription?: string | null;
  transportQuantity?: Prisma.Decimal | number | string;
  vehicleCount?: number;
  scheduledDate?: Date;
  memo?: string | null;
}

export interface CreateLogisticsResult {
  logistics: Logistics;
  version: CreateVersionResult;
}

export interface UpdateLogisticsStatusInput {
  formulaId: string;
  status: TradeStatus;
  changedBy: string;
  changeReason: string;
}

export interface UpdateLogisticsStatusResult {
  formula: Formula;
  statusLog: StatusLog;
}

function isPositiveLogisticsCost(cost: Prisma.Decimal | number | string): boolean {
  const numeric =
    typeof cost === 'object' && cost !== null && 'toNumber' in cost
      ? (cost as Prisma.Decimal).toNumber()
      : Number(cost);

  return Number.isFinite(numeric) && numeric > 0;
}

export class LogisticsService {
  constructor(
    private readonly repository: LogisticsRepository,
    private readonly versionService: VersionService,
    private readonly formulaRepository: FormulaRepository,
    private readonly companyService: CompanyService,
  ) {}

  async createLogistics(input: CreateLogisticsInput): Promise<CreateLogisticsResult> {
    await assertNotClosedForTradeMutation(input.formulaId);

    const formula = await this.formulaRepository.findById(input.formulaId);

    if (!formula) {
      throw new FormulaNotFoundError(`Formula not found: ${input.formulaId}`);
    }

    await this.companyService.getCompanyById(input.carrierCompanyId);

    if (input.departureCompanyId !== undefined) {
      await this.companyService.getCompanyById(input.departureCompanyId);
    }

    if (input.arrivalCompanyId !== undefined) {
      await this.companyService.getCompanyById(input.arrivalCompanyId);
    }

    if (input.costBearerCompanyId !== undefined) {
      await this.companyService.getCompanyById(input.costBearerCompanyId);
    }

    if (isPositiveLogisticsCost(input.totalLogisticsCost) && !input.costBearerCompanyId) {
      throw new LogisticsCostBearerRequiredError();
    }

    const data: LogisticsCreateData = {
      formulaId: input.formulaId,
      carrierCompanyId: input.carrierCompanyId,
      totalLogisticsCost: input.totalLogisticsCost,
    };

    if (input.departureCompanyId !== undefined) data.departureCompanyId = input.departureCompanyId;
    if (input.arrivalCompanyId !== undefined) data.arrivalCompanyId = input.arrivalCompanyId;
    if (input.costBearerCompanyId !== undefined) data.costBearerCompanyId = input.costBearerCompanyId;
    if (input.costType !== undefined) data.costType = input.costType;
    if (input.departureLocation !== undefined) data.departureLocation = input.departureLocation;
    if (input.arrivalLocation !== undefined) data.arrivalLocation = input.arrivalLocation;
    if (input.itemDescription !== undefined) data.itemDescription = input.itemDescription;
    if (input.transportQuantity !== undefined) data.transportQuantity = input.transportQuantity;
    if (input.vehicleCount !== undefined) data.vehicleCount = input.vehicleCount;
    if (input.scheduledDate !== undefined) data.scheduledDate = input.scheduledDate;
    if (input.memo !== undefined) data.memo = input.memo;

    const logistics = await this.repository.createLogistics(data);
    const version = await this.versionService.createVersion(
      this.toCreateVersionInput(logistics.formulaId, input.version),
    );

    return { logistics, version };
  }

  async getLogisticsById(id: string): Promise<Logistics> {
    const logistics = await this.repository.findLogisticsById(id);

    if (!logistics) {
      throw new LogisticsNotFoundError(id);
    }

    return logistics;
  }

  async listLogisticsByFormulaId(formulaId: string): Promise<Logistics[]> {
    return this.repository.listLogisticsByFormulaId(formulaId);
  }

  async updateLogisticsStatus(
    input: UpdateLogisticsStatusInput,
  ): Promise<UpdateLogisticsStatusResult> {
    await assertNotClosedForTradeMutation(input.formulaId);

    const formula = await this.formulaRepository.findById(input.formulaId);

    if (!formula) {
      throw new FormulaNotFoundError(`Formula not found: ${input.formulaId}`);
    }

    const prevStatus = formula.logisticsStatus;

    return prisma.$transaction(async (tx) => {
      const updatedFormula = await tx.formula.update({
        where: { id: input.formulaId },
        data: { logisticsStatus: input.status },
      });

      const statusLog = await tx.statusLog.create({
        data: {
          formulaId: input.formulaId,
          statusTarget: StatusTarget.LOGISTICS_STATUS,
          prevStatus,
          newStatus: input.status,
          changedBy: input.changedBy,
          changeReason: input.changeReason,
        },
      });

      return { formula: updatedFormula, statusLog };
    });
  }

  private toCreateVersionInput(
    formulaId: string,
    version: LogisticsVersionPayload,
  ): CreateVersionInput {
    return {
      formulaId,
      changedBy: version.changedBy,
      changeReason: version.changeReason,
      snapshot: version.snapshot,
      calculation: version.calculation,
    };
  }
}

export const logisticsService = new LogisticsService(
  logisticsRepository,
  defaultVersionService,
  formulaRepository,
  companyService,
);
