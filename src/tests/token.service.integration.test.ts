/// <reference types="node" />

import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import test from 'node:test';

import 'dotenv/config';

import { MembershipRole, UserStatus } from '@prisma/client';

import { prisma } from '../lib/prisma.js';
import { EnvironmentValidationError } from '../config/env.js';
import { authRepository } from '../repositories/auth.repository.js';
import type { AuthenticatedPrincipal } from '../services/auth.service.js';
import {
  SessionService,
  SessionTokenError,
} from '../services/session.service.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  TokenService,
  TokenVerificationError,
  resolveJwtSecret,
  resolveSessionSecret,
} from '../services/token.service.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const TEST_JWT_SECRET = 'test-jwt-secret-minimum-32-characters-long';
const TEST_SESSION_SECRET = 'test-session-secret-minimum-32-characters';

function buildPrincipal(userId: string, email: string, companyId: string): AuthenticatedPrincipal {
  return {
    user: {
      id: userId,
      email,
      name: 'Token Test User',
      status: UserStatus.ACTIVE,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    memberships: [
      {
        id: '00000000-0000-0000-0000-000000000001',
        companyId,
        role: MembershipRole.MANAGER,
        isActive: true,
        joinedAt: new Date(),
      },
    ],
    roles: [MembershipRole.MANAGER],
  };
}

test('Token and Session service integration', { skip: !hasDatabase }, async (t) => {
  const suffix = Date.now();
  let companyId: string | undefined;
  let userId: string | undefined;
  let membershipId: string | undefined;
  const sessionIds: string[] = [];

  const tokenService = new TokenService(TEST_JWT_SECRET);
  const sessionService = new SessionService(authRepository, TEST_SESSION_SECRET);

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
      companyName: `Token Service Co ${suffix}`,
      isActive: true,
    },
  });
  companyId = company.id;

  const email = `token-service-${suffix}@example.com`;
  const user = await authRepository.createUser({
    email,
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$test$testhash',
    name: 'Token Test User',
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

  const principal = buildPrincipal(user.id, email, company.id);

  await t.test('resolveJwtSecret fails fast in production without secret', () => {
    assert.throws(
      () => resolveJwtSecret({ NODE_ENV: 'production' }),
      (error: unknown) => error instanceof EnvironmentValidationError,
    );

    assert.throws(
      () => resolveSessionSecret({ NODE_ENV: 'production' }),
      (error: unknown) => error instanceof EnvironmentValidationError,
    );
  });

  await t.test('issueAccessToken and verifyAccessToken round-trip', () => {
    const accessToken = tokenService.issueAccessToken(principal);
    const payload = tokenService.verifyAccessToken(accessToken);

    assert.equal(payload.sub, user.id);
    assert.equal(payload.email, email);
    assert.deepEqual(payload.roles, [MembershipRole.MANAGER]);
    assert.equal(payload.memberships.length, 1);
    assert.equal(payload.memberships[0]?.company_id, company.id);
    assert.equal(payload.memberships[0]?.role, MembershipRole.MANAGER);
    assert.ok(payload.exp >= payload.iat + ACCESS_TOKEN_TTL_SECONDS - 1);
    assert.ok(payload.exp <= payload.iat + ACCESS_TOKEN_TTL_SECONDS + 1);
  });

  await t.test('access token payload excludes sensitive data', () => {
    const accessToken = tokenService.issueAccessToken(principal);
    const decoded = tokenService.decodeAccessToken(accessToken);

    assert.ok(decoded);
    assert.equal('password_hash' in decoded, false);
    assert.equal('password' in decoded, false);
    assert.equal('passwordHash' in decoded, false);
  });

  await t.test('verifyAccessToken rejects invalid and expired tokens', () => {
    const otherVerifier = new TokenService('another-secret-minimum-32-characters-long');
    const accessToken = tokenService.issueAccessToken(principal);

    assert.throws(
      () => otherVerifier.verifyAccessToken(accessToken),
      (error: unknown) => error instanceof TokenVerificationError,
    );

    const expiredToken = jwt.sign(
      {
        sub: user.id,
        email,
        roles: [MembershipRole.MANAGER],
        memberships: [{ company_id: company.id, role: MembershipRole.MANAGER }],
        iat: Math.floor(Date.now() / 1000) - 3600,
        exp: Math.floor(Date.now() / 1000) - 1800,
      },
      TEST_JWT_SECRET,
      { algorithm: 'HS256', noTimestamp: true },
    );

    assert.throws(
      () => tokenService.verifyAccessToken(expiredToken),
      (error: unknown) => error instanceof TokenVerificationError,
    );
  });

  await t.test('createSessionForUser stores hash only and returns raw refresh token', async () => {
    const created = await sessionService.createSessionForUser(user.id);
    sessionIds.push(created.session.id);

    const storedHash = created.session.refreshTokenHash;
    const computedHash = sessionService.hashRefreshToken(created.refreshToken);

    assert.equal(storedHash, computedHash);
    assert.notEqual(storedHash, created.refreshToken);
    assert.ok(created.refreshToken.length >= 32);
  });

  await t.test('rotateRefreshToken revokes old session and issues new refresh token', async () => {
    const initial = await sessionService.createSessionForUser(user.id);
    sessionIds.push(initial.session.id);

    const rotated = await sessionService.rotateRefreshToken(initial.refreshToken);
    sessionIds.push(rotated.session.id);

    const oldSession = await authRepository.findSessionById(initial.session.id);
    assert.ok(oldSession?.revokedAt);
    assert.notEqual(rotated.session.id, initial.session.id);
    assert.notEqual(rotated.refreshToken, initial.refreshToken);

    const secondRotation = await sessionService.rotateRefreshToken(rotated.refreshToken);
    sessionIds.push(secondRotation.session.id);
    assert.notEqual(secondRotation.session.id, rotated.session.id);
  });

  await t.test('reuse of revoked refresh token revokes all active sessions', async () => {
    const lockUser = await authRepository.createUser({
      email: `token-reuse-${suffix}@example.com`,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$test$testhash',
      status: UserStatus.ACTIVE,
    });

    const reuseSessionIds: string[] = [];

    try {
      const first = await sessionService.createSessionForUser(lockUser.id);
      reuseSessionIds.push(first.session.id);

      const second = await sessionService.createSessionForUser(lockUser.id);
      reuseSessionIds.push(second.session.id);

      const rotated = await sessionService.rotateRefreshToken(first.refreshToken);
      reuseSessionIds.push(rotated.session.id);

      await assert.rejects(
        () => sessionService.rotateRefreshToken(first.refreshToken),
        (error: unknown) => error instanceof SessionTokenError,
      );

      const activeSessions = await authRepository.listActiveSessionsByUserId(lockUser.id);
      assert.equal(activeSessions.length, 0);
    } finally {
      for (const sessionId of reuseSessionIds) {
        await prisma.session.deleteMany({ where: { id: sessionId } }).catch(() => undefined);
      }
      await prisma.user.deleteMany({ where: { id: lockUser.id } });
    }
  });

  await t.test('revokeSession and revokeAllSessionsForUser revoke active sessions', async () => {
    const revokeUser = await authRepository.createUser({
      email: `token-revoke-${suffix}@example.com`,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$test$testhash',
      status: UserStatus.ACTIVE,
    });

    const revokeSessionIds: string[] = [];

    try {
      const first = await sessionService.createSessionForUser(revokeUser.id);
      const second = await sessionService.createSessionForUser(revokeUser.id);
      revokeSessionIds.push(first.session.id, second.session.id);

      await sessionService.revokeSession(first.session.id);

      const firstSession = await authRepository.findSessionById(first.session.id);
      assert.ok(firstSession?.revokedAt);

      const activeBeforeAll = await authRepository.listActiveSessionsByUserId(revokeUser.id);
      assert.equal(activeBeforeAll.length, 1);

      const revokedCount = await sessionService.revokeAllSessionsForUser(revokeUser.id);
      assert.equal(revokedCount, 1);

      const activeAfterAll = await authRepository.listActiveSessionsByUserId(revokeUser.id);
      assert.equal(activeAfterAll.length, 0);
    } finally {
      for (const sessionId of revokeSessionIds) {
        await prisma.session.deleteMany({ where: { id: sessionId } }).catch(() => undefined);
      }
      await prisma.user.deleteMany({ where: { id: revokeUser.id } });
    }
  });

  await t.test('rotateRefreshToken rejects expired refresh token', async () => {
    const expiredUser = await authRepository.createUser({
      email: `token-expired-${suffix}@example.com`,
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$test$testhash',
      status: UserStatus.ACTIVE,
    });

    const refreshToken = sessionService.generateRefreshToken();
    const refreshTokenHash = sessionService.hashRefreshToken(refreshToken);
    let expiredSessionId: string | undefined;

    try {
      const expiredSession = await authRepository.createSession({
        userId: expiredUser.id,
        refreshTokenHash,
        expiresAt: new Date(Date.now() - 60_000),
      });
      expiredSessionId = expiredSession.id;

      await assert.rejects(
        () => sessionService.rotateRefreshToken(refreshToken),
        (error: unknown) => {
          assert.ok(error instanceof SessionTokenError);
          assert.match(error.message, /expired/i);
          return true;
        },
      );
    } finally {
      if (expiredSessionId) {
        await prisma.session.deleteMany({ where: { id: expiredSessionId } });
      }
      await prisma.user.deleteMany({ where: { id: expiredUser.id } });
    }
  });
});
