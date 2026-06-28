import type { FastifyInstance, FastifyRequest } from 'fastify';
import { randomUUID } from 'node:crypto';

import { logger } from '../../lib/logger.js';

const requestIds = new WeakMap<FastifyRequest, string>();
const requestStartTimes = new WeakMap<FastifyRequest, number>();

function resolveClientIp(request: FastifyRequest): string {
  const forwarded = request.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? request.ip;
  }

  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0]?.trim() ?? request.ip;
  }

  return request.ip;
}

function getRequestId(request: FastifyRequest): string {
  const existing = requestIds.get(request);

  if (existing) {
    return existing;
  }

  const requestId = randomUUID();
  requestIds.set(request, requestId);
  return requestId;
}

export async function registerRequestLogger(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request, reply) => {
    const requestId = randomUUID();
    requestIds.set(request, requestId);
    requestStartTimes.set(request, Date.now());
    reply.header('x-request-id', requestId);
  });

  app.addHook('onResponse', async (request, reply) => {
    const startedAt = requestStartTimes.get(request) ?? Date.now();
    const durationMs = Date.now() - startedAt;

    logger.info('http_request', {
      request_id: getRequestId(request),
      method: request.method,
      url: request.url,
      status_code: reply.statusCode,
      duration_ms: durationMs,
      ip: resolveClientIp(request),
    });
  });
}
