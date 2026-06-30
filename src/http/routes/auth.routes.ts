import type { FastifyInstance } from 'fastify';

import {
  login,
  logout,
  me,
  refresh,
  type LoginRequestBody,
  type LogoutRequestBody,
  type RefreshRequestBody,
} from '../../actions/auth.actions.js';
import { runAction, sendActionError } from '../lib/handle-action.js';
import {
  requireRole,
  ROLES_VIEWER_AND_ABOVE,
  withProtection,
} from '../plugins/rbac.js';

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: LoginRequestBody }>('/api/v1/auth/login', async (request, reply) => {
    const result = await runAction(reply, () => login(request.body));

    if (result !== undefined) {
      return reply.status(200).send(result);
    }
  });

  app.post<{ Body: LogoutRequestBody }>('/api/v1/auth/logout', async (request, reply) => {
    try {
      await logout(request.body);
    } catch (error) {
      return sendActionError(reply, error);
    }

    return reply.status(204).send();
  });

  app.post<{ Body: RefreshRequestBody }>('/api/v1/auth/refresh', async (request, reply) => {
    const result = await runAction(reply, () => refresh(request.body));

    if (result !== undefined) {
      return reply.status(200).send(result);
    }
  });

  app.get(
    '/api/v1/auth/me',
    withProtection(requireRole(ROLES_VIEWER_AND_ABOVE)),
    async (request, reply) => {
      const auth = request.auth;
      if (auth === null) {
        return reply;
      }

      const result = await runAction(reply, () => me(auth.userId));

      if (result !== undefined) {
        return reply.send(result);
      }
    },
  );
}
