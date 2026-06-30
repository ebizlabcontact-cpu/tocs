/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import 'dotenv/config';

import { MembershipRole, UserStatus } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import { GENERIC_LOGIN_ERROR } from '../services/credential.service.js';
import { ACCESS_TOKEN_TTL_SECONDS } from '../services/token.service.js';
import { RBAC_AUTHENTICATION_REQUIRED } from '../http/plugins/rbac.js';
import {
  bearerHeaders,
  TEST_AUTH_PASSWORD,
} from './helpers/http-auth.helper.js';
import { prisma } from '../lib/prisma.js';
import { authRepository } from '../repositories/auth.repository.js';
import { CredentialService } from '../services/credential.service.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const validPassword = TEST_AUTH_PASSWORD;

function readJsonBody(payload: string): Record<string, unknown> {
  return JSON.parse(payload) as Record<string, unknown>;
}

async function createTestApp(): Promise<FastifyInstance> {
  const { createServer } = await import('../http/server.js');
  return createServer();
}

test('Auth HTTP routes integration', { skip: !hasDatabase }, async (t) => {
  const suffix = Date.now();
  let companyId: string | undefined;
  let userId: string | undefined;
  let membershipId: string | undefined;
  const sessionIds: string[] = [];

  const email = `auth-http-${suffix}@example.com`;
  const credentialService = new CredentialService();

  t.after(async () => {
    for (const sessionId of sessionIds) {
      await prisma.session.deleteMany({ where: { id: sessionId } }).catch(() => undefined);
    }
    if (membershipId) {
      await prisma.companyMembership
        .deleteMany({ where: { id: membershipId } })
        .catch(() => undefined);
    }
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    }
    if (companyId) {
      await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  const company = await prisma.company.create({
    data: {
      companyName: `Auth HTTP Co ${suffix}`,
      isActive: true,
    },
  });
  companyId = company.id;

  const passwordHash = await credentialService.hashPasswordForStorage(validPassword, { email });
  const user = await authRepository.createUser({
    email,
    passwordHash,
    name: 'Auth HTTP User',
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

  const app = await createTestApp();

  t.after(async () => {
    await app.close();
  });

  await t.test('auth routes are registered on the server', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: {},
    });
    assert.notEqual(login.statusCode, 404);

    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { 'content-type': 'application/json' },
      payload: {},
    });
    assert.notEqual(logout.statusCode, 404);

    const refreshRoute = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { 'content-type': 'application/json' },
      payload: {},
    });
    assert.notEqual(refreshRoute.statusCode, 404);

    const meRoute = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
    });
    assert.notEqual(meRoute.statusCode, 404);
  });

  await t.test('POST /api/v1/auth/login returns tokens and principal', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email, password: validPassword },
    });

    assert.equal(response.statusCode, 200);

    const body = readJsonBody(response.payload);
    assert.equal(typeof body.access_token, 'string');
    assert.equal(typeof body.refresh_token, 'string');
    assert.equal(body.expires_in, ACCESS_TOKEN_TTL_SECONDS);

    const principal = body.principal as Record<string, unknown>;
    const principalUser = principal.user as Record<string, unknown>;
    assert.equal(principalUser.email, email);
    assert.equal('password_hash' in principalUser, false);

    sessionIds.push(String(principal.session_id));
  });

  await t.test('POST /api/v1/auth/login returns 400 for missing credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: '', password: validPassword },
    });

    assert.equal(response.statusCode, 400);
    assert.equal(typeof readJsonBody(response.payload).message, 'string');
  });

  await t.test('POST /api/v1/auth/login returns 401 for invalid credentials', async () => {
    const wrongPassword = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email, password: 'WrongPass!2026' },
    });
    assert.equal(wrongPassword.statusCode, 401);
    assert.equal(readJsonBody(wrongPassword.payload).message, GENERIC_LOGIN_ERROR);

    const unknownEmail = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: `missing-${suffix}@example.com`, password: validPassword },
    });
    assert.equal(unknownEmail.statusCode, 401);
    assert.equal(readJsonBody(unknownEmail.payload).message, GENERIC_LOGIN_ERROR);
  });

  await t.test('POST /api/v1/auth/login returns 403 for suspended user', async () => {
    const suspended = await authRepository.createUser({
      email: `auth-http-suspended-${suffix}@example.com`,
      passwordHash,
      status: UserStatus.SUSPENDED,
    });

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: { email: suspended.email, password: validPassword },
      });

      assert.equal(response.statusCode, 403);
      assert.equal(readJsonBody(response.payload).message, GENERIC_LOGIN_ERROR);
    } finally {
      await prisma.user.deleteMany({ where: { id: suspended.id } });
    }
  });

  await t.test('POST /api/v1/auth/login returns 423 after lockout threshold', async () => {
    const lockEmail = `auth-http-lock-${suffix}@example.com`;
    const lockPasswordHash = await credentialService.hashPasswordForStorage(validPassword, {
      email: lockEmail,
    });
    const lockUser = await authRepository.createUser({
      email: lockEmail,
      passwordHash: lockPasswordHash,
      status: UserStatus.ACTIVE,
    });

    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          headers: { 'content-type': 'application/json' },
          payload: { email: lockEmail, password: 'WrongPass!2026' },
        });
        assert.equal(response.statusCode, 401);
      }

      const locked = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: { email: lockEmail, password: 'WrongPass!2026' },
      });
      assert.equal(locked.statusCode, 423);
      assert.equal(readJsonBody(locked.payload).message, GENERIC_LOGIN_ERROR);
    } finally {
      await prisma.user.deleteMany({ where: { id: lockUser.id } });
    }
  });

  await t.test('POST /api/v1/auth/logout returns 204 and revokes session', async () => {
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email, password: validPassword },
    });
    const loginBody = readJsonBody(loginResponse.payload);
    const sessionId = String((loginBody.principal as Record<string, unknown>).session_id);
    sessionIds.push(sessionId);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      headers: { 'content-type': 'application/json' },
      payload: { session_id: sessionId },
    });

    assert.equal(response.statusCode, 204);
    assert.equal(response.payload, '');

    const revoked = await authRepository.findSessionById(sessionId);
    assert.ok(revoked?.revokedAt);
  });

  await t.test('POST /api/v1/auth/refresh rotates tokens successfully', async () => {
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email, password: validPassword },
    });
    const loginBody = readJsonBody(loginResponse.payload);
    sessionIds.push(String((loginBody.principal as Record<string, unknown>).session_id));

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { 'content-type': 'application/json' },
      payload: { refresh_token: loginBody.refresh_token },
    });

    assert.equal(response.statusCode, 200);

    const body = readJsonBody(response.payload);
    assert.notEqual(body.refresh_token, loginBody.refresh_token);
    assert.equal(body.expires_in, ACCESS_TOKEN_TTL_SECONDS);
    sessionIds.push(String((body.principal as Record<string, unknown>).session_id));
  });

  await t.test('POST /api/v1/auth/refresh returns 400 or 401 for invalid refresh token', async () => {
    const missing = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { 'content-type': 'application/json' },
      payload: { refresh_token: '' },
    });
    assert.equal(missing.statusCode, 400);

    const invalid = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      headers: { 'content-type': 'application/json' },
      payload: { refresh_token: 'not-a-valid-refresh-token' },
    });
    assert.equal(invalid.statusCode, 401);
  });

  await t.test('GET /api/v1/auth/me returns current user with access token', async () => {
    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email, password: validPassword },
    });
    const loginBody = readJsonBody(loginResponse.payload);
    const accessToken = String(loginBody.access_token);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: bearerHeaders(accessToken),
    });

    assert.equal(response.statusCode, 200);

    const body = readJsonBody(response.payload);
    const meUser = body.user as Record<string, unknown>;
    assert.equal(meUser.id, userId);
    assert.equal(meUser.email, email);
    assert.equal('password_hash' in meUser, false);
    assert.deepEqual(body.roles, [MembershipRole.MANAGER]);
  });

  await t.test('GET /api/v1/auth/me returns 401 without access token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
    });

    assert.equal(response.statusCode, 401);
    assert.equal(readJsonBody(response.payload).message, RBAC_AUTHENTICATION_REQUIRED);
  });

  await t.test('auth routes work with request logger enabled', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email, password: validPassword },
    });

    assert.equal(response.statusCode, 200);
    assert.ok(response.headers['content-type']?.includes('application/json'));
  });
});
