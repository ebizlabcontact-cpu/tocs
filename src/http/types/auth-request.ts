import type { MembershipRole } from '@prisma/client';

export interface RequestAuthMembership {
  company_id: string;
  role: MembershipRole;
}

export interface RequestAuthContext {
  userId: string;
  email: string;
  roles: MembershipRole[];
  memberships: RequestAuthMembership[];
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: RequestAuthContext | null;
  }
}
