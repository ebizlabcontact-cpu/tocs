import { createHmac, randomBytes } from 'node:crypto';

import type { Session } from '@prisma/client';

import {
  AuthRepository,
  authRepository,
} from '../repositories/auth.repository.js';
import {
  REFRESH_TOKEN_TTL_MS,
  resolveSessionSecret,
} from './token.service.js';

export class SessionTokenError extends Error {
  readonly status = 401 as const;

  constructor(message = 'Invalid refresh token') {
    super(message);
    this.name = 'SessionTokenError';
  }
}

export interface CreatedSessionResult {
  session: Session;
  refreshToken: string;
}

export class SessionService {
  constructor(
    private readonly repository: AuthRepository = authRepository,
    private readonly sessionSecret: string = resolveSessionSecret(),
    private readonly clock: () => Date = () => new Date(),
  ) {}

  hashRefreshToken(refreshToken: string): string {
    return createHmac('sha256', this.sessionSecret).update(refreshToken).digest('hex');
  }

  generateRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  async createSessionForUser(userId: string): Promise<CreatedSessionResult> {
    const refreshToken = this.generateRefreshToken();
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const expiresAt = new Date(this.clock().getTime() + REFRESH_TOKEN_TTL_MS);

    const session = await this.repository.createSession({
      userId,
      refreshTokenHash,
      expiresAt,
    });

    return { session, refreshToken };
  }

  async rotateRefreshToken(refreshToken: string): Promise<CreatedSessionResult> {
    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    const session = await this.repository.findSessionByRefreshTokenHash(refreshTokenHash);

    if (!session) {
      throw new SessionTokenError();
    }

    if (session.revokedAt !== null) {
      await this.repository.revokeAllSessionsByUserId(session.userId, this.clock());
      throw new SessionTokenError('Refresh token reuse detected');
    }

    if (session.expiresAt <= this.clock()) {
      throw new SessionTokenError('Refresh token expired');
    }

    await this.repository.revokeSession(session.id, this.clock());

    return this.createSessionForUser(session.userId);
  }

  async revokeSession(sessionId: string): Promise<void> {
    const session = await this.repository.findSessionById(sessionId);

    if (!session) {
      throw new SessionTokenError('Session not found');
    }

    if (session.revokedAt === null) {
      await this.repository.revokeSession(sessionId, this.clock());
    }
  }

  async revokeAllSessionsForUser(userId: string): Promise<number> {
    return this.repository.revokeAllSessionsByUserId(userId, this.clock());
  }
}

export const sessionService = new SessionService();
