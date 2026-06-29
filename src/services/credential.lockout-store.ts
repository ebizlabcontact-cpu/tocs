/**
 * In-memory per-user login failure tracking (DL-044 §4).
 * Failure counters and lock windows are NOT persisted to DB — process restart clears them.
 * Account lock is persisted via AuthRepository → users.status = LOCKED; expiry restores prior status.
 */
export const LOCKOUT_MAX_ATTEMPTS = 5;
export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export interface LoginFailureState {
  attemptCount: number;
  windowStartedAt: number;
  statusBeforeLock: string;
  lockedUntil: number | null;
}

export interface ClearedLockResult {
  expired: boolean;
  statusBeforeLock: string | null;
}

export type Clock = () => number;

export class CredentialLockoutStore {
  private readonly failures = new Map<string, LoginFailureState>();

  constructor(private readonly clock: Clock = () => Date.now()) {}

  getState(userId: string): LoginFailureState | undefined {
    return this.failures.get(userId);
  }

  clear(userId: string): void {
    this.failures.delete(userId);
  }

  recordFailure(userId: string, statusBeforeLock: string): LoginFailureState {
    const now = this.clock();
    const existing = this.failures.get(userId);

    if (!existing || now - existing.windowStartedAt > LOCKOUT_WINDOW_MS) {
      const next: LoginFailureState = {
        attemptCount: 1,
        windowStartedAt: now,
        statusBeforeLock,
        lockedUntil: null,
      };
      this.failures.set(userId, next);
      return next;
    }

    existing.attemptCount += 1;

    if (existing.attemptCount >= LOCKOUT_MAX_ATTEMPTS) {
      existing.lockedUntil = now + LOCKOUT_DURATION_MS;
      existing.statusBeforeLock = statusBeforeLock;
    }

    this.failures.set(userId, existing);
    return existing;
  }

  isLocked(userId: string): boolean {
    const state = this.failures.get(userId);

    if (!state?.lockedUntil) {
      return false;
    }

    return this.clock() < state.lockedUntil;
  }

  clearExpiredLock(userId: string): ClearedLockResult {
    const state = this.failures.get(userId);

    if (!state?.lockedUntil) {
      return { expired: false, statusBeforeLock: null };
    }

    if (this.clock() >= state.lockedUntil) {
      const statusBeforeLock = state.statusBeforeLock;
      this.failures.delete(userId);
      return { expired: true, statusBeforeLock };
    }

    return { expired: false, statusBeforeLock: null };
  }
}
