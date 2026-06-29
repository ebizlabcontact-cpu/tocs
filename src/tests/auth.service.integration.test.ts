/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import 'dotenv/config';

import { MembershipRole, UserStatus } from '@prisma/client';

import { prisma } from '../lib/prisma.js';
import { authRepository } from '../repositories/auth.repository.js';
import {
  ActionError,
  AuthService,
} from '../services/auth.service.js';
import { CredentialService, GENERIC_LOGIN_ERROR } from '../services/credential.service.js';
import { CredentialLockoutStore, LOCKOUT_DURATION_MS } from '../services/credential.lockout-store.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const validPassword = 'SecurePass!2026';

function assertActionError(error: unknown, status: number, message?: string): boolean {
  assert.ok(error instanceof ActionError);
  assert.equal(error.status, status);

  if (message !== undefined) {
    assert.equal(error.message, message);
  }

  return true;
}

test('AuthService integration', { skip: !hasDatabase }, async (t) => {
  const suffix = Date.now();
  let companyId: string | undefined;
  let userId: string | undefined;
  let membershipId: string | undefined;
  let sessionId: string | undefined;
  let suspendedUserId: string | undefined;

  const email = `auth-service-${suffix}@example.com`;
  const credentialService = new CredentialService();
  const authService = new AuthService(authRepository, credentialService);

  t.after(async () => {
    if (sessionId) {
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
    if (suspendedUserId) {
      await prisma.user.deleteMany({ where: { id: suspendedUserId } }).catch(() => undefined);
    }
    if (companyId) {
      await prisma.company.deleteMany({ where: { id: companyId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  const company = await prisma.company.create({
    data: {
      companyName: `Auth Service Co ${suffix}`,
      isActive: true,
    },
  });
  companyId = company.id;

  const passwordHash = await credentialService.hashPasswordForStorage(validPassword, { email });
  const user = await authRepository.createUser({
    email,
    passwordHash,
    name: 'Auth Service User',
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

  await t.test('login rejects missing credentials with ActionError 400', async () => {
    await assert.rejects(
      () => authService.login({ email: '', password: validPassword }),
      (error: unknown) => assertActionError(error, 400),
    );

    await assert.rejects(
      () => authService.login({ email, password: '' }),
      (error: unknown) => assertActionError(error, 400),
    );
  });

  await t.test('login success returns AuthenticatedPrincipal without password_hash', async () => {
    const before = await authRepository.findUserById(user.id);
    assert.ok(before);
    assert.equal(before.lastLoginAt, null);

    const principal = await authService.login({ email, password: validPassword });

    assert.equal(principal.user.email, email);
    assert.equal(principal.user.status, UserStatus.ACTIVE);
    assert.equal('passwordHash' in principal.user, false);
    assert.equal(principal.memberships.length, 1);
    assert.equal(principal.memberships[0]?.role, MembershipRole.MANAGER);
    assert.deepEqual(principal.roles, [MembershipRole.MANAGER]);

    const after = await authRepository.findUserById(user.id);
    assert.ok(after?.lastLoginAt);
  });

  await t.test('login returns generic ActionError 401 for unknown email', async () => {
    await assert.rejects(
      () => authService.login({ email: `missing-${suffix}@example.com`, password: validPassword }),
      (error: unknown) => assertActionError(error, 401, GENERIC_LOGIN_ERROR),
    );
  });

  await t.test('login returns generic ActionError 401 for invalid password', async () => {
    await assert.rejects(
      () => authService.login({ email, password: 'WrongPass!2026' }),
      (error: unknown) => assertActionError(error, 401, GENERIC_LOGIN_ERROR),
    );
  });

  await t.test('login returns ActionError 403 for suspended user', async () => {
    const suspended = await authRepository.createUser({
      email: `auth-service-suspended-${suffix}@example.com`,
      passwordHash,
      status: UserStatus.SUSPENDED,
    });
    suspendedUserId = suspended.id;

    await assert.rejects(
      () =>
        authService.login({
          email: suspended.email,
          password: validPassword,
        }),
      (error: unknown) => assertActionError(error, 403, GENERIC_LOGIN_ERROR),
    );
  });

  await t.test('login locks account after repeated failures', async () => {
    const lockEmail = `auth-service-lock-${suffix}@example.com`;
    const lockUser = await authRepository.createUser({
      email: lockEmail,
      passwordHash,
      status: UserStatus.ACTIVE,
    });

    try {
      const lockoutStore = new CredentialLockoutStore(() => Date.now());
      const lockCredentials = new CredentialService(authRepository, lockoutStore);
      const lockAuthService = new AuthService(authRepository, lockCredentials);

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await assert.rejects(
          () => lockAuthService.login({ email: lockEmail, password: 'WrongPass!2026' }),
          (error: unknown) => assertActionError(error, 401, GENERIC_LOGIN_ERROR),
        );
      }

      await assert.rejects(
        () => lockAuthService.login({ email: lockEmail, password: 'WrongPass!2026' }),
        (error: unknown) => assertActionError(error, 423, GENERIC_LOGIN_ERROR),
      );

      const lockedUser = await authRepository.findUserById(lockUser.id);
      assert.equal(lockedUser?.status, UserStatus.LOCKED);
    } finally {
      await prisma.user.deleteMany({ where: { id: lockUser.id } });
    }
  });

  await t.test('login succeeds after LOCKED expiry', async () => {
    const lockEmail = `auth-service-expiry-${suffix}@example.com`;
    const lockUser = await authRepository.createUser({
      email: lockEmail,
      passwordHash,
      status: UserStatus.ACTIVE,
    });

    try {
      let now = Date.UTC(2026, 5, 23, 12, 0, 0);
      const clock = () => new Date(now);
      const lockoutStore = new CredentialLockoutStore(() => now);
      const lockCredentials = new CredentialService(authRepository, lockoutStore, () => now);
      const lockAuthService = new AuthService(authRepository, lockCredentials, clock);

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await assert.rejects(
          () => lockAuthService.login({ email: lockEmail, password: 'WrongPass!2026' }),
          (error: unknown) => assertActionError(error, 401, GENERIC_LOGIN_ERROR),
        );
      }

      now += LOCKOUT_DURATION_MS + 1;

      const principal = await lockAuthService.login({ email: lockEmail, password: validPassword });
      assert.equal(principal.user.status, UserStatus.ACTIVE);
    } finally {
      await prisma.user.deleteMany({ where: { id: lockUser.id } });
    }
  });

  await t.test('logout revokes session', async () => {
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const session = await authRepository.createSession({
      userId: user.id,
      refreshTokenHash: `auth-service-refresh-${suffix}`,
      expiresAt,
    });
    sessionId = session.id;

    await authService.logout(session.id);

    const revoked = await authRepository.findSessionById(session.id);
    assert.ok(revoked?.revokedAt);
  });

  await t.test('refresh returns AuthenticatedPrincipal for active session', async () => {
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const session = await authRepository.createSession({
      userId: user.id,
      refreshTokenHash: `auth-service-refresh-active-${suffix}`,
      expiresAt,
    });
    sessionId = session.id;

    const principal = await authService.refresh(session.id);

    assert.equal(principal.sessionId, session.id);
    assert.equal(principal.user.id, user.id);
    assert.equal('passwordHash' in principal.user, false);
    assert.ok(principal.roles.includes(MembershipRole.MANAGER));
  });

  await t.test('getCurrentUser returns user, memberships, and roles', async () => {
    const current = await authService.getCurrentUser(user.id);

    assert.equal(current.user.id, user.id);
    assert.equal('passwordHash' in current.user, false);
    assert.equal(current.memberships.length, 1);
    assert.deepEqual(current.roles, [MembershipRole.MANAGER]);
  });

  await t.test('getCurrentUser returns ActionError 404 for missing user', async () => {
    await assert.rejects(
      () => authService.getCurrentUser('00000000-0000-0000-0000-000000000099'),
      (error: unknown) => assertActionError(error, 404),
    );
  });
});
