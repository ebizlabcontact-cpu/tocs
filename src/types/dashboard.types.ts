/** Dashboard 단건 조회 검증 입력 */
export interface FormulaIdInputPayload {
  formulaId?: string | null;
}

/** Dashboard 단건 조회 검증 통과 출력 */
export interface ValidatedFormulaIdInput {
  formulaId: string;
}

/** Dashboard 목록 조회 검증 입력 */
export interface DashboardListInputPayload {
  formulaId?: string | null;
  participantId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number | string | null;
  offset?: number | string | null;
}

/** Dashboard 목록 조회 검증 통과 출력 */
export interface ValidatedDashboardListInput {
  formulaId?: string;
  participantId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit: number;
  offset: number;
}

export const DEFAULT_DASHBOARD_LIST_LIMIT = 50;
export const DEFAULT_DASHBOARD_LIST_OFFSET = 0;
