import jwt from 'jsonwebtoken';

import { EnvironmentValidationError } from '../config/env.js';
import type { AuthenticatedPrincipal } from './auth.service.js';
import type { MembershipRole } from '@prisma/client';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const TEST_JWT_SECRET = 'test-jwt-secret-minimum-32-characters-long';
const TEST_SESSION_SECRET = 'test-session-secret-minimum-32-characters';

export interface AccessTokenMembershipClaim {
  company_id: string;
  role: MembershipRole;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  roles: MembershipRole[];
  memberships: AccessTokenMembershipClaim[];
  iat: number;
  exp: number;
}

export class TokenVerificationError extends Error {
  constructor(message = 'Invalid access token') {
    super(message);
    this.name = 'TokenVerificationError';
  }
}

export function resolveJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET?.trim();

  if (secret) {
    return secret;
  }

  const nodeEnv = env.NODE_ENV?.trim();

  if (nodeEnv === 'production') {
    throw new EnvironmentValidationError('JWT_SECRET is required in production');
  }

  return TEST_JWT_SECRET;
}

export function resolveSessionSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.SESSION_SECRET?.trim();

  if (secret) {
    return secret;
  }

  const nodeEnv = env.NODE_ENV?.trim();

  if (nodeEnv === 'production') {
    throw new EnvironmentValidationError('SESSION_SECRET is required in production');
  }

  return TEST_SESSION_SECRET;
}

function buildMembershipClaims(principal: AuthenticatedPrincipal): AccessTokenMembershipClaim[] {
  return principal.memberships
    .filter((membership) => membership.isActive)
    .map((membership) => ({
      company_id: membership.companyId,
      role: membership.role,
    }));
}

export class TokenService {
  constructor(private readonly jwtSecret: string = resolveJwtSecret()) {}

  issueAccessToken(principal: AuthenticatedPrincipal): string {
    return jwt.sign(
      {
        sub: principal.user.id,
        email: principal.user.email,
        roles: principal.roles,
        memberships: buildMembershipClaims(principal),
      },
      this.jwtSecret,
      {
        algorithm: 'HS256',
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      },
    );
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        algorithms: ['HS256'],
      });

      return this.parseAccessTokenPayload(decoded);
    } catch {
      throw new TokenVerificationError();
    }
  }

  decodeAccessToken(token: string): AccessTokenPayload | null {
    const decoded = jwt.decode(token);

    if (decoded === null || typeof decoded === 'string') {
      return null;
    }

    try {
      return this.parseAccessTokenPayload(decoded);
    } catch {
      return null;
    }
  }

  private parseAccessTokenPayload(decoded: unknown): AccessTokenPayload {
    if (!decoded || typeof decoded !== 'object') {
      throw new TokenVerificationError();
    }

    const payload = decoded as Record<string, unknown>;

    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number' ||
      !Array.isArray(payload.roles) ||
      !Array.isArray(payload.memberships)
    ) {
      throw new TokenVerificationError();
    }

    return {
      sub: payload.sub,
      email: payload.email,
      roles: payload.roles as MembershipRole[],
      memberships: payload.memberships as AccessTokenMembershipClaim[],
      iat: payload.iat,
      exp: payload.exp,
    };
  }
}

export const tokenService = new TokenService();
