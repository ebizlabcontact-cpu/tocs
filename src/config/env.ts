import 'dotenv/config';

export type NodeEnv = 'development' | 'test' | 'production';

export type EnvLogLevel = 'error' | 'warn' | 'info' | 'debug';

export type RequiredEnvironmentVariable =
  | 'DATABASE_URL'
  | 'NODE_ENV'
  | 'PORT'
  | 'LOG_LEVEL'
  | 'JWT_SECRET'
  | 'SESSION_SECRET'
  | 'ENCRYPTION_KEY';

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

const ALWAYS_REQUIRED: readonly RequiredEnvironmentVariable[] = [
  'DATABASE_URL',
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL',
];

const PRODUCTION_SECRETS: readonly RequiredEnvironmentVariable[] = [
  'JWT_SECRET',
  'SESSION_SECRET',
  'ENCRYPTION_KEY',
];

const SECRET_VARIABLES: ReadonlySet<RequiredEnvironmentVariable> = new Set([
  'DATABASE_URL',
  ...PRODUCTION_SECRETS,
]);

let cachedEnvironment: AppEnvironment | undefined;

const NODE_ENV_VALUES: ReadonlySet<NodeEnv> = new Set(['development', 'test', 'production']);

const LOG_LEVEL_VALUES: ReadonlySet<EnvLogLevel> = new Set(['error', 'warn', 'info', 'debug']);

function isPresent(raw: string | undefined): boolean {
  return Boolean(raw?.trim());
}

/**
 * CI sets NODE_ENV=test but may omit PORT/LOG_LEVEL. Apply safe defaults only in test
 * so createServer() works without relaxing production/development fail-fast rules.
 */
function applyTestEnvironmentDefaults(): void {
  if (process.env.NODE_ENV?.trim() !== 'test') {
    return;
  }

  if (!isPresent(process.env.PORT)) {
    process.env.PORT = '3000';
  }

  if (!isPresent(process.env.LOG_LEVEL)) {
    process.env.LOG_LEVEL = 'info';
  }
}

export function getRequiredEnvironmentVariables(
  nodeEnv?: string,
): readonly RequiredEnvironmentVariable[] {
  if (nodeEnv?.trim() === 'production') {
    return [...ALWAYS_REQUIRED, ...PRODUCTION_SECRETS];
  }

  return ALWAYS_REQUIRED;
}

function logVariablePresence(name: RequiredEnvironmentVariable): void {
  console.log(`[env] ${name}=present`);
}

export function validateEnvironment(): void {
  applyTestEnvironmentDefaults();

  const rawNodeEnv = process.env.NODE_ENV;
  const required = getRequiredEnvironmentVariables(rawNodeEnv);
  const missing: RequiredEnvironmentVariable[] = [];

  for (const name of required) {
    if (!isPresent(process.env[name])) {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    throw new EnvironmentValidationError(
      `Missing required environment variable(s): ${missing.join(', ')}`,
    );
  }

  // Format validation before secret presence logging.
  parseDatabaseUrl(process.env.DATABASE_URL);
  parseNodeEnv(process.env.NODE_ENV);
  parsePort(process.env.PORT);
  parseLogLevel(process.env.LOG_LEVEL);

  for (const name of required) {
    if (SECRET_VARIABLES.has(name)) {
      logVariablePresence(name);
    }
  }
}

function parseNodeEnv(raw: string | undefined): NodeEnv {
  const value = raw?.trim();

  if (!value) {
    throw new EnvironmentValidationError('NODE_ENV is required');
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
    throw new EnvironmentValidationError('PORT is required');
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
    throw new EnvironmentValidationError('LOG_LEVEL is required');
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

  validateEnvironment();

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
