import { pathToFileURL } from 'node:url';

import Fastify from 'fastify';

import { registerCloseRoutes } from './routes/close.routes.js';
import { registerCompanyRoutes } from './routes/company.routes.js';
import { registerDashboardRoutes } from './routes/dashboard.routes.js';
import { registerFormulaRoutes } from './routes/formula.routes.js';
import { registerHealthRoutes } from './routes/health.routes.js';
import { registerInvoiceRoutes } from './routes/invoice.routes.js';
import { registerPaymentRoutes } from './routes/payment.routes.js';
import { registerSettlementRoutes } from './routes/settlement.routes.js';
import { registerShareRoutes } from './routes/share.routes.js';
import { registerVersionRoutes } from './routes/version.routes.js';

export async function createServer() {
  const app = Fastify();
  await registerHealthRoutes(app);
  await registerFormulaRoutes(app);
  await registerPaymentRoutes(app);
  await registerCloseRoutes(app);
  await registerDashboardRoutes(app);
  await registerInvoiceRoutes(app);
  await registerVersionRoutes(app);
  await registerShareRoutes(app);
  await registerSettlementRoutes(app);
  await registerCompanyRoutes(app);
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
