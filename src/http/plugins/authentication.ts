import type { FastifyInstance } from 'fastify';
import { UserStatus } from '@prisma/client';

import { ActionError } from '../../actions/formula.actions.js';
import { authRepository, type AuthRepository } from '../../repositories/auth.repository.js';
import {
  credentialService,
  GENERIC_LOGIN_ERROR,
  type CredentialService,
} from '../../services/credential.service.js';
import { tokenService, TokenVerificationError, type TokenService } from '../../services/token.service.js';
import { sendActionError } from '../lib/handle-action.js';
import type { RequestAuthContext } from '../types/auth-request.js';

const BEARER_PREFIX = /^Bearer\s+(.+)$/i;

export interface AuthenticationDeps {
  tokenService?: TokenService;
  authRepository?: AuthRepository;
  credentialService?: CredentialService;
}

function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (authorizationHeader === undefined) {
    return null;
  }

  const match = BEARER_PREFIX.exec(authorizationHeader.trim());

  if (!match?.[1]) {
    return null;
  }

  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

async function buildRequestAuth(
  repository: AuthRepository,
  userId: string,
  email: string,
): Promise<RequestAuthContext> {
  const memberships = await repository.listMembershipsByUserId(userId);
  const activeMemberships = memberships.filter((membership) => membership.isActive);

  return {
    userId,
    email,
    roles: activeMemberships.map((membership) => membership.role),
    memberships: activeMemberships.map((membership) => ({
      company_id: membership.companyId,
      role: membership.role,
    })),
  };
}

async function ensureRequestEligible(
  credentials: CredentialService,
  user: Awaited<ReturnType<AuthRepository['findUserById']>>,
): Promise<NonNullable<Awaited<ReturnType<AuthRepository['findUserById']>>>> {
  if (!user) {
    throw new ActionError(401, 'Invalid access token');
  }

  const eligible = await credentials.resolveLoginEligibility(user);

  if (eligible.status === UserStatus.SUSPENDED) {
    throw new ActionError(403, GENERIC_LOGIN_ERROR);
  }

  if (
    eligible.status === UserStatus.LOCKED &&
    credentials.isAccountLocked(eligible.id)
  ) {
    throw new ActionError(423, GENERIC_LOGIN_ERROR);
  }

  if (eligible.status !== UserStatus.ACTIVE) {
    throw new ActionError(401, 'Invalid access token');
  }

  return eligible;
}

export async function registerAuthentication(
  app: FastifyInstance,
  deps: AuthenticationDeps = {},
): Promise<void> {
  const tokens = deps.tokenService ?? tokenService;
  const repository = deps.authRepository ?? authRepository;
  const credentials = deps.credentialService ?? credentialService;

  app.decorateRequest('auth', null);

  app.addHook('onRequest', async (request, reply) => {
    request.auth = null;

    const authorizationHeader = request.headers.authorization;

    if (authorizationHeader === undefined) {
      return;
    }

    const accessToken = extractBearerToken(authorizationHeader);

    if (accessToken === null) {
      sendActionError(reply, new ActionError(401, 'Invalid access token'));
      return;
    }

    try {
      const payload = tokens.verifyAccessToken(accessToken);
      const user = await repository.findUserById(payload.sub);
      const eligible = await ensureRequestEligible(credentials, user);
      request.auth = await buildRequestAuth(repository, eligible.id, eligible.email);
    } catch (error) {
      if (error instanceof TokenVerificationError) {
        sendActionError(reply, new ActionError(401, 'Invalid access token'));
        return;
      }

      if (error instanceof ActionError) {
        sendActionError(reply, error);
        return;
      }

      sendActionError(reply, new ActionError(500, 'Internal server error'));
    }
  });
}
