import { type Formula } from '@prisma/client';

import { prisma } from '../lib/prisma.js';

export interface FormulaCloseableRow {
  formula_id: string;
  formula_no: string;
  trade_done: boolean;
  delivery_done: boolean;
  cash_in_done: boolean;
  cash_out_done: boolean;
  invoice_done: boolean;
  logistics_done: boolean;
  can_close: boolean;
  is_closed: boolean;
}

export class CloseRepository {
  async findCloseableByFormulaId(formulaId: string): Promise<FormulaCloseableRow | null> {
    const rows = await prisma.$queryRaw<FormulaCloseableRow[]>`
      SELECT
        formula_id,
        formula_no,
        trade_done,
        delivery_done,
        cash_in_done,
        cash_out_done,
        invoice_done,
        logistics_done,
        can_close,
        is_closed
      FROM v_formula_closeable
      WHERE formula_id = ${formulaId}::uuid
    `;

    return rows[0] ?? null;
  }

  /**
   * formulas UPDATE only. Close eligibility is Service responsibility.
   * Note: formulas has no closed_by column — closedBy is accepted for Service/audit
   * wiring but is not persisted at Repository layer.
   */
  async closeFormula(formulaId: string, _closedBy?: string | null): Promise<Formula> {
    return prisma.formula.update({
      where: { id: formulaId },
      data: {
        isClosed: true,
        closedAt: new Date(),
      },
    });
  }
}

export const closeRepository = new CloseRepository();
