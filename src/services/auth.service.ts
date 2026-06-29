import {
  MembershipRole,
  UserStatus,
  type CompanyMembership,
  type Session,
  type User,
} from '@prisma/client';

import {
  AuthRepository,
  authRepository,
} from '../repositories/auth.repository.js';
import {
  CredentialService,
  GENERIC_LOGIN_ERROR,
  credentialService,
} from './credential.service.js';

export class ActionError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ActionError';
  }
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SafeUser {
  id: string;
  email: string;
  name: string | null;
  status: UserStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MembershipSummary {
  id: string;
  companyId: string;
  role: MembershipRole;
  isActive: boolean;
  joinedAt: Date;
}

export interface AuthenticatedPrincipal {
  user: SafeUser;
  sessionId?: string;
  memberships: MembershipSummary[];
  roles: MembershipRole[];
}

export interface CurrentUserResponse {
  user: SafeUser;
  memberships: MembershipSummary[];
  roles: MembershipRole[];
}

function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function toMembershipSummary(membership: CompanyMembership): MembershipSummary {
  return {
    id: membership.id,
    companyId: membership.companyId,
    role: membership.role,
    isActive: membership.isActive,
    joinedAt: membership.joinedAt,
  };
}

function isSessionActive(session: Session, now: Date): boolean {
  return session.revokedAt === null && session.expiresAt > now;
}

export class AuthService {
  constructor(
    private readonly repository: AuthRepository = authRepository,
    private readonly credentials: CredentialService = credentialService,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async login(input: LoginRequest): Promise<AuthenticatedPrincipal> {
    this.validateLoginRequest(input);

    const normalizedEmail = this.credentials.normalizeLoginEmail(input.email);
    const user = await this.repository.findUserByEmail(normalizedEmail);

    if (!user) {
      throw new ActionError(401, GENERIC_LOGIN_ERROR);
    }

    const eligibleUser = await this.ensureLoginEligible(user);
    const passwordValid = await this.credentials.verifyPassword(
      input.password,
      eligibleUser.passwordHash,
    );

    if (!passwordValid) {
      await this.credentials.recordFailedLoginAttempt(eligibleUser);
      throw new ActionError(401, GENERIC_LOGIN_ERROR);
    }

    await this.credentials.recordSuccessfulLogin(eligibleUser.id);
    const updatedUser = await this.repository.updateUserLastLoginAt(
      eligibleUser.id,
      this.clock(),
    );

    return this.buildAuthenticatedPrincipal(updatedUser);
  }

  async logout(sessionId: string): Promise<void> {
    const session = await this.repository.findSessionById(sessionId);

    if (!session) {
      throw new ActionError(404, 'Session not found');
    }

    await this.repository.revokeSession(sessionId, this.clock());
  }

  async refresh(sessionId: string): Promise<AuthenticatedPrincipal> {
    const session = await this.requireActiveSession(sessionId);
    const user = await this.repository.findUserById(session.userId);

    if (!user) {
      throw new ActionError(404, 'User not found');
    }

    const eligibleUser = await this.ensureLoginEligible(user);

    return this.buildAuthenticatedPrincipal(eligibleUser, sessionId);
  }

  async getCurrentUser(userId: string): Promise<CurrentUserResponse> {
    const user = await this.repository.findUserById(userId);

    if (!user) {
      throw new ActionError(404, 'User not found');
    }

    const principal = await this.buildAuthenticatedPrincipal(user);

    return {
      user: principal.user,
      memberships: principal.memberships,
      roles: principal.roles,
    };
  }

  private validateLoginRequest(input: LoginRequest): void {
    if (input.email.trim() === '') {
      throw new ActionError(400, 'email is required');
    }

    if (input.password === '') {
      throw new ActionError(400, 'password is required');
    }
  }

  private async ensureLoginEligible(user: User): Promise<User> {
    const eligible = await this.credentials.resolveLoginEligibility(user);

    if (eligible.status === UserStatus.SUSPENDED) {
      throw new ActionError(403, GENERIC_LOGIN_ERROR);
    }

    if (
      eligible.status === UserStatus.LOCKED &&
      this.credentials.isAccountLocked(eligible.id)
    ) {
      throw new ActionError(423, GENERIC_LOGIN_ERROR);
    }

    if (eligible.status === UserStatus.INVITED) {
      throw new ActionError(401, GENERIC_LOGIN_ERROR);
    }

    if (eligible.status !== UserStatus.ACTIVE) {
      throw new ActionError(401, GENERIC_LOGIN_ERROR);
    }

    return eligible;
  }

  private async requireActiveSession(sessionId: string): Promise<Session> {
    const session = await this.repository.findSessionById(sessionId);

    if (!session) {
      throw new ActionError(404, 'Session not found');
    }

    if (!isSessionActive(session, this.clock())) {
      throw new ActionError(401, 'Invalid session');
    }

    return session;
  }

  private async buildAuthenticatedPrincipal(
    user: User,
    sessionId?: string,
  ): Promise<AuthenticatedPrincipal> {
    const memberships = await this.repository.listMembershipsByUserId(user.id);
    const roles = memberships
      .filter((membership) => membership.isActive)
      .map((membership) => membership.role);

    const principal: AuthenticatedPrincipal = {
      user: toSafeUser(user),
      memberships: memberships.map(toMembershipSummary),
      roles,
    };

    if (sessionId !== undefined) {
      principal.sessionId = sessionId;
    }

    return principal;
  }
}

export const authService = new AuthService();
