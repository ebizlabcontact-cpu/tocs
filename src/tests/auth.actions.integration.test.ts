/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import 'dotenv/config';

import { MembershipRole, UserStatus } from '@prisma/client';

import {
  AuthActions,
  login,
  logout,
  me,
  refresh,
} from '../actions/auth.actions.js';
import { ActionError } from '../actions/formula.actions.js';
import { prisma } from '../lib/prisma.js';
import { authRepository } from '../repositories/auth.repository.js';
import { AuthService } from '../services/auth.service.js';
import { CredentialService, GENERIC_LOGIN_ERROR } from '../services/credential.service.js';
import { SessionService } from '../services/session.service.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  TokenService,
} from '../services/token.service.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const TEST_JWT_SECRET = 'test-jwt-secret-minimum-32-characters-long';
const TEST_SESSION_SECRET = 'test-session-secret-minimum-32-characters';
const validPassword = 'SecurePass!2026';

function assertActionError(error: unknown, status: number, message?: string): boolean {
  assert.ok(error instanceof ActionError);
  assert.equal(error.status, status);

  if (message !== undefined) {
    assert.equal(error.message, message);
  }

  return true;
}

test('Auth actions integration', { skip: !hasDatabase }, async (t) => {
  const suffix = Date.now();
  let companyId: string | undefined;
  let userId: string | undefined;
  let membershipId: string | undefined;
  const sessionIds: string[] = [];

  const email = `auth-actions-${suffix}@example.com`;
  const credentialService = new CredentialService();
  const authService = new AuthService(authRepository, credentialService);
  const tokenService = new TokenService(TEST_JWT_SECRET);
  const sessionService = new SessionService(authRepository, TEST_SESSION_SECRET);
  const authActions = new AuthActions(authService, tokenService, sessionService);

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
      companyName: `Auth Actions Co ${suffix}`,
      isActive: true,
    },
  });
  companyId = company.id;

  const passwordHash = await credentialService.hashPasswordForStorage(validPassword, { email });
  const user = await authRepository.createUser({
    email,
    passwordHash,
    name: 'Auth Actions User',
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

  await t.test('login returns access_token, refresh_token, expires_in, and principal', async () => {
    const result = await authActions.login({ email, password: validPassword });

    sessionIds.push(result.principal.session_id!);

    assert.ok(result.access_token.length > 0);
    assert.ok(result.refresh_token.length > 0);
    assert.equal(result.expires_in, ACCESS_TOKEN_TTL_SECONDS);
    assert.equal(result.principal.user.email, email);
    assert.equal('password_hash' in result.principal.user, false);
    assert.equal('passwordHash' in result.principal.user, false);
    assert.equal(result.principal.memberships.length, 1);
    assert.equal(result.principal.memberships[0]?.company_id, company.id);
    assert.deepEqual(result.principal.roles, [MembershipRole.MANAGER]);

    const payload = tokenService.verifyAccessToken(result.access_token);
    assert.equal(payload.sub, user.id);
    assert.equal(payload.email, email);

    const storedHash = (
      await authRepository.findSessionById(result.principal.session_id!)
    )?.refreshTokenHash;
    assert.ok(storedHash);
    assert.notEqual(storedHash, result.refresh_token);
    assert.equal(storedHash, sessionService.hashRefreshToken(result.refresh_token));
  });

  await t.test('login rejects missing credentials with ActionError 400', async () => {
    await assert.rejects(
      () => authActions.login({ email: '', password: validPassword }),
      (error: unknown) => assertActionError(error, 400),
    );

    await assert.rejects(
      () => authActions.login({ email, password: '' }),
      (error: unknown) => assertActionError(error, 400),
    );
  });

  await t.test('login rejects invalid credentials with ActionError 401', async () => {
    await assert.rejects(
      () => authActions.login({ email, password: 'WrongPass!2026' }),
      (error: unknown) => assertActionError(error, 401, GENERIC_LOGIN_ERROR),
    );

    await assert.rejects(
      () => authActions.login({ email: `missing-${suffix}@example.com`, password: validPassword }),
      (error: unknown) => assertActionError(error, 401, GENERIC_LOGIN_ERROR),
    );
  });

  await t.test('login rejects suspended user with ActionError 403', async () => {
    const suspended = await authRepository.createUser({
      email: `auth-actions-suspended-${suffix}@example.com`,
      passwordHash,
      status: UserStatus.SUSPENDED,
    });

    try {
      await assert.rejects(
        () =>
          authActions.login({
            email: suspended.email,
            password: validPassword,
          }),
        (error: unknown) => assertActionError(error, 403, GENERIC_LOGIN_ERROR),
      );
    } finally {
      await prisma.user.deleteMany({ where: { id: suspended.id } });
    }
  });

  await t.test('logout revokes session via SessionService', async () => {
    const created = await sessionService.createSessionForUser(user.id);
    sessionIds.push(created.session.id);

    await authActions.logout({ session_id: created.session.id });

    const revoked = await authRepository.findSessionById(created.session.id);
    assert.ok(revoked?.revokedAt);
  });

  await t.test('refresh rotates refresh token and issues new access token', async () => {
    const loggedIn = await authActions.login({ email, password: validPassword });
    sessionIds.push(loggedIn.principal.session_id!);

    const refreshed = await authActions.refresh({ refresh_token: loggedIn.refresh_token });
    sessionIds.push(refreshed.principal.session_id!);

    assert.notEqual(refreshed.refresh_token, loggedIn.refresh_token);
    assert.ok(refreshed.access_token.length > 0);
    assert.equal(refreshed.expires_in, ACCESS_TOKEN_TTL_SECONDS);
    assert.equal(refreshed.principal.user.id, user.id);

    const oldSession = await authRepository.findSessionById(loggedIn.principal.session_id!);
    assert.ok(oldSession?.revokedAt);

    const payload = tokenService.verifyAccessToken(refreshed.access_token);
    assert.equal(payload.sub, user.id);
  });

  await t.test('refresh rejects missing refresh_token with ActionError 400', async () => {
    await assert.rejects(
      () => authActions.refresh({ refresh_token: '' }),
      (error: unknown) => assertActionError(error, 400),
    );
  });

  await t.test('refresh rejects invalid refresh_token with ActionError 401', async () => {
    await assert.rejects(
      () => authActions.refresh({ refresh_token: 'not-a-valid-refresh-token' }),
      (error: unknown) => assertActionError(error, 401),
    );
  });

  await t.test('me returns current user without password_hash', async () => {
    const result = await authActions.me(user.id);

    assert.equal(result.user.id, user.id);
    assert.equal(result.user.email, email);
    assert.equal('password_hash' in result.user, false);
    assert.equal(result.memberships.length, 1);
    assert.deepEqual(result.roles, [MembershipRole.MANAGER]);
  });

  await t.test('me returns ActionError 404 for missing user', async () => {
    await assert.rejects(
      () => authActions.me('00000000-0000-0000-0000-000000000099'),
      (error: unknown) => assertActionError(error, 404),
    );
  });

  await t.test('exported functions delegate to AuthActions', async () => {
    const result = await login({ email, password: validPassword });
    sessionIds.push(result.principal.session_id!);
    assert.ok(result.access_token);

    const current = await me(user.id);
    assert.equal(current.user.id, user.id);

    await logout({ session_id: result.principal.session_id! });
    await refresh({ refresh_token: result.refresh_token }).catch(() => undefined);
  });
});
