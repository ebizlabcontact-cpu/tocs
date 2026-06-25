import type { FastifyReply } from 'fastify';

import { ActionError } from '../../actions/formula.actions.js';

export function sendActionError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof ActionError) {
    return reply.status(error.status).send({ message: error.message });
  }

  return reply.status(500).send({ message: 'Internal server error' });
}

export async function runAction<T>(
  reply: FastifyReply,
  action: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await action();
  } catch (error) {
    sendActionError(reply, error);
    return undefined;
  }
}
