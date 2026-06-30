/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import 'dotenv/config';

import { MembershipRole, UserStatus } from '@prisma/client';
import Fastify, { type FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';

import { loadEnvironment } from '../config/env.js';
import {
  registerAuthentication,
  type AuthenticationDeps,
} from '../http/plugins/authentication.js';
import { registerRequestLogger } from '../http/plugins/request-logger.js';
import type { RequestAuthContext } from '../http/types/auth-request.js';
import { prisma } from '../lib/prisma.js';
import { authRepository } from '../repositories/auth.repository.js';
import { AuthService } from '../services/auth.service.js';
import { CredentialService, GENERIC_LOGIN_ERROR } from '../services/credential.service.js';
import { CredentialLockoutStore } from '../services/credential.lockout-store.js';
import { resolveJwtSecret, TokenService } from '../services/token.service.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const validPassword = 'SecurePass!2026';
const AUTH_CONTEXT_PATH = '/api/v1/_test/auth-context';

function readJsonBody(payload: string): Record<string, unknown> {
  return JSON.parse(payload) as Record<string, unknown>;
}

function assertRequestAuthContext(value: unknown): asserts value is RequestAuthContext {
  assert.ok(value && typeof value === 'object');
  const auth = value as RequestAuthContext;
  assert.equal(typeof auth.userId, 'string');
  assert.equal(typeof auth.email, 'string');
  assert.ok(Array.isArray(auth.roles));
  assert.ok(Array.isArray(auth.memberships));
}

async function createAuthMiddlewareTestApp(
  deps: AuthenticationDeps = {},
): Promise<FastifyInstance> {
  loadEnvironment();

  const app = Fastify();
  await registerRequestLogger(app);
  await registerAuthentication(app, deps);
  app.get(AUTH_CONTEXT_PATH, async (request) => ({ auth: request.auth }));
  return app;
}

async function issueAccessTokenForUser(
  authService: AuthService,
  tokens: TokenService,
  email: string,
  password: string,
): Promise<string> {
  const principal = await authService.login({ email, password });
  return tokens.issueAccessToken(principal);
}

test('Authentication middleware integration', { skip: !hasDatabase }, async (t) => {
  const suffix = Date.now();
  let companyId: string | undefined;
  let userId: string | undefined;
  let membershipId: string | undefined;
  let lockedUserId: string | undefined;
  let suspendedUserId: string | undefined;

  const email = `auth-middleware-${suffix}@example.com`;
  const lockedEmail = `auth-middleware-locked-${suffix}@example.com`;
  const suspendedEmail = `auth-middleware-suspended-${suffix}@example.com`;

  const lockoutStore = new CredentialLockoutStore();
  const credentialService = new CredentialService(authRepository, lockoutStore);
  const authService = new AuthService(authRepository, credentialService);
  const tokenService = new TokenService();

  t.after(async () => {
    if (membershipId) {
      await prisma.companyMembership
        .deleteMany({ where: { id: membershipId } })
        .catch(() => undefined);
    }
    for (const id of [userId, lockedUserId, suspendedUserId]) {
      if (id) {
        await prisma.user.deleteMany({ where: { id } }).catch(() => undefined);
      }
    }
    if (companyId) {
      await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  const company = await prisma.company.create({
    data: {
      companyName: `Auth Middleware Co ${suffix}`,
      isActive: true,
    },
  });
  companyId = company.id;

  const passwordHash = await credentialService.hashPasswordForStorage(validPassword, { email });
  const user = await authRepository.createUser({
    email,
    passwordHash,
    name: 'Auth Middleware User',
    status: UserStatus.ACTIVE,
  });
  userId = user.id;

  const membership = await authRepository.createCompanyMembership({
    companyId: company.id,
    userId: user.id,
    role: MembershipRole.MANAGER,
    isActive: true,
  });
  membershipId = membership.id;

  const lockedPasswordHash = await credentialService.hashPasswordForStorage(validPassword, {
    email: lockedEmail,
  });
  const lockedUser = await authRepository.createUser({
    email: lockedEmail,
    passwordHash: lockedPasswordHash,
    name: 'Locked Middleware User',
    status: UserStatus.LOCKED,
  });
  lockedUserId = lockedUser.id;

  await authRepository.createCompanyMembership({
    companyId: company.id,
    userId: lockedUser.id,
    role: MembershipRole.VIEWER,
    isActive: true,
  });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    lockoutStore.recordFailure(lockedUser.id, UserStatus.ACTIVE);
  }

  const suspendedPasswordHash = await credentialService.hashPasswordForStorage(validPassword, {
    email: suspendedEmail,
  });
  const suspendedUser = await authRepository.createUser({
    email: suspendedEmail,
    passwordHash: suspendedPasswordHash,
    name: 'Suspended Middleware User',
    status: UserStatus.SUSPENDED,
  });
  suspendedUserId = suspendedUser.id;

  await authRepository.createCompanyMembership({
    companyId: company.id,
    userId: suspendedUser.id,
    role: MembershipRole.VIEWER,
    isActive: true,
  });

  const app = await createAuthMiddlewareTestApp({
    authRepository,
    credentialService,
    tokenService,
  });

  t.after(async () => {
    await app.close();
  });

  const accessToken = await issueAccessTokenForUser(
    authService,
    tokenService,
    email,
    validPassword,
  );

  await t.test('valid token assigns request.auth principal', async () => {
    const response = await app.inject({
      method: 'GET',
      url: AUTH_CONTEXT_PATH,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    assert.equal(response.statusCode, 200);
    const body = readJsonBody(response.payload);
    assertRequestAuthContext(body.auth);
    assert.equal(body.auth.userId, userId);
    assert.equal(body.auth.email, email);
    assert.deepEqual(body.auth.roles, [MembershipRole.MANAGER]);
    assert.deepEqual(body.auth.memberships, [
      { company_id: companyId, role: MembershipRole.MANAGER },
    ]);
  });

  await t.test('missing Authorization header leaves request.auth null', async () => {
    const response = await app.inject({
      method: 'GET',
      url: AUTH_CONTEXT_PATH,
    });

    assert.equal(response.statusCode, 200);
    const body = readJsonBody(response.payload);
    assert.equal(body.auth, null);
  });

  await t.test('invalid token returns 401', async () => {
    const response = await app.inject({
      method: 'GET',
      url: AUTH_CONTEXT_PATH,
      headers: {
        authorization: 'Bearer not-a-valid-token',
      },
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(readJsonBody(response.payload), {
      message: 'Invalid access token',
    });
  });

  await t.test('expired token returns 401', async () => {
    const expiredToken = jwt.sign(
      {
        sub: userId,
        email,
        roles: [MembershipRole.MANAGER],
        memberships: [{ company_id: companyId, role: MembershipRole.MANAGER }],
      },
      resolveJwtSecret(),
      {
        algorithm: 'HS256',
        expiresIn: -1,
      },
    );

    const response = await app.inject({
      method: 'GET',
      url: AUTH_CONTEXT_PATH,
      headers: {
        authorization: `Bearer ${expiredToken}`,
      },
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(readJsonBody(response.payload), {
      message: 'Invalid access token',
    });
  });

  await t.test('locked user returns 423', async () => {
    const lockedCurrent = await authService.getCurrentUser(lockedUserId!);
    const lockedToken = tokenService.issueAccessToken({
      user: lockedCurrent.user,
      memberships: lockedCurrent.memberships,
      roles: lockedCurrent.roles,
    });

    const response = await app.inject({
      method: 'GET',
      url: AUTH_CONTEXT_PATH,
      headers: {
        authorization: `Bearer ${lockedToken}`,
      },
    });

    assert.equal(response.statusCode, 423);
    assert.deepEqual(readJsonBody(response.payload), {
      message: GENERIC_LOGIN_ERROR,
    });
  });

  await t.test('suspended user returns 403', async () => {
    const suspendedCurrent = await authService.getCurrentUser(suspendedUserId!);
    const suspendedToken = tokenService.issueAccessToken({
      user: suspendedCurrent.user,
      memberships: suspendedCurrent.memberships,
      roles: suspendedCurrent.roles,
    });

    const response = await app.inject({
      method: 'GET',
      url: AUTH_CONTEXT_PATH,
      headers: {
        authorization: `Bearer ${suspendedToken}`,
      },
    });

    assert.equal(response.statusCode, 403);
    assert.deepEqual(readJsonBody(response.payload), {
      message: GENERIC_LOGIN_ERROR,
    });
  });

  await t.test('request.auth typing is available on FastifyRequest', async () => {
    const response = await app.inject({
      method: 'GET',
      url: AUTH_CONTEXT_PATH,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    assert.equal(response.statusCode, 200);
    const body = readJsonBody(response.payload);
    assertRequestAuthContext(body.auth);

    const typedAuth: RequestAuthContext | null = body.auth as RequestAuthContext;
    assert.equal(typedAuth.userId, userId);
  });

  await t.test('request logger compatibility with authenticated requests', async () => {
    const response = await app.inject({
      method: 'GET',
      url: AUTH_CONTEXT_PATH,
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.ok(response.headers['x-request-id']);
    assert.match(String(response.headers['x-request-id']), /^[0-9a-f-]{36}$/i);
  });

  await t.test('createServer registers authentication without breaking health route', async () => {
    const { createServer } = await import('../http/server.js');
    const serverApp = await createServer();

    t.after(async () => {
      await serverApp.close();
    });

    const healthResponse = await serverApp.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    assert.equal(healthResponse.statusCode, 200);

    const authenticatedHealthResponse = await serverApp.inject({
      method: 'GET',
      url: '/api/v1/health',
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    assert.equal(authenticatedHealthResponse.statusCode, 200);
    assert.ok(authenticatedHealthResponse.headers['x-request-id']);
  });
});
