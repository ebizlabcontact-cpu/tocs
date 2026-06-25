/** Close Formula 검증 입력 */
export interface CloseFormulaInputPayload {
  formulaId?: string;
  closedBy?: string | null;
}

/** Close Formula 검증 통과 출력 */
export interface ValidatedCloseFormulaInput {
  formulaId: string;
  closedBy?: string | null;
}
