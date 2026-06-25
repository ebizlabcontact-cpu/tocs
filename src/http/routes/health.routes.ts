import type { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/health', async (_request, reply) => {
    return reply.send({ ok: true });
  });
}
