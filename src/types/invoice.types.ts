import type { InvoiceStatus, Prisma } from '@prisma/client';

/** Invoice 생성 검증 입력 (필드 누락 허용) */
export interface CreateInvoiceInputPayload {
  formulaId?: string;
  issuerParticipantId?: string | null;
  receiverParticipantId?: string | null;
  sequenceOrder?: number | null;
  invoiceType?: string | null;
  issueAmount?: Prisma.Decimal | number | string | null;
}

/** Invoice 생성 검증 통과 출력 */
export interface ValidatedCreateInvoiceInput {
  formulaId: string;
  issuerParticipantId: string;
  receiverParticipantId: string;
  sequenceOrder: number;
  invoiceType: string;
  issueAmount: Prisma.Decimal | number | string;
}

/** Invoice 상태 변경 검증 입력 */
export interface UpdateInvoiceStatusInputPayload {
  status?: InvoiceStatus | string | null;
}

/** Invoice 상태 변경 검증 통과 출력 */
export interface ValidatedUpdateInvoiceStatusInput {
  status: InvoiceStatus;
}
