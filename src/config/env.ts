import 'dotenv/config';

export type NodeEnv = 'development' | 'test' | 'production';

export type EnvLogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface AppEnvironment {
  databaseUrl: string;
  nodeEnv: NodeEnv;
  port: number;
  logLevel: EnvLogLevel;
}

export class EnvironmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvironmentValidationError';
  }
}

let cachedEnvironment: AppEnvironment | undefined;

const NODE_ENV_VALUES: ReadonlySet<NodeEnv> = new Set(['development', 'test', 'production']);

const LOG_LEVEL_VALUES: ReadonlySet<EnvLogLevel> = new Set(['error', 'warn', 'info', 'debug']);

function parseNodeEnv(raw: string | undefined): NodeEnv {
  const value = raw?.trim();

  if (!value) {
    return 'development';
  }

  if (value === 'local') {
    return 'development';
  }

  if (NODE_ENV_VALUES.has(value as NodeEnv)) {
    return value as NodeEnv;
  }

  throw new EnvironmentValidationError(
    'NODE_ENV must be one of: development, test, production',
  );
}

function parsePort(raw: string | undefined): number {
  const value = raw?.trim();

  if (!value) {
    return 3000;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new EnvironmentValidationError('PORT must be an integer between 1 and 65535');
  }

  return port;
}

function parseLogLevel(raw: string | undefined): EnvLogLevel {
  const value = raw?.trim().toLowerCase();

  if (!value) {
    return 'info';
  }

  if (LOG_LEVEL_VALUES.has(value as EnvLogLevel)) {
    return value as EnvLogLevel;
  }

  throw new EnvironmentValidationError(
    'LOG_LEVEL must be one of: error, warn, info, debug',
  );
}

function parseDatabaseUrl(raw: string | undefined): string {
  const value = raw?.trim();

  if (!value) {
    throw new EnvironmentValidationError('DATABASE_URL is required');
  }

  return value;
}

export function loadEnvironment(): AppEnvironment {
  if (cachedEnvironment) {
    return cachedEnvironment;
  }

  cachedEnvironment = {
    databaseUrl: parseDatabaseUrl(process.env.DATABASE_URL),
    nodeEnv: parseNodeEnv(process.env.NODE_ENV),
    port: parsePort(process.env.PORT),
    logLevel: parseLogLevel(process.env.LOG_LEVEL),
  };

  return cachedEnvironment;
}

export function getEnvironment(): AppEnvironment {
  if (!cachedEnvironment) {
    throw new EnvironmentValidationError(
      'Environment is not loaded. Call loadEnvironment() during application startup.',
    );
  }

  return cachedEnvironment;
}
