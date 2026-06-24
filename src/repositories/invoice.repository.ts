import {
  PrismaClient,
  type Invoice,
  type InvoiceStatus,
  type Prisma,
} from '@prisma/client';

const prisma = new PrismaClient();

export type InvoiceCreateData = Omit<Prisma.InvoiceUncheckedCreateInput, 'id'>;

export interface UpdateInvoiceStatusData {
  invoiceId: string;
  status: InvoiceStatus;
}

export class InvoiceRepository {
  async createInvoice(data: InvoiceCreateData): Promise<Invoice> {
    return prisma.invoice.create({ data });
  }

  async findInvoiceById(id: string): Promise<Invoice | null> {
    return prisma.invoice.findUnique({ where: { id } });
  }

  async listInvoicesByFormulaId(formulaId: string): Promise<Invoice[]> {
    return prisma.invoice.findMany({
      where: { formulaId },
      orderBy: [{ sequenceOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async listInvoicesByParticipantId(participantId: string): Promise<Invoice[]> {
    return prisma.invoice.findMany({
      where: {
        OR: [
          { issuerParticipantId: participantId },
          { receiverParticipantId: participantId },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateInvoiceStatus(data: UpdateInvoiceStatusData): Promise<Invoice> {
    return prisma.invoice.update({
      where: { id: data.invoiceId },
      data: { status: data.status },
    });
  }
}

export const invoiceRepository = new InvoiceRepository();
