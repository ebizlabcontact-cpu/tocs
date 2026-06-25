import { pathToFileURL } from 'node:url';

import Fastify from 'fastify';

import { registerHealthRoutes } from './routes/health.routes.js';

export async function createServer() {
  const app = Fastify();
  await registerHealthRoutes(app);
  return app;
}

export async function start(options: { port?: number; host?: string } = {}) {
  const app = await createServer();
  const port = options.port ?? Number(process.env.PORT ?? 3000);
  const host = options.host ?? '127.0.0.1';
  await app.listen({ port, host });
  return app;
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  return import.meta.url === pathToFileURL(entry).href;
}

if (isMainModule()) {
  start().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
