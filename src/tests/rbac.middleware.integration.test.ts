/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import 'dotenv/config';

import { MembershipRole, UserStatus } from '@prisma/client';
import Fastify, { type FastifyInstance } from 'fastify';

import { loadEnvironment } from '../config/env.js';
import {
  registerAuthentication,
  type AuthenticationDeps,
} from '../http/plugins/authentication.js';
import {
  RBAC_AUTHENTICATION_REQUIRED,
  RBAC_FORBIDDEN,
  requireCompanyScope,
  requireRole,
} from '../http/plugins/rbac.js';
import { registerRequestLogger } from '../http/plugins/request-logger.js';
import { prisma } from '../lib/prisma.js';
import { authRepository } from '../repositories/auth.repository.js';
import { AuthService } from '../services/auth.service.js';
import { CredentialService } from '../services/credential.service.js';
import { TokenService } from '../services/token.service.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const validPassword = 'SecurePass!2026';

const MANAGER_PLUS_ROLES = [
  MembershipRole.MANAGER,
  MembershipRole.COMPANY_ADMIN,
  MembershipRole.SUPER_ADMIN,
];

const ROLE_PROBE_PATH = '/api/v1/_test/rbac/manager-plus';
const SCOPE_PROBE_PATH = '/api/v1/_test/rbac/company';

function readJsonBody(payload: string): Record<string, unknown> {
  return JSON.parse(payload) as Record<string, unknown>;
}

async function issueAccessTokenForUser(
  authService: AuthService,
  tokens: TokenService,
  email: string,
): Promise<string> {
  const principal = await authService.login({ email, password: validPassword });
  return tokens.issueAccessToken(principal);
}

async function createRbacTestApp(deps: AuthenticationDeps = {}): Promise<FastifyInstance> {
  loadEnvironment();

  const app = Fastify();
  await registerRequestLogger(app);
  await registerAuthentication(app, deps);

  app.get(
    ROLE_PROBE_PATH,
    { preHandler: requireRole(MANAGER_PLUS_ROLES) },
    async () => ({ ok: true }),
  );

  app.get(
    `${SCOPE_PROBE_PATH}/:companyId`,
    {
      preHandler: requireCompanyScope((request) => {
        const params = request.params as { companyId?: string };
        return params.companyId;
      }),
    },
    async () => ({ ok: true }),
  );

  return app;
}

