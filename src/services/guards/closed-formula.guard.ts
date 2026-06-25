import { prisma } from '../../lib/prisma.js';

export class ClosedFormulaTradeMutationError extends Error {
  readonly status = 409 as const;

  constructor(message = 'Closed Formula cannot be modified through normal trade mutation paths.') {
    super(message);
    this.name = 'ClosedFormulaTradeMutationError';
  }
}

export class FormulaNotFoundForGuardError extends Error {
  readonly status = 404 as const;

  constructor(formulaId: string) {
    super(`Formula not found: ${formulaId}`);
    this.name = 'FormulaNotFoundForGuardError';
  }
}

export type ClosedSettlementAllowedOperation =
  | 'payment_record_create'
  | 'payment_record_cancel'
  | 'payment_schedule_create_settlement'
  | 'invoice_status_sync_matched'
  | 'settlement_note_create'
  | 'receivable_payable_read'
  | 'confirmed_kpi_read';

export interface FormulaClosedState {
  id: string;
  isClosed: boolean;
}

const CLOSED_SETTLEMENT_ALLOWED_OPERATIONS = new Set<ClosedSettlementAllowedOperation>([
  'payment_record_create',
  'payment_record_cancel',
  'payment_schedule_create_settlement',
  'invoice_status_sync_matched',
  'settlement_note_create',
  'receivable_payable_read',
  'confirmed_kpi_read',
]);

export async function getFormulaClosedState(formulaId: string): Promise<FormulaClosedState> {
  const formula = await prisma.formula.findUnique({
    where: { id: formulaId },
    select: { id: true, isClosed: true },
  });

  if (!formula) {
    throw new FormulaNotFoundForGuardError(formulaId);
  }

  return formula;
}

export async function assertNotClosedForTradeMutation(formulaId: string): Promise<void> {
  const { isClosed } = await getFormulaClosedState(formulaId);

  if (isClosed) {
    throw new ClosedFormulaTradeMutationError();
  }
}

export function assertClosedSettlementAllowedOperation(
  operation: string,
): asserts operation is ClosedSettlementAllowedOperation {
  if (!CLOSED_SETTLEMENT_ALLOWED_OPERATIONS.has(operation as ClosedSettlementAllowedOperation)) {
    throw new ClosedFormulaTradeMutationError();
  }
}
