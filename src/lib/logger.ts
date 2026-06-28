import 'dotenv/config';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export const DOMAIN_EVENTS = {
  FORMULA_CREATE: 'FORMULA_CREATE',
  PAYMENT_CANCEL: 'PAYMENT_CANCEL',
  FORMULA_CLOSE: 'FORMULA_CLOSE',
  FORMULA_CANCEL: 'FORMULA_CANCEL',
  VERSION_RETRY: 'VERSION_RETRY',
} as const;

export type DomainEvent = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

const LEVEL_RANK: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const SENSITIVE_KEY_PATTERN =
  /^(password|database_url|jwt_secret|session_secret|encryption_key|secret|token|authorization)$/i;

const SENSITIVE_VALUE_PATTERNS = [
  /postgresql:\/\/[^\s]+/i,
  /mysql:\/\/[^\s]+/i,
  /mongodb(\+srv)?:\/\/[^\s]+/i,
];

function isLogLevel(value: string): value is LogLevel {
  return value === 'error' || value === 'warn' || value === 'info' || value === 'debug';
}

function resolveLogLevel(): LogLevel {
  const configured = process.env.LOG_LEVEL?.trim().toLowerCase();

  if (configured && isLogLevel(configured)) {
    return configured;
  }

  return 'info';
}

function shouldLog(level: LogLevel, minimumLevel: LogLevel): boolean {
  return LEVEL_RANK[level] <= LEVEL_RANK[minimumLevel];
}

function redactString(value: string): string {
  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    if (pattern.test(value)) {
      return '[REDACTED]';
    }
  }

  return value;
}

export function redactSensitive<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return redactString(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item)) as T;
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        result[key] = '[REDACTED]';
        continue;
      }

      result[key] = redactSensitive(nested);
    }

    return result as T;
  }

  return value;
}

export interface LogFields {
  [key: string]: unknown;
}

interface LogRecord extends LogFields {
  level: LogLevel;
  time: string;
  msg: string;
}

function writeLog(level: LogLevel, msg: string, fields?: LogFields): void {
  const minimumLevel = resolveLogLevel();

  if (!shouldLog(level, minimumLevel)) {
    return;
  }

  const record: LogRecord = {
    level,
    time: new Date().toISOString(),
    msg,
    ...redactSensitive(fields ?? {}),
  };

  const line = JSON.stringify(record);

  if (level === 'error') {
    console.error(line);
    return;
  }

  if (level === 'warn') {
    console.warn(line);
    return;
  }

  console.log(line);
}

export class Logger {
  error(msg: string, fields?: LogFields): void {
    writeLog('error', msg, fields);
  }

  warn(msg: string, fields?: LogFields): void {
    writeLog('warn', msg, fields);
  }

  info(msg: string, fields?: LogFields): void {
    writeLog('info', msg, fields);
  }

  debug(msg: string, fields?: LogFields): void {
    writeLog('debug', msg, fields);
  }

  domainEvent(event: DomainEvent, fields?: LogFields): void {
    writeLog('info', 'domain_event', {
      event,
      ...fields,
    });
  }
}

export const logger = new Logger();

export function logDomainEvent(event: DomainEvent, fields?: LogFields): void {
  logger.domainEvent(event, fields);
}
