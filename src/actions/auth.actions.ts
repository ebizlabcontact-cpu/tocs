import type { MembershipRole, UserStatus } from '@prisma/client';

import {
  AuthService,
  authService,
  ActionError as AuthServiceActionError,
  type AuthenticatedPrincipal,
  type CurrentUserResponse,
  type SafeUser,
  type MembershipSummary,
} from '../services/auth.service.js';
import {
  SessionService,
  SessionTokenError,
  sessionService,
} from '../services/session.service.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  TokenService,
  tokenService,
} from '../services/token.service.js';

import { ActionError } from './formula.actions.js';

export interface LoginRequestBody {
  email?: string;
  password?: string;
}

export interface LogoutRequestBody {
  session_id?: string;
}

export interface RefreshRequestBody {
  refresh_token?: string;
}

export interface SafeUserResponse {
  id: string;
  email: string;
  name: string | null;
  status: UserStatus;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MembershipSummaryResponse {
  id: string;
  company_id: string;
  role: MembershipRole;
  is_active: boolean;
  joined_at: string;
}

export interface PrincipalResponse {
  user: SafeUserResponse;
  session_id?: string;
  memberships: MembershipSummaryResponse[];
  roles: MembershipRole[];
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  principal: PrincipalResponse;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  principal: PrincipalResponse;
}

export interface MeResponse {
  user: SafeUserResponse;
  memberships: MembershipSummaryResponse[];
  roles: MembershipRole[];
}

function toSafeUserResponse(user: SafeUser): SafeUserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    last_login_at: user.lastLoginAt?.toISOString() ?? null,
    created_at: user.createdAt.toISOString(),
    updated_at: user.updatedAt.toISOString(),
  };
}

function toMembershipSummaryResponse(
  membership: MembershipSummary,
): MembershipSummaryResponse {
  return {
    id: membership.id,
    company_id: membership.companyId,
    role: membership.role,
    is_active: membership.isActive,
    joined_at: membership.joinedAt.toISOString(),
  };
}

function toPrincipalResponse(principal: AuthenticatedPrincipal): PrincipalResponse {
  const response: PrincipalResponse = {
    user: toSafeUserResponse(principal.user),
    memberships: principal.memberships.map(toMembershipSummaryResponse),
    roles: principal.roles,
  };

  if (principal.sessionId !== undefined) {
    response.session_id = principal.sessionId;
  }

  return response;
}

function toMeResponse(current: CurrentUserResponse): MeResponse {
  return {
    user: toSafeUserResponse(current.user),
    memberships: current.memberships.map(toMembershipSummaryResponse),
    roles: current.roles,
  };
}

function mapAuthActionError(error: unknown): never {
  if (error instanceof ActionError || error instanceof AuthServiceActionError) {
    throw new ActionError(error.status, error.message);
  }

  if (error instanceof SessionTokenError) {
    if (error.message === 'Session not found') {
      throw new ActionError(404, error.message);
    }

    throw new ActionError(error.status, error.message);
  }

  throw error;
}

export class AuthActions {
  constructor(
    private readonly auth: AuthService = authService,
    private readonly tokens: TokenService = tokenService,
    private readonly sessions: SessionService = sessionService,
  ) {}

  async login(body: LoginRequestBody): Promise<LoginResponse> {
    try {
      const email = body.email ?? '';
      const password = body.password ?? '';

      const principal = await this.auth.login({ email, password });
      const accessToken = this.tokens.issueAccessToken(principal);
      const created = await this.sessions.createSessionForUser(principal.user.id);

      const principalWithSession: AuthenticatedPrincipal = {
        ...principal,
        sessionId: created.session.id,
      };

      return {
        access_token: accessToken,
        refresh_token: created.refreshToken,
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        principal: toPrincipalResponse(principalWithSession),
      };
    } catch (error) {
      mapAuthActionError(error);
    }
  }

  async logout(body: LogoutRequestBody): Promise<void> {
    try {
      const sessionId = body.session_id?.trim() ?? '';

      if (sessionId === '') {
        throw new ActionError(400, 'session_id is required');
      }

      await this.sessions.revokeSession(sessionId);
    } catch (error) {
      mapAuthActionError(error);
    }
  }

  async refresh(body: RefreshRequestBody): Promise<RefreshResponse> {
    try {
      const refreshToken = body.refresh_token ?? '';

      if (refreshToken === '') {
        throw new ActionError(400, 'refresh_token is required');
      }

      const rotated = await this.sessions.rotateRefreshToken(refreshToken);
      const current = await this.auth.getCurrentUser(rotated.session.userId);

      const principal: AuthenticatedPrincipal = {
        user: current.user,
        memberships: current.memberships,
        roles: current.roles,
        sessionId: rotated.session.id,
      };

      return {
        access_token: this.tokens.issueAccessToken(principal),
        refresh_token: rotated.refreshToken,
        expires_in: ACCESS_TOKEN_TTL_SECONDS,
        principal: toPrincipalResponse(principal),
      };
    } catch (error) {
      mapAuthActionError(error);
    }
  }

  async me(userId: string): Promise<MeResponse> {
    try {
      const trimmedUserId = userId.trim();

      if (trimmedUserId === '') {
        throw new ActionError(400, 'user_id is required');
      }

      const current = await this.auth.getCurrentUser(trimmedUserId);
      return toMeResponse(current);
    } catch (error) {
      mapAuthActionError(error);
    }
  }
}

export const authActions = new AuthActions();

export async function login(body: LoginRequestBody): Promise<LoginResponse> {
  return authActions.login(body);
}

export async function logout(body: LogoutRequestBody): Promise<void> {
  return authActions.logout(body);
}

export async function refresh(body: RefreshRequestBody): Promise<RefreshResponse> {
  return authActions.refresh(body);
}

export async function me(userId: string): Promise<MeResponse> {
  return authActions.me(userId);
}
