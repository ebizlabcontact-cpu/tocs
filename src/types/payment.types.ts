import type { PaymentDirection, PaymentGroup, PaymentStatus, Prisma } from '@prisma/client';

/** PaymentSchedule(예정) 검증 입력 */
export interface CreatePaymentScheduleInputPayload {
  formulaId?: string;
  participantId?: string | null;
  amount?: Prisma.Decimal | number | string | null;
  direction?: PaymentDirection;
  paymentType?: PaymentGroup;
  counterpartyCompanyId?: string | null;
  scheduledDate?: Date | string | null;
  status?: PaymentStatus;
  memo?: string | null;
}

/** PaymentSchedule(예정) 검증 통과 출력 */
export interface ValidatedPaymentScheduleInput {
  formulaId: string;
  participantId: string;
  scheduledAmount: Prisma.Decimal | number | string;
  direction?: PaymentDirection;
  paymentType?: PaymentGroup;
  counterpartyCompanyId?: string | null;
  scheduledDate?: Date | string | null;
  status?: PaymentStatus;
  memo?: string | null;
}

/** PaymentRecord(실적) 검증 입력 */
export interface CreatePaymentRecordInputPayload {
  formulaId?: string;
  participantId?: string | null;
  amount?: Prisma.Decimal | number | string | null;
  direction?: PaymentDirection;
  actualDate?: Date | string;
  paymentScheduleId?: string | null;
  counterpartyCompanyId?: string | null;
  bankName?: string | null;
  accountName?: string | null;
  accountNo?: string | null;
  bankAccountMemo?: string | null;
  confirmedBy?: string | null;
  confirmedAt?: Date | string | null;
  status?: PaymentStatus;
  memo?: string | null;
}

/** PaymentRecord(실적) 검증 통과 출력 */
export interface ValidatedPaymentRecordInput {
  formulaId: string;
  participantId: string;
  actualAmount: Prisma.Decimal | number | string;
  direction?: PaymentDirection;
  actualDate?: Date | string;
  paymentScheduleId?: string | null;
  counterpartyCompanyId?: string | null;
  bankName?: string | null;
  accountName?: string | null;
  accountNo?: string | null;
  bankAccountMemo?: string | null;
  confirmedBy?: string | null;
  confirmedAt?: Date | string | null;
  status?: PaymentStatus;
  memo?: string | null;
}

/** PaymentRecord 취소 검증 입력 */
export interface CancelPaymentRecordInputPayload {
  cancelReason?: string | null;
}

/** PaymentRecord 취소 검증 통과 출력 */
export interface ValidatedCancelPaymentRecordInput {
  cancelReason: string;
}
