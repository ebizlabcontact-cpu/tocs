import { type Formula } from '@prisma/client';

import {
  CloseRepository,
  closeRepository,
} from '../repositories/close.repository.js';
import type { FormulaCloseableRow } from '../repositories/close.repository.js';

export class FormulaCloseStatusNotFoundError extends Error {
  constructor(formulaId: string) {
    super(`Formula close status not found: ${formulaId}`);
    this.name = 'FormulaCloseStatusNotFoundError';
  }
}

export class FormulaNotCloseableError extends Error {
  constructor(formulaId: string) {
    super(`Formula is not closeable: ${formulaId}`);
    this.name = 'FormulaNotCloseableError';
  }
}

export interface FormulaCloseStatus {
  formulaId: string;
  formulaNo: string;
  tradeDone: boolean;
  deliveryDone: boolean;
  cashInDone: boolean;
  cashOutDone: boolean;
  invoiceDone: boolean;
  logisticsDone: boolean;
  canClose: boolean;
  isClosed: boolean;
}

export interface CloseFormulaInput {
  formulaId: string;
  closedBy?: string | null;
}

export interface CloseFormulaResult {
  formula: Formula;
  status: FormulaCloseStatus;
}

function toFormulaCloseStatus(row: FormulaCloseableRow): FormulaCloseStatus {
  return {
    formulaId: row.formula_id,
    formulaNo: row.formula_no,
    tradeDone: row.trade_done,
    deliveryDone: row.delivery_done,
    cashInDone: row.cash_in_done,
    cashOutDone: row.cash_out_done,
    invoiceDone: row.invoice_done,
    logisticsDone: row.logistics_done,
    canClose: row.can_close,
    isClosed: row.is_closed,
  };
}

export class CloseService {
  constructor(private readonly repository: CloseRepository = closeRepository) {}

  async getFormulaCloseStatus(formulaId: string): Promise<FormulaCloseStatus> {
    const row = await this.repository.findCloseableByFormulaId(formulaId);

    if (!row) {
      throw new FormulaCloseStatusNotFoundError(formulaId);
    }

    return toFormulaCloseStatus(row);
  }

  async closeFormula(input: CloseFormulaInput): Promise<CloseFormulaResult> {
    const row = await this.repository.findCloseableByFormulaId(input.formulaId);

    if (!row) {
      throw new FormulaCloseStatusNotFoundError(input.formulaId);
    }

    if (!row.can_close) {
      throw new FormulaNotCloseableError(input.formulaId);
    }

    const formula = await this.repository.closeFormula(input.formulaId, input.closedBy);

    const statusRow = await this.repository.findCloseableByFormulaId(input.formulaId);

    if (!statusRow) {
      throw new FormulaCloseStatusNotFoundError(input.formulaId);
    }

    return {
      formula,
      status: toFormulaCloseStatus(statusRow),
    };
  }
}

export const closeService = new CloseService();
