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

  app.get<{ Querystring: { user_id?: string } }>('/api/v1/auth/me', async (request, reply) => {
    const result = await runAction(reply, () => me(request.query.user_id ?? ''));

    if (result !== undefined) {
      return reply.send(result);
    }
  });
}
