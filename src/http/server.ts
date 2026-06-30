import { pathToFileURL } from 'node:url';

import Fastify from 'fastify';

import { loadEnvironment } from '../config/env.js';
import { registerAuthentication } from './plugins/authentication.js';
import { registerRequestLogger } from './plugins/request-logger.js';
import { registerAuthRoutes } from './routes/auth.routes.js';
import { registerCloseRoutes } from './routes/close.routes.js';
import { registerCompanyRoutes } from './routes/company.routes.js';
import { registerDashboardRoutes } from './routes/dashboard.routes.js';
import { registerFormulaRoutes } from './routes/formula.routes.js';
import { registerHealthRoutes } from './routes/health.routes.js';
import { registerInvoiceRoutes } from './routes/invoice.routes.js';
import { registerLogisticsRoutes } from './routes/logistics.routes.js';
import { registerParticipantRoutes } from './routes/participant.routes.js';
import { registerPaymentRoutes } from './routes/payment.routes.js';
import { registerSettlementRoutes } from './routes/settlement.routes.js';
import { registerShareRoutes } from './routes/share.routes.js';
import { registerVersionRoutes } from './routes/version.routes.js';

export async function createServer() {
  loadEnvironment();

  const app = Fastify();
  await registerRequestLogger(app);
  await registerAuthentication(app);
  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerFormulaRoutes(app);
  await registerPaymentRoutes(app);
  await registerCloseRoutes(app);
  await registerDashboardRoutes(app);
  await registerInvoiceRoutes(app);
  await registerVersionRoutes(app);
  await registerShareRoutes(app);
  await registerSettlementRoutes(app);
  await registerCompanyRoutes(app);
  await registerParticipantRoutes(app);
  await registerLogisticsRoutes(app);
  return app;
}

export async function start(options: { port?: number; host?: string } = {}) {
  const env = loadEnvironment();
  const app = await createServer();
  const port = options.port ?? env.port;
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
