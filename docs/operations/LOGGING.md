# TOCS Logging & Observability

## Purpose

Minimum structured logging for HTTP requests, domain events, and errors in local, test, and production environments.

**Implementation:** [`src/lib/logger.ts`](../../src/lib/logger.ts), [`src/http/plugins/request-logger.ts`](../../src/http/plugins/request-logger.ts)  
**Configuration:** [`docs/operations/ENVIRONMENT.md`](./ENVIRONMENT.md) — `LOG_LEVEL`, `NODE_ENV`

---

## 1. Logger singleton

Import the shared logger:

```typescript
import { logger, logDomainEvent, DOMAIN_EVENTS } from '../lib/logger.js';
```

- Single `logger` instance for the process.
- Output: **JSON lines** to stdout/stderr (one object per line).
- Fields are passed through `redactSensitive()` before write.

---

## 2. Log levels

| Level | Rank | Stream | Use |
|-------|------|--------|-----|
| `error` | 0 | stderr | Unhandled failures, fatal configuration |
| `warn` | 1 | stderr | Recoverable anomalies, deprecation |
| `info` | 2 | stdout | HTTP requests, domain events (default) |
| `debug` | 3 | stdout | Verbose diagnostics |

### `LOG_LEVEL` behavior

| Setting | Effect |
|---------|--------|
| Unset | **`info`** (all environments) |
| `LOG_LEVEL=debug` | Includes `debug` lines |
| `LOG_LEVEL=warn` | `warn` + `error` only |
| `LOG_LEVEL=error` | `error` only |
| `NODE_ENV=production` | Default remains **`info`**; `debug` off unless `LOG_LEVEL=debug` |

Production policy: **default `info`**, **no debug** unless explicitly enabled.

---

## 3. HTTP request logging

### Plugin registration

Register before route handlers in `createServer()`:

```typescript
import { registerRequestLogger } from './plugins/request-logger.js';

export async function createServer() {
  const app = Fastify();
  await registerRequestLogger(app);
  // ... register routes
  return app;
}
```

### Log shape (`msg: http_request`)

| Field | Description |
|-------|-------------|
| `request_id` | UUID per request; also returned as `x-request-id` response header |
| `method` | HTTP method |
| `url` | Path and query string |
| `status_code` | Response status |
| `duration_ms` | Wall time from `onRequest` to `onResponse` |
| `ip` | Client IP (`x-forwarded-for` first hop when present) |

Example:

```json
{
  "level": "info",
  "time": "2026-06-28T16:00:00.000Z",
  "msg": "http_request",
  "request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "method": "GET",
  "url": "/api/v1/health",
  "status_code": 200,
  "duration_ms": 3,
  "ip": "127.0.0.1"
}
```

---

## 4. Domain event logging

### Supported events

| Constant | Event | Typical source (wiring milestone) |
|----------|-------|----------------------------------|
| `DOMAIN_EVENTS.FORMULA_CREATE` | `FORMULA_CREATE` | Formula create service |
| `DOMAIN_EVENTS.PAYMENT_CANCEL` | `PAYMENT_CANCEL` | Payment record cancel |
| `DOMAIN_EVENTS.FORMULA_CLOSE` | `FORMULA_CLOSE` | Close formula |
| `DOMAIN_EVENTS.FORMULA_CANCEL` | `FORMULA_CANCEL` | Cancel formula |
| `DOMAIN_EVENTS.VERSION_RETRY` | `VERSION_RETRY` | Version service P2002 retry |

### API

```typescript
import { logDomainEvent, DOMAIN_EVENTS } from '../lib/logger.js';

logDomainEvent(DOMAIN_EVENTS.FORMULA_CREATE, {
  formula_id: formula.id,
  formula_no: formula.formulaNo,
});
```

Log record:

```json
{
  "level": "info",
  "time": "2026-06-28T16:00:01.000Z",
  "msg": "domain_event",
  "event": "FORMULA_CREATE",
  "formula_id": "...",
  "formula_no": "F-2026-00001"
}
```

Core MVP: logger and event constants are ready; **service-layer calls are a follow-up** (no business rule changes in v1.2.2).

---

## 5. Sensitive data policy

**Never log** values for:

- `DATABASE_URL`
- `password` (any key matching `password`)
- `JWT_SECRET`
- `SESSION_SECRET`
- `ENCRYPTION_KEY`
- Connection strings (`postgresql://`, `mysql://`, `mongodb://`)

Redaction rules (`redactSensitive`):

1. Matching **keys** → `[REDACTED]`
2. Matching **string values** (URL credentials) → `[REDACTED]`
3. Applied recursively to nested objects and arrays

Do not pass secrets in log `fields`. Do not log raw request bodies until a body-sanitizer milestone exists.

---

## 6. Error logging

```typescript
logger.error('payment_record_create_failed', {
  formula_id: formulaId,
  error_name: error instanceof Error ? error.name : 'UnknownError',
  error_message: error instanceof Error ? error.message : String(error),
});
```

Avoid logging full `error` objects (may contain stack with env paths). Stack traces at `debug` only when needed.

---

## 7. Environment matrix

| Environment | `LOG_LEVEL` | HTTP plugin | Domain events |
|-------------|-------------|-------------|---------------|
| local | `info` or `debug` | Register in server | On wire-up |
| test (CI) | `info` (default) | Optional | Optional |
| production | **`info`** | **Required** | On wire-up |

---

## 8. Operations

### View logs (production)

- Aggregate JSON lines via platform log agent (CloudWatch, Loki, etc.).
- Filter: `msg = "http_request"`, `status_code >= 500`.
- Correlate: `request_id` across services (future).

### Health

Logging does not replace metrics. Use `GET /api/v1/health` for liveness; use HTTP log `status_code` / `duration_ms` for SLI inputs in a later observability milestone.

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-28 | v1.2.2 — Logger singleton, HTTP request plugin, domain event constants |
