import {
  PrismaClient,
  type AuditLog,
  type CalculationSnapshot,
  type FormulaVersion,
  type Prisma,
} from '@prisma/client';

const prisma = new PrismaClient();

/** versionNo는 Service가 계산해 명시 전달 — Repository는 저장만 */
export type FormulaVersionCreateData = Omit<
  Prisma.FormulaVersionUncheckedCreateInput,
  'id' | 'calculationSnapshots'
>;

export type CalculationSnapshotCreateData = Omit<
  Prisma.CalculationSnapshotUncheckedCreateInput,
  'id'
>;

export type AuditLogCreateData = Omit<Prisma.AuditLogUncheckedCreateInput, 'id'>;

export class FormulaVersionRepository {
  async createVersion(data: FormulaVersionCreateData): Promise<FormulaVersion> {
    return prisma.formulaVersion.create({ data });
  }

  async findVersionById(id: string): Promise<FormulaVersion | null> {
    return prisma.formulaVersion.findUnique({ where: { id } });
  }

  async listVersionsByFormulaId(formulaId: string): Promise<FormulaVersion[]> {
    return prisma.formulaVersion.findMany({
      where: { formulaId },
      orderBy: { versionNo: 'desc' },
    });
  }

  async findLatestVersionByFormulaId(formulaId: string): Promise<FormulaVersion | null> {
    return prisma.formulaVersion.findFirst({
      where: { formulaId },
      orderBy: { versionNo: 'desc' },
    });
  }

  /** MAX(version_no) 조회만 — +1 계산은 Service 책임 */
  async findMaxVersionNoByFormulaId(formulaId: string): Promise<number | null> {
    const result = await prisma.formulaVersion.aggregate({
      where: { formulaId },
      _max: { versionNo: true },
    });

    return result._max.versionNo;
  }
}

export class CalculationSnapshotRepository {
  async createSnapshot(data: CalculationSnapshotCreateData): Promise<CalculationSnapshot> {
    return prisma.calculationSnapshot.create({ data });
  }

  async findSnapshotById(id: string): Promise<CalculationSnapshot | null> {
    return prisma.calculationSnapshot.findUnique({ where: { id } });
  }

  async listSnapshotsByFormulaId(formulaId: string): Promise<CalculationSnapshot[]> {
    return prisma.calculationSnapshot.findMany({
      where: { formulaId },
      orderBy: [
        { formulaVersion: { versionNo: 'desc' } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
    });
  }

  async findLatestSnapshotByFormulaId(formulaId: string): Promise<CalculationSnapshot | null> {
    return prisma.calculationSnapshot.findFirst({
      where: { formulaId },
      orderBy: [
        { formulaVersion: { versionNo: 'desc' } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
    });
  }
}

export class AuditLogRepository {
  async createAuditLog(data: AuditLogCreateData): Promise<AuditLog> {
    return prisma.auditLog.create({ data });
  }
}

export const formulaVersionRepository = new FormulaVersionRepository();
export const calculationSnapshotRepository = new CalculationSnapshotRepository();
export const auditLogRepository = new AuditLogRepository();
