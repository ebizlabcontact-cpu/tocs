/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import 'dotenv/config';

import bcrypt from 'bcrypt';
import { UserStatus } from '@prisma/client';

import { prisma } from '../lib/prisma.js';
import { authRepository } from '../repositories/auth.repository.js';
import {
  CredentialLoginDeniedError,
  CredentialService,
  GENERIC_LOGIN_ERROR,
} from '../services/credential.service.js';
import { CredentialLockoutStore, LOCKOUT_DURATION_MS } from '../services/credential.lockout-store.js';
import {
  PasswordValidationError,
  PASSWORD_MIN_LENGTH,
} from '../utils/credential.validation.js';

const hasDatabase = Boolean(process.env.DATABASE_URL);

const validPassword = 'SecurePass!2026';

test('CredentialService integration', { skip: !hasDatabase }, async (t) => {
  const suffix = Date.now();
  let userId: string | undefined;
  let suspendedUserId: string | undefined;
  let invitedUserId: string | undefined;

  t.after(async () => {
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } }).catch(() => undefined);
    }
    if (suspendedUserId) {
      await prisma.user.deleteMany({ where: { id: suspendedUserId } }).catch(() => undefined);
    }
    if (invitedUserId) {
      await prisma.user.deleteMany({ where: { id: invitedUserId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  const email = `credential-${suffix}@example.com`;
  const service = new CredentialService();

  await t.test('hashPassword and verifyPassword use Argon2id', async () => {
    const hash = await service.hashPassword(validPassword);
    assert.ok(hash.startsWith('$argon2id$'));
    assert.equal(await service.verifyPassword(validPassword, hash), true);
    assert.equal(await service.verifyPassword('WrongPass!2026', hash), false);
  });

  await t.test('verifyPassword supports legacy bcrypt hashes', async () => {
    const bcryptHash = await bcrypt.hash(validPassword, 12);
    assert.ok(bcryptHash.startsWith('$2'));
    assert.equal(await service.verifyPassword(validPassword, bcryptHash), true);
  });

  await t.test('validatePassword enforces policy', () => {
    service.validatePassword(validPassword, { email });

    assert.throws(
      () => service.validatePassword('short', { email }),
      (error: unknown) =>
        error instanceof PasswordValidationError && error.code === 'PASSWORD_TOO_SHORT',
    );

    assert.throws(
      () => service.validatePassword('password123456!', { email }),
      (error: unknown) =>
        error instanceof PasswordValidationError && error.code === 'PASSWORD_BLOCKLIST',
    );

    assert.throws(
      () => service.validatePassword(email, { email }),
      (error: unknown) =>
        error instanceof PasswordValidationError && error.code === 'PASSWORD_EMAIL',
    );

    assert.throws(
      () =>
        service.validatePassword(`Acme Corp ${'x'.repeat(PASSWORD_MIN_LENGTH)}!`, {
          companyName: 'Acme Corp',
        }),
      (error: unknown) =>
        error instanceof PasswordValidationError && error.code === 'PASSWORD_COMPANY',
    );
  });

  await t.test('hashPasswordForStorage validates then hashes', async () => {
    await assert.rejects(
      () => service.hashPasswordForStorage('too-short', { email }),
      (error: unknown) => error instanceof PasswordValidationError,
    );

    const hash = await service.hashPasswordForStorage(validPassword, { email });
    assert.ok(hash.startsWith('$argon2id$'));
    assert.equal(await service.verifyPassword(validPassword, hash), true);
  });

  await t.test('normalizeLoginEmail trims and lowercases', () => {
    assert.equal(service.normalizeLoginEmail('  User@Example.COM  '), 'user@example.com');
  });

  const passwordHash = await service.hashPasswordForStorage(validPassword, { email });
  const user = await authRepository.createUser({
    email,
    passwordHash,
    name: 'Credential Test User',
    status: UserStatus.ACTIVE,
  });
  userId = user.id;

  await t.test('recordFailedLoginAttempt locks after five failures', async () => {
    let current = user;
    const lockoutStore = new CredentialLockoutStore(() => Date.now());
    const lockService = new CredentialService(authRepository, lockoutStore);

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      current = await lockService.recordFailedLoginAttempt(current);
      assert.equal(current.status, UserStatus.ACTIVE);
      assert.equal(lockService.getFailureAttemptCount(current.id), attempt);
    }

    current = await lockService.recordFailedLoginAttempt(current);
    assert.equal(current.status, UserStatus.LOCKED);
    assert.equal(lockService.isAccountLocked(current.id), true);

    assert.throws(
      () => lockService.assertLoginAllowed(current),
      (error: unknown) => error instanceof CredentialLoginDeniedError,
    );

    await authRepository.updateUserStatus(current.id, UserStatus.ACTIVE);
    lockoutStore.clear(current.id);
  });

  await t.test('recordSuccessfulLogin clears failure counter', async () => {
    const lockoutStore = new CredentialLockoutStore(() => Date.now());
    const lockService = new CredentialService(authRepository, lockoutStore);
    let current = await authRepository.findUserById(user.id);
    assert.ok(current);

    current = await lockService.recordFailedLoginAttempt(current);
    current = await lockService.recordFailedLoginAttempt(current);
    assert.equal(lockService.getFailureAttemptCount(current.id), 2);

    await lockService.recordSuccessfulLogin(current.id);
    assert.equal(lockService.getFailureAttemptCount(current.id), 0);
  });

  await t.test('resolveLoginEligibility restores ACTIVE after lock expiry', async () => {
    let now = Date.UTC(2026, 5, 23, 12, 0, 0);
    const clock = () => now;
    const lockoutStore = new CredentialLockoutStore(clock);
    const lockService = new CredentialService(authRepository, lockoutStore, clock);

    let current = await authRepository.updateUserStatus(user.id, UserStatus.ACTIVE);
    lockoutStore.clear(current.id);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      current = await lockService.recordFailedLoginAttempt(current);
    }
    assert.equal(current.status, UserStatus.LOCKED);

    now += LOCKOUT_DURATION_MS + 1;

    const eligible = await lockService.resolveLoginEligibility(current);
    assert.equal(eligible.status, UserStatus.ACTIVE);
    assert.equal(lockService.getFailureAttemptCount(current.id), 0);
    lockService.assertLoginAllowed(eligible);
  });

  await t.test('assertLoginAllowed rejects suspended and invited users', async () => {
    const suspended = await authRepository.createUser({
      email: `credential-suspended-${suffix}@example.com`,
      passwordHash,
      status: UserStatus.SUSPENDED,
    });
    suspendedUserId = suspended.id;

    assert.throws(
      () => service.assertLoginAllowed(suspended),
      (error: unknown) => {
        assert.ok(error instanceof CredentialLoginDeniedError);
        assert.equal(error.message, GENERIC_LOGIN_ERROR);
        return true;
      },
    );

    const invited = await authRepository.createUser({
      email: `credential-invited-${suffix}@example.com`,
      passwordHash,
      status: UserStatus.INVITED,
    });
    invitedUserId = invited.id;

    assert.throws(
      () => service.assertLoginAllowed(invited),
      (error: unknown) => error instanceof CredentialLoginDeniedError,
    );
  });
});
