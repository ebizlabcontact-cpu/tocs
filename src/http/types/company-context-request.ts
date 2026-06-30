export type CompanyContextMode = 'company' | 'all';

export interface RequestCompanyContext {
  mode: CompanyContextMode;
  companyId: string | null;
}

declare module 'fastify' {
  interface FastifyRequest {
    companyContext: RequestCompanyContext | null;
  }
}
