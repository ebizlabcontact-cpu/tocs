import type { PaymentDirection, Prisma } from '@prisma/client';

/** Settlement Payment Schedule 검증 입력 */
export interface CreateSettlementPaymentScheduleInputPayload {
  formulaId?: string | null;
  participantId?: string | null;
  direction?: PaymentDirection | null;
  scheduledAmount?: Prisma.Decimal | number | string | null;
  dueDate?: string | Date | null;
  memo?: string | null;
}

/** Settlement Payment Schedule 검증 통과 출력 */
export interface ValidatedCreateSettlementPaymentScheduleInput {
  formulaId: string;
  participantId: string;
  direction: PaymentDirection;
  scheduledAmount: Prisma.Decimal | number | string;
  dueDate: Date;
  memo?: string | null;
}

/** Settlement Note 검증 입력 */
export interface CreateSettlementNoteInputPayload {
  formulaId?: string | null;
  note?: string | null;
  issueType?: string | null;
  changedBy?: string | null;
}

/** Settlement Note 검증 통과 출력 */
export interface ValidatedCreateSettlementNoteInput {
  formulaId: string;
  note: string;
  issueType?: string;
  changedBy?: string;
}
