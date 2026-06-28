import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FastifyInstance } from 'fastify';

import { getEnvironment } from '../../config/env.js';

const SERVICE_NAME = 'tocs';

let cachedServiceVersion: string | undefined;

function resolveServiceVersion(): string {
  if (cachedServiceVersion) {
    return cachedServiceVersion;
  }

  const currentDir = dirname(fileURLToPath(import.meta.url));
  const packageJsonPath = join(currentDir, '../../../package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version?: string };

  cachedServiceVersion = packageJson.version ?? '0.0.0';
  return cachedServiceVersion;
}

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/health', async (_request, reply) => {
    const environment = getEnvironment();

    return reply.send({
      ok: true,
      status: 'ok',
      service: SERVICE_NAME,
      version: resolveServiceVersion(),
      environment: environment.nodeEnv,
      timestamp: new Date().toISOString(),
    });
  });
}
