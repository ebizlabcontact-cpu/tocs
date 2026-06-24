import { PrismaClient, type Prisma, type Share } from '@prisma/client';

const prisma = new PrismaClient();

export type ShareCreateData = Omit<Prisma.ShareUncheckedCreateInput, 'id'>;

export type ShareUpdateData = Omit<Prisma.ShareUncheckedUpdateInput, 'id' | 'formulaId'>;

export class ShareRepository {
  async createShare(data: ShareCreateData): Promise<Share> {
    return prisma.share.create({ data });
  }

  async findShareById(id: string): Promise<Share | null> {
    return prisma.share.findUnique({ where: { id } });
  }

  async listSharesByFormulaId(formulaId: string): Promise<Share[]> {
    return prisma.share.findMany({
      where: { formulaId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listSharesByParticipantId(participantId: string): Promise<Share[]> {
    return prisma.share.findMany({
      where: { participantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateShare(id: string, data: ShareUpdateData): Promise<Share> {
    return prisma.share.update({
      where: { id },
      data,
    });
  }

  async deleteShare(id: string): Promise<Share> {
    return prisma.share.delete({
      where: { id },
    });
  }
}

export const shareRepository = new ShareRepository();
