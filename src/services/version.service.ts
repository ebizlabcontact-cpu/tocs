import {
  Prisma,
  PrismaClient,
  type AuditLog,
  type CalculationSnapshot,
  type FormulaVersion,
} from '@prisma/client';

import {
  FormulaVersionRepository,
  formulaVersionRepository,
} from '../repositories/version.repository.js';

const prisma = new PrismaClient();

export class VersionConflictError extends Error {
  readonly status = 409 as const;

  constructor(formulaId: string) {
    super(`Concurrent version conflict for formula: ${formulaId}`);
    this.name = 'VersionConflictError';
  }
}

export class VersionNotFoundError extends Error {
  constructor(id: string) {
    super(`Version not found: ${id}`);
    this.name = 'VersionNotFoundError';
  }
}

export interface CreateVersionCalculationInput {
  quantity: Prisma.Decimal | number | string;
  totalBuyAmount: Prisma.Decimal | number | string;
  totalSellAmount: Prisma.Decimal | number | string;
  totalCost: Prisma.Decimal | number | string;
  totalShare: Prisma.Decimal | number | string;
  netProfit: Prisma.Decimal | number | string;
  profitRate?: Prisma.Decimal | number | string | null;
  exchangeRateUsed?: Prisma.Decimal | number | string | null;
  snapshotData: Prisma.InputJsonValue;
}

export interface CreateVersionInput {
  formulaId: string;
  changedBy?: string | null;
  changeReason?: string | null;
  snapshot: Prisma.InputJsonValue;
  calculation: CreateVersionCalculationInput;
}

export interface CreateVersionResult {
  version: FormulaVersion;
  snapshot: CalculationSnapshot;
  auditLog: AuditLog;
}

function isVersionNoUniqueViolation(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    const target = error.meta?.target;

    if (Array.isArray(target)) {
      return (
        (target.includes('formulaId') || target.includes('formula_id')) &&
        (target.includes('versionNo') || target.includes('version_no'))
      );
    }

    if (typeof target === 'string') {
      return (
        (target.includes('formulaId') || target.includes('formula_id')) &&
        (target.includes('versionNo') || target.includes('version_no'))
      );
    }
  }

  return false;
}

export class VersionService {
  constructor(
    private readonly versionRepository: FormulaVersionRepository = formulaVersionRepository,
  ) {}

  async createVersion(input: CreateVersionInput): Promise<CreateVersionResult> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await this.createVersionOnce(input, attempt > 0);
      } catch (error) {
        if (isVersionNoUniqueViolation(error) && attempt === 0) {
          continue;
        }

        if (isVersionNoUniqueViolation(error)) {
          throw new VersionConflictError(input.formulaId);
        }

        throw error;
      }
    }

    throw new VersionConflictError(input.formulaId);
  }

  async getVersionById(id: string) {
    const version = await this.versionRepository.findVersionById(id);

    if (!version) {
      throw new VersionNotFoundError(id);
    }

    return version;
  }

  async listVersionsByFormulaId(formulaId: string) {
    return this.versionRepository.listVersionsByFormulaId(formulaId);
  }

  async getLatestVersionByFormulaId(formulaId: string) {
    const version = await this.versionRepository.findLatestVersionByFormulaId(formulaId);

    if (!version) {
      throw new VersionNotFoundError(formulaId);
    }

    return version;
  }

  private async createVersionOnce(
    input: CreateVersionInput,
    isRetry: boolean,
  ): Promise<CreateVersionResult> {
    const maxVersionNo = await this.versionRepository.findMaxVersionNoByFormulaId(
      input.formulaId,
    );
    const versionNo = (maxVersionNo ?? 0) + 1;

    return prisma.$transaction(async (tx) => {
      const versionData: Prisma.FormulaVersionUncheckedCreateInput = {
        formulaId: input.formulaId,
        versionNo,
        snapshot: input.snapshot,
      };

      if (input.changedBy !== undefined) versionData.changedBy = input.changedBy;
      if (input.changeReason !== undefined) versionData.changeReason = input.changeReason;

      const version = await tx.formulaVersion.create({ data: versionData });

      const snapshotData: Prisma.CalculationSnapshotUncheckedCreateInput = {
        formulaId: input.formulaId,
        formulaVersionId: version.id,
        quantity: input.calculation.quantity,
        totalBuyAmount: input.calculation.totalBuyAmount,
        totalSellAmount: input.calculation.totalSellAmount,
        totalCost: input.calculation.totalCost,
        totalShare: input.calculation.totalShare,
        netProfit: input.calculation.netProfit,
        snapshotData: input.calculation.snapshotData,
      };

      if (input.calculation.profitRate !== undefined) {
        snapshotData.profitRate = input.calculation.profitRate;
      }
      if (input.calculation.exchangeRateUsed !== undefined) {
        snapshotData.exchangeRateUsed = input.calculation.exchangeRateUsed;
      }

      const snapshot = await tx.calculationSnapshot.create({ data: snapshotData });

      const auditLog = await tx.auditLog.create({
        data: {
          tableName: 'formula_versions',
          recordId: version.id,
          action: isRetry ? 'VERSION_RETRY' : 'VERSION_CREATE',
          changedBy: input.changedBy ?? null,
          newData: {
            formulaId: input.formulaId,
            versionNo,
            changeReason: input.changeReason ?? null,
            formulaVersionId: version.id,
            snapshotId: snapshot.id,
          },
        },
      });

      return { version, snapshot, auditLog };
    });
  }
}

export const versionService = new VersionService();
