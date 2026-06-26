import { type FormulaParticipant, type Prisma } from '@prisma/client';

import { prisma } from '../lib/prisma.js';

/** id는 DB DEFAULT gen_random_uuid()에 위임 — Repository 입력에서 제외 */
export type ParticipantCreateData = Omit<
  Prisma.FormulaParticipantUncheckedCreateInput,
  | 'id'
  | 'paymentSchedules'
  | 'paymentRecords'
  | 'shares'
  | 'invoicesAsIssuer'
  | 'invoicesAsReceiver'
>;

export class ParticipantRepository {
  async createParticipant(data: ParticipantCreateData): Promise<FormulaParticipant> {
    return prisma.formulaParticipant.create({ data });
  }

  async findParticipantById(id: string): Promise<FormulaParticipant | null> {
    return prisma.formulaParticipant.findUnique({ where: { id } });
  }

  async listParticipantsByFormulaId(formulaId: string): Promise<FormulaParticipant[]> {
    return prisma.formulaParticipant.findMany({
      where: { formulaId },
      orderBy: [{ sequenceOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findParticipantByFormulaAndSequence(
    formulaId: string,
    sequenceOrder: number,
  ): Promise<FormulaParticipant | null> {
    return prisma.formulaParticipant.findUnique({
      where: {
        uq_fp_sequence: {
          formulaId,
          sequenceOrder,
        },
      },
    });
  }

  async findStartPointByFormulaId(formulaId: string): Promise<FormulaParticipant | null> {
    return prisma.formulaParticipant.findFirst({
      where: {
        formulaId,
        isStartPoint: true,
      },
    });
  }

  async findEndPointByFormulaId(formulaId: string): Promise<FormulaParticipant | null> {
    return prisma.formulaParticipant.findFirst({
      where: {
        formulaId,
        isEndPoint: true,
      },
    });
  }
}

export const participantRepository = new ParticipantRepository();
