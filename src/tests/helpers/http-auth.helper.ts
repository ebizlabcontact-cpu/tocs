import { MembershipRole, UserStatus } from '@prisma/client';

import { authRepository } from '../../repositories/auth.repository.js';
import { AuthService } from '../../services/auth.service.js';
import { CredentialService } from '../../services/credential.service.js';
import { TokenService } from '../../services/token.service.js';
import { prisma } from '../../lib/prisma.js';

export const TEST_AUTH_PASSWORD = 'SecurePass!2026';

export interface TestAuthFixture {
  userId: string;
  companyId: string;
  membershipId: string;
  email: string;
  accessToken: string;
  role: MembershipRole;
}

export function bearerHeaders(accessToken: string): { authorization: string } {
  return { authorization: `Bearer ${accessToken}` };
}

export function withBearer(
  accessToken: string,
  headers: Record<string, string> = {},
): Record<string, string> {
  return {
    ...headers,
    authorization: `Bearer ${accessToken}`,
  };
}

export function withCompanyId(
  accessToken: string,
  companyId: string,
  headers: Record<string, string> = {},
): Record<string, string> {
  return withBearer(accessToken, {
    ...headers,
    'x-company-id': companyId,
  });
}

export function withCompanyScopeAll(
  accessToken: string,
  headers: Record<string, string> = {},
): Record<string, string> {
  return withBearer(accessToken, {
    ...headers,
    'x-company-scope': 'all',
  });
}

export async function createTestAuthFixture(
  role: MembershipRole,
  emailPrefix: string,
): Promise<TestAuthFixture> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `${emailPrefix}-${suffix}@example.com`;
  const credentialService = new CredentialService();
  const authService = new AuthService(authRepository, credentialService);
  const tokenService = new TokenService();

  const company = await prisma.company.create({
    data: {
      companyName: `${emailPrefix} Co ${suffix}`,
      isActive: true,
    },
  });

  const passwordHash = await credentialService.hashPasswordForStorage(TEST_AUTH_PASSWORD, {
    email,
  });

  const user = await authRepository.createUser({
    email,
    passwordHash,
    name: `${emailPrefix} User`,
    status: UserStatus.ACTIVE,
  });

  const membership = await authRepository.createCompanyMembership({
    companyId: company.id,
    userId: user.id,
    role,
    isActive: true,
  });

  const principal = await authService.login({ email, password: TEST_AUTH_PASSWORD });
  const accessToken = tokenService.issueAccessToken(principal);

  return {
    userId: user.id,
    companyId: company.id,
    membershipId: membership.id,
    email,
    accessToken,
    role,
  };
}

export async function deleteTestAuthFixture(fixture: TestAuthFixture): Promise<void> {
  await prisma.companyMembership
    .deleteMany({ where: { id: fixture.membershipId } })
    .catch(() => undefined);
  await prisma.user.deleteMany({ where: { id: fixture.userId } }).catch(() => undefined);
  await prisma.company.deleteMany({ where: { id: fixture.companyId } }).catch(() => undefined);
}
