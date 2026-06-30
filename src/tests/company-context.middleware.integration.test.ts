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
  COMPANY_CONTEXT_HEADERS_CONFLICT,
  COMPANY_CONTEXT_INVALID_COMPANY_ID,
  registerCompanyContext,
} from '../http/plugins/company-context.js';
import { RBAC_AUTHENTICATION_REQUIRED, RBAC_FORBIDDEN } from '../http/plugins/rbac.js';
import { registerRequestLogger } from '../http/plugins/request-logger.js';
import type { RequestCompanyContext } from '../http/types/company-context-request.js';
import { prisma } from '../lib/prisma.js';
import { authRepository } from '../repositories/auth.repository.js';
import { AuthService } from '../services/auth.service.js';
import { CredentialService } from '../services/credential.service.js';
import { TokenService } from '../services/token.service.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const validPassword = 'SecurePass!2026';
const COMPANY_CONTEXT_PATH = '/api/v1/_test/company-context';
const HEALTH_PATH = '/api/v1/health';

function readJsonBody(payload: string): Record<string, unknown> {
  return JSON.parse(payload) as Record<string, unknown>;
}

function assertCompanyContext(
  value: unknown,
  expected: RequestCompanyContext | null,
): void {
  if (expected === null) {
    assert.equal(value, null);
    return;
  }

  assert.ok(value && typeof value === 'object');
  const context = value as RequestCompanyContext;
  assert.equal(context.mode, expected.mode);
  assert.equal(context.companyId, expected.companyId);
}

async function createCompanyContextTestApp(
  deps: AuthenticationDeps = {},
): Promise<FastifyInstance> {
  loadEnvironment();

  const app = Fastify();
  await registerRequestLogger(app);
  await registerAuthentication(app, deps);
  await registerCompanyContext(app);

  app.get(COMPANY_CONTEXT_PATH, async (request) => ({
    companyContext: request.companyContext,
  }));
  app.get(HEALTH_PATH, async () => ({ ok: true }));

  return app;
}

async function issueAccessTokenForUser(
  authService: AuthService,
  tokens: TokenService,
  email: string,
): Promise<string> {
  const principal = await authService.login({ email, password: validPassword });
  return tokens.issueAccessToken(principal);
}

