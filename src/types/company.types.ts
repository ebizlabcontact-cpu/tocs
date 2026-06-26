/** Company 생성 검증 입력 (필드 누락 허용) */
export interface CreateCompanyInputPayload {
  companyName?: string | null;
  businessRegNo?: string | null;
  representativeName?: string | null;
  mainPhone?: string | null;
  hqAddress?: string | null;
  memo?: string | null;
}

/** 검증 통과 후 Service에 전달 가능한 Company 생성 입력 */
export interface ValidatedCreateCompanyInput {
  companyName: string;
  businessRegNo?: string | null;
  representativeName?: string | null;
  mainPhone?: string | null;
  hqAddress?: string | null;
  memo?: string | null;
}

/** Company 목록 조회 검증 입력 */
export interface ListCompaniesInputPayload {
  page?: number | string | null;
  pageSize?: number | string | null;
  isActive?: boolean | string | null;
}

/** Company 목록 조회 검증 통과 출력 */
export interface ValidatedListCompaniesInput {
  page?: number;
  pageSize?: number;
  isActive?: boolean;
}

export interface CompanyResponse {
  id: string;
  company_name: string;
  business_reg_no: string | null;
  representative_name: string | null;
  main_phone: string | null;
  hq_address: string | null;
  is_active: boolean;
  memo: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyListResponse {
  items: CompanyResponse[];
  total: number;
  page: number;
  page_size: number;
}
