import argon2 from 'argon2';
import bcrypt from 'bcrypt';
import { UserStatus, type User } from '@prisma/client';

import {
  AuthRepository,
  authRepository,
} from '../repositories/auth.repository.js';
import {
  normalizeEmail,
  validatePassword,
  type PasswordValidationContext,
} from '../utils/credential.validation.js';
import {
  CredentialLockoutStore,
  LOCKOUT_MAX_ATTEMPTS,
  LOCKOUT_DURATION_MS,
  type Clock,
} from './credential.lockout-store.js';

export const GENERIC_LOGIN_ERROR = 'Invalid email or password';

export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
} as const;

const BCRYPT_COST = 12;

export class CredentialLoginDeniedError extends Error {
  readonly genericMessage = GENERIC_LOGIN_ERROR;

  constructor(message = GENERIC_LOGIN_ERROR) {
    super(message);
    this.name = 'CredentialLoginDeniedError';
  }
}

export class CredentialService {
  private readonly lockoutStore: CredentialLockoutStore;
  private readonly useBcryptFallback: boolean;

  constructor(
    private readonly repository: AuthRepository = authRepository,
    lockoutStore?: CredentialLockoutStore,
    private readonly clock: Clock = () => Date.now(),
    options: { useBcryptFallback?: boolean } = {},
  ) {
    this.useBcryptFallback = options.useBcryptFallback ?? false;
    this.lockoutStore = lockoutStore ?? new CredentialLockoutStore(this.clock);
  }

  validatePassword(password: string, context: PasswordValidationContext = {}) {
    return validatePassword(password, context);
  }

  async hashPassword(password: string): Promise<string> {
    const normalized = password.normalize('NFC');

    if (this.useBcryptFallback) {
      return bcrypt.hash(normalized, BCRYPT_COST);
    }

    try {
      return await argon2.hash(normalized, ARGON2_OPTIONS);
    } catch {
      return bcrypt.hash(normalized, BCRYPT_COST);
    }
  }

  async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    const normalized = password.normalize('NFC');

    if (passwordHash.startsWith('$argon2')) {
      try {
        return await argon2.verify(passwordHash, normalized);
      } catch {
        return false;
      }
    }

    if (passwordHash.startsWith('$2')) {
      return bcrypt.compare(normalized, passwordHash);
    }

    return false;
  }

  async hashPasswordForStorage(
    password: string,
    context: PasswordValidationContext = {},
  ): Promise<string> {
    this.validatePassword(password, context);
    return this.hashPassword(password);
  }

  normalizeLoginEmail(email: string): string {
    return normalizeEmail(email);
  }

  async resolveLoginEligibility(user: User): Promise<User> {
    const { expired, statusBeforeLock } = this.lockoutStore.clearExpiredLock(user.id);

    if (user.status !== UserStatus.LOCKED) {
      return user;
    }

    if (!expired && this.lockoutStore.isLocked(user.id)) {
      return user;
    }

    const restoreStatus =
      statusBeforeLock === UserStatus.SUSPENDED ||
      statusBeforeLock === UserStatus.INVITED
        ? (statusBeforeLock as UserStatus)
        : UserStatus.ACTIVE;

    return this.repository.updateUserStatus(user.id, restoreStatus);
  }

  assertLoginAllowed(user: User): void {
    if (user.status === UserStatus.ACTIVE) {
      return;
    }

    if (user.status === UserStatus.LOCKED && !this.lockoutStore.isLocked(user.id)) {
      return;
    }

    throw new CredentialLoginDeniedError();
  }

  async recordFailedLoginAttempt(user: User): Promise<User> {
    const state = this.lockoutStore.recordFailure(user.id, user.status);

    if (
      state.attemptCount >= LOCKOUT_MAX_ATTEMPTS &&
      state.lockedUntil !== null &&
      user.status !== UserStatus.LOCKED
    ) {
      return this.repository.updateUserStatus(user.id, UserStatus.LOCKED);
    }

    return user;
  }

  async recordSuccessfulLogin(userId: string): Promise<void> {
    this.lockoutStore.clear(userId);
  }

  getFailureAttemptCount(userId: string): number {
    return this.lockoutStore.getState(userId)?.attemptCount ?? 0;
  }

  isAccountLocked(userId: string): boolean {
    return this.lockoutStore.isLocked(userId);
  }

  getLockoutRemainingMs(userId: string): number {
    const lockedUntil = this.lockoutStore.getState(userId)?.lockedUntil;

    if (!lockedUntil) {
      return 0;
    }

    return Math.max(0, lockedUntil - this.clock());
  }
}

export const credentialService = new CredentialService();