test('Company context middleware integration', { skip: !hasDatabase }, async (t) => {
  const suffix = Date.now();
  const companyIds: string[] = [];
  const userIds: string[] = [];
  const membershipIds: string[] = [];

  const credentialService = new CredentialService();
  const authService = new AuthService(authRepository, credentialService);
  const tokenService = new TokenService();

  const emails = {
    viewer: `company-context-viewer-${suffix}@example.com`,
    superAdmin: `company-context-super-${suffix}@example.com`,
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
      name: email.split('@')[0] ?? 'Test User',
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

  const memberCompanyId = await createCompany(`Company Context Member Co ${suffix}`);
  const otherCompanyId = await createCompany(`Company Context Other Co ${suffix}`);

  await createUserWithRole(emails.viewer, MembershipRole.VIEWER, memberCompanyId);
  await createUserWithRole(emails.superAdmin, MembershipRole.SUPER_ADMIN, memberCompanyId);

  const viewerToken = await issueAccessTokenForUser(authService, tokenService, emails.viewer);
  const superAdminToken = await issueAccessTokenForUser(
    authService,
    tokenService,
    emails.superAdmin,
  );

  const app = await createCompanyContextTestApp();

  await t.test('no header → companyContext null', async () => {
    const response = await app.inject({
      method: 'GET',
      url: COMPANY_CONTEXT_PATH,
      headers: {
        authorization: `Bearer ${viewerToken}`,
      },
    });

    assert.equal(response.statusCode, 200);
    const body = readJsonBody(response.payload);
    assertCompanyContext(body.companyContext, null);
  });

  await t.test('X-Company-Id with valid membership → company mode', async () => {
    const response = await app.inject({
      method: 'GET',
      url: COMPANY_CONTEXT_PATH,
      headers: {
        authorization: `Bearer ${viewerToken}`,
        'x-company-id': memberCompanyId,
      },
    });

    assert.equal(response.statusCode, 200);
    const body = readJsonBody(response.payload);
    assertCompanyContext(body.companyContext, {
      mode: 'company',
      companyId: memberCompanyId,
    });
  });

  await t.test('X-Company-Id without membership → 403', async () => {
    const response = await app.inject({
      method: 'GET',
      url: COMPANY_CONTEXT_PATH,
      headers: {
        authorization: `Bearer ${viewerToken}`,
        'x-company-id': otherCompanyId,
      },
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(readJsonBody(response.payload), {
      message: RBAC_FORBIDDEN,
    });
  });

  await t.test('invalid company id format → 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: COMPANY_CONTEXT_PATH,
      headers: {
        authorization: `Bearer ${viewerToken}`,
        'x-company-id': 'not-a-uuid',
      },
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(readJsonBody(response.payload), {
      message: COMPANY_CONTEXT_INVALID_COMPANY_ID,
    });
  });

  await t.test('X-Company-Scope all as SUPER_ADMIN → all mode', async () => {
    const response = await app.inject({
      method: 'GET',
      url: COMPANY_CONTEXT_PATH,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
        'x-company-scope': 'all',
      },
    });

    assert.equal(response.statusCode, 200);
    const body = readJsonBody(response.payload);
    assertCompanyContext(body.companyContext, { mode: 'all', companyId: null });
  });

  await t.test('X-Company-Scope all as non-admin → 403', async () => {
    const response = await app.inject({
      method: 'GET',
      url: COMPANY_CONTEXT_PATH,
      headers: {
        authorization: `Bearer ${viewerToken}`,
        'x-company-scope': 'all',
      },
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(readJsonBody(response.payload), {
      message: RBAC_FORBIDDEN,
    });
  });

  await t.test('X-Company-Id and X-Company-Scope all together → 400', async () => {
    const response = await app.inject({
      method: 'GET',
      url: COMPANY_CONTEXT_PATH,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
        'x-company-id': memberCompanyId,
        'x-company-scope': 'all',
      },
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(readJsonBody(response.payload), {
      message: COMPANY_CONTEXT_HEADERS_CONFLICT,
    });
  });

  await t.test('SUPER_ADMIN with X-Company-Id outside membership → company mode allowed', async () => {
    const response = await app.inject({
      method: 'GET',
      url: COMPANY_CONTEXT_PATH,
      headers: {
        authorization: `Bearer ${superAdminToken}`,
        'x-company-id': otherCompanyId,
      },
    });

    assert.equal(response.statusCode, 200);
    const body = readJsonBody(response.payload);
    assertCompanyContext(body.companyContext, {
      mode: 'company',
      companyId: otherCompanyId,
    });
  });

  await t.test('public route without company context → pass', async () => {
    const response = await app.inject({
      method: 'GET',
      url: HEALTH_PATH,
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(readJsonBody(response.payload), { ok: true });
  });

  await t.test('company headers without authentication → 401', async () => {
    const response = await app.inject({
      method: 'GET',
      url: COMPANY_CONTEXT_PATH,
      headers: {
        'x-company-id': memberCompanyId,
      },
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(readJsonBody(response.payload), {
      message: RBAC_AUTHENTICATION_REQUIRED,
    });
  });

  await t.test('request logger compatibility with company context middleware', async () => {
    const response = await app.inject({
      method: 'GET',
      url: COMPANY_CONTEXT_PATH,
      headers: {
        authorization: `Bearer ${viewerToken}`,
        'x-company-id': memberCompanyId,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.ok(response.headers['x-request-id']);
    assert.match(String(response.headers['x-request-id']), /^[0-9a-f-]{36}$/i);
  });
});
