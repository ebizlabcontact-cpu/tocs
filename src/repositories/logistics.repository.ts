import { type Logistics, type Prisma, type StatusLog } from '@prisma/client';

import { prisma } from '../lib/prisma.js';

/** id는 DB DEFAULT gen_random_uuid()에 위임 — Repository 입력에서 제외 */
export type LogisticsCreateData = Omit<
  Prisma.LogisticsUncheckedCreateInput,
  'id' | 'vehicles'
>;

/** id는 DB DEFAULT gen_random_uuid()에 위임 — Repository 입력에서 제외 */
export type LogisticsStatusLogCreateData = Omit<Prisma.StatusLogUncheckedCreateInput, 'id'>;

export class LogisticsRepository {
  async createLogistics(data: LogisticsCreateData): Promise<Logistics> {
    return prisma.logistics.create({ data });
  }

  async findLogisticsById(id: string): Promise<Logistics | null> {
    return prisma.logistics.findUnique({ where: { id } });
  }

  async listLogisticsByFormulaId(formulaId: string): Promise<Logistics[]> {
    return prisma.logistics.findMany({
      where: { formulaId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async createLogisticsStatusLog(data: LogisticsStatusLogCreateData): Promise<StatusLog> {
    return prisma.statusLog.create({ data });
  }

  async listStatusLogsByFormulaId(formulaId: string): Promise<StatusLog[]> {
    return prisma.statusLog.findMany({
      where: { formulaId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }
}

export const logisticsRepository = new LogisticsRepository();
