export type CompanyScopeMode = 'all' | 'company';

export interface CompanyScopeFilter {
  mode: CompanyScopeMode;
  companyId: string | null;
}