test('RBAC middleware integration', { skip: !hasDatabase }, async (t) => {
  const suffix = Date.now();
  const companyIds: string[] = [];
  const userIds: string[] = [];
  const membershipIds: string[] = [];

  const credentialService = new CredentialService();
  const authService = new AuthService(authRepository, credentialService);
  const tokenService = new TokenService();

  const emails = {
    superAdmin: `rbac-super-${suffix}@example.com`,
    companyAdmin: `rbac-admin-${suffix}@example.com`,
    manager: `rbac-manager-${suffix}@example.com`,
    viewer: `rbac-viewer-${suffix}@example.com`,
    multiMembership: `rbac-multi-${suffix}@example.com`,
  };

  t.after(async () => {
    if (membershipIds.length > 0) {
      await prisma.companyMembership
        .deleteMany({ where: { id: { in: membershipIds } } })
        .catch(() => undefined);
    }
    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined);
    }
    if (companyIds.length > 0) {
      await prisma.company.deleteMany({ where: { id: { in: companyIds } } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  async function createCompany(name: string): Promise<string> {
    const company = await prisma.company.create({
      data: {
        companyName: name,
        isActive: true,
      },
    });
    companyIds.push(company.id);
    return company.id;
  }

  async function createUserWithRole(
    email: string,
    role: MembershipRole,
    companyId: string,
  ): Promise<string> {
    const passwordHash = await credentialService.hashPasswordForStorage(validPassword, { email });
    const user = await authRepository.createUser({
      email,
      passwordHash,
      name: email.split('@')[0] ?? email,
      status: UserStatus.ACTIVE,
    });
    userIds.push(user.id);

    const membership = await authRepository.createCompanyMembership({
      companyId,
      userId: user.id,
      role,
      isActive: true,
    });
    membershipIds.push(membership.id);

    return user.id;
  }

  const primaryCompanyId = await createCompany(`RBAC Primary Co ${suffix}`);
  const secondaryCompanyId = await createCompany(`RBAC Secondary Co ${suffix}`);
  const outOfScopeCompanyId = await createCompany(`RBAC Out Of Scope Co ${suffix}`);

  await createUserWithRole(emails.superAdmin, MembershipRole.SUPER_ADMIN, primaryCompanyId);
  await createUserWithRole(emails.companyAdmin, MembershipRole.COMPANY_ADMIN, primaryCompanyId);
  await createUserWithRole(emails.manager, MembershipRole.MANAGER, primaryCompanyId);
  await createUserWithRole(emails.viewer, MembershipRole.VIEWER, primaryCompanyId);

  await createUserWithRole(
    emails.multiMembership,
    MembershipRole.MANAGER,
    primaryCompanyId,
  );
  const multiUser = await authRepository.findUserByEmail(emails.multiMembership);
  assert.ok(multiUser);
  const secondaryMembership = await authRepository.createCompanyMembership({
    companyId: secondaryCompanyId,
    userId: multiUser.id,
    role: MembershipRole.VIEWER,
    isActive: true,
  });
  membershipIds.push(secondaryMembership.id);

  const app = await createRbacTestApp({
    authRepository,
    credentialService,
    tokenService,
  });

  t.after(async () => {
    await app.close();
  });

  const tokensByEmail = {
    superAdmin: await issueAccessTokenForUser(authService, tokenService, emails.superAdmin),
    companyAdmin: await issueAccessTokenForUser(authService, tokenService, emails.companyAdmin),
    manager: await issueAccessTokenForUser(authService, tokenService, emails.manager),
    viewer: await issueAccessTokenForUser(authService, tokenService, emails.viewer),
    multiMembership: await issueAccessTokenForUser(
      authService,
      tokenService,
      emails.multiMembership,
    ),
  };

  await t.test('SUPER_ADMIN is allowed by requireRole', async () => {
    const response = await app.inject({
      method: 'GET',
      url: ROLE_PROBE_PATH,
      headers: {
        authorization: `Bearer ${tokensByEmail.superAdmin}`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(readJsonBody(response.payload), { ok: true });
  });

  await t.test('COMPANY_ADMIN is allowed by requireRole', async () => {
    const response = await app.inject({
      method: 'GET',
      url: ROLE_PROBE_PATH,
      headers: {
        authorization: `Bearer ${tokensByEmail.companyAdmin}`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(readJsonBody(response.payload), { ok: true });
  });

  await t.test('MANAGER is allowed by requireRole', async () => {
    const response = await app.inject({
      method: 'GET',
      url: ROLE_PROBE_PATH,
      headers: {
        authorization: `Bearer ${tokensByEmail.manager}`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(readJsonBody(response.payload), { ok: true });
  });

  await t.test('VIEWER is denied by requireRole with 403', async () => {
    const response = await app.inject({
      method: 'GET',
      url: ROLE_PROBE_PATH,
      headers: {
        authorization: `Bearer ${tokensByEmail.viewer}`,
      },
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(readJsonBody(response.payload), {
      message: RBAC_FORBIDDEN,
    });
  });

  await t.test('unauthenticated request returns 401', async () => {
    const response = await app.inject({
      method: 'GET',
      url: ROLE_PROBE_PATH,
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(readJsonBody(response.payload), {
      message: RBAC_AUTHENTICATION_REQUIRED,
    });
  });

  await t.test('company scope allows membership on target company', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${SCOPE_PROBE_PATH}/${primaryCompanyId}`,
      headers: {
        authorization: `Bearer ${tokensByEmail.manager}`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(readJsonBody(response.payload), { ok: true });
  });

  await t.test('company scope denies access outside memberships with 403', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${SCOPE_PROBE_PATH}/${outOfScopeCompanyId}`,
      headers: {
        authorization: `Bearer ${tokensByEmail.manager}`,
      },
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(readJsonBody(response.payload), {
      message: RBAC_FORBIDDEN,
    });
  });

  await t.test('multiple memberships allow scope on any member company', async () => {
    const primaryResponse = await app.inject({
      method: 'GET',
      url: `${SCOPE_PROBE_PATH}/${primaryCompanyId}`,
      headers: {
        authorization: `Bearer ${tokensByEmail.multiMembership}`,
      },
    });

    assert.equal(primaryResponse.statusCode, 200);

    const secondaryResponse = await app.inject({
      method: 'GET',
      url: `${SCOPE_PROBE_PATH}/${secondaryCompanyId}`,
      headers: {
        authorization: `Bearer ${tokensByEmail.multiMembership}`,
      },
    });

    assert.equal(secondaryResponse.statusCode, 200);

    const deniedResponse = await app.inject({
      method: 'GET',
      url: `${SCOPE_PROBE_PATH}/${outOfScopeCompanyId}`,
      headers: {
        authorization: `Bearer ${tokensByEmail.multiMembership}`,
      },
    });

    assert.equal(deniedResponse.statusCode, 403);
  });

  await t.test('request logger compatibility with RBAC-protected routes', async () => {
    const allowedResponse = await app.inject({
      method: 'GET',
      url: ROLE_PROBE_PATH,
      headers: {
        authorization: `Bearer ${tokensByEmail.manager}`,
      },
    });

    assert.equal(allowedResponse.statusCode, 200);
    assert.ok(allowedResponse.headers['x-request-id']);

    const deniedResponse = await app.inject({
      method: 'GET',
      url: ROLE_PROBE_PATH,
      headers: {
        authorization: `Bearer ${tokensByEmail.viewer}`,
      },
    });

    assert.equal(deniedResponse.statusCode, 403);
    assert.ok(deniedResponse.headers['x-request-id']);
  });
});
