# TOCS Error Handling Policy

## Purpose

Standardize how TOCS classifies errors, maps them to HTTP responses, logs them, and redacts sensitive data — without changing Core MVP business rules.

**Scope:** Operations policy aligned with current implementation. Auth/RBAC and notification systems are out of scope.

**Related:** [`LOGGING.md`](./LOGGING.md), [`INCIDENT_RESPONSE.md`](./INCIDENT_RESPONSE.md), [`ENVIRONMENT.md`](./ENVIRONMENT.md)  
**Decision:** DL-038 — Error Handling and Incident Response Policy (ACCEPTED)

---

## 1. Error classification

Errors are categorized by **origin** and **recoverability**. Service-layer domain errors are mapped to HTTP at the Action layer (`src/http/lib/handle-action.ts`).

| Class | Layer | Typical cause | HTTP (when exposed) | User action |
|-------|-------|---------------|---------------------|-------------|
| **ValidationError** | Validation (`src/utils/*.validation.ts`) | Invalid/missing request fields, forbidden patch/cancel fields | **400** via `ActionError` | Fix request body/query |
| **ActionError** | Action / HTTP bridge | Mapped business rule failure with known status | **400 / 404 / 409** (etc.) | See `message` |
| **NotFound** | Service (`*NotFoundError`) | Entity ID does not exist | **404** via `ActionError` | Verify ID / resource |
| **Conflict** | Service / DB | Duplicate key, already canceled, closed formula, version conflict | **409** via `ActionError` | Refresh state, do not retry blindly |
| **InfrastructureError** | Config / DB / runtime | Missing env var, PostgreSQL down, auth failure, port bind failure | **500** or process exit before listen | Ops runbook — [`INCIDENT_RESPONSE.md`](./INCIDENT_RESPONSE.md) |
| **UnexpectedError** | Unhandled exception | Bug, unmapped Prisma error, unknown throw | **500** `{ message: "Internal server error" }` | Escalate; check logs with `request_id` |

### Code mapping (Core MVP)

| Policy class | Implementation |
|--------------|----------------|
| ValidationError | `ValidationError` in validation modules → caught in Action mappers → `ActionError(400, …)` |
| NotFound | e.g. `FormulaNotFoundError`, `CompanyNotFoundError`, `LogisticsNotFoundError` → `ActionError(404, …)` |
| Conflict | e.g. `FormulaAlreadyCanceledError`, `ClosedFormulaTradeMutationError`, `VersionConflictError` → `ActionError(409, …)` |
| InfrastructureError | `EnvironmentValidationError` (`src/config/env.ts`); Prisma connection errors at import/query time |
| UnexpectedError | Non-`ActionError` caught in `sendActionError()` → 500 |

**Startup fail-fast:** `EnvironmentValidationError` terminates the process before the HTTP server binds (`loadEnvironment()` in `createServer()`).

---

## 2. HTTP error response policy

### Standard error body (target contract)

All API error responses should expose:

| Field | Source | Description |
|-------|--------|-------------|
| `request_id` | `x-request-id` header / request logger UUID | Correlates client report with server logs |
| `status` | HTTP status code | Same as response status line |
| `code` | Stable machine-readable code | e.g. `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR` |
| `message` | Human-readable explanation | Safe for clients; no secrets |

**Target example:**

```json
{
  "request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": 404,
  "code": "NOT_FOUND",
  "message": "Formula not found: 00000000-0000-0000-0000-000000000099"
}
```

### Core MVP implementation (today)

| Aspect | Behavior |
|--------|----------|
| Response body | `{ "message": "<text>" }` only (`src/http/lib/handle-action.ts`) |
| `request_id` | Returned as response header **`x-request-id`** (not yet in JSON body) |
| `status` | HTTP status line only |
| `code` | Not yet in body — classify from HTTP status + log context |
| 500 | `{ "message": "Internal server error" }` — no stack trace in response |

**Operator rule:** When triaging, always capture **`x-request-id`** from the response header and search logs for `request_id`.

Successful responses are domain-specific (snake_case JSON); only errors follow the policy above.

---

## 3. Logging policy

Structured JSON logging via [`src/lib/logger.ts`](../../src/lib/logger.ts). See [`LOGGING.md`](./LOGGING.md) for full detail.

| Level | When to use | Examples |
|-------|-------------|----------|
| **error** | Failures requiring attention | Unhandled 500 path, startup config failure, data integrity |
| **warn** | Recoverable anomalies | Deprecated paths, retry succeeded, slow request (future) |
| **info** | Normal operations | `http_request`, `domain_event` |
| **debug** | Verbose diagnostics | Local troubleshooting only; off in production by default |

### Error logging guidelines

```typescript
logger.error('operation_failed', {
  request_id: requestId,       // when available
  error_name: error.name,
  error_message: error.message, // no secrets in message
  formula_id: formulaId,        // business context — IDs OK
});
```

- Do **not** log full `Error` objects (stack may leak paths).
- Do **not** log request bodies until a sanitizer milestone exists.
- Map **ValidationError / ActionError** at Action layer; log **UnexpectedError** at HTTP or global handler.

---

## 4. Sensitive data policy

Applied automatically by `redactSensitive()` before every log write.

| Data | Rule |
|------|------|
| **DATABASE_URL** | Key match or connection-string pattern → `[REDACTED]` |
| **password** | Any key matching `password` → `[REDACTED]` |
| **JWT_SECRET** | Key match → `[REDACTED]` |
| **SESSION_SECRET** | Key match → `[REDACTED]` |
| **ENCRYPTION_KEY** | Key match → `[REDACTED]` |
| **Generic secrets** | Keys: `secret`, `token`, `authorization` → `[REDACTED]` |
| **Connection strings** | Values matching `postgresql://`, `mysql://`, `mongodb://` → `[REDACTED]` |

**Never include in logs or error JSON bodies:**

- Connection strings or credentials
- Production secret env values
- Raw Authorization headers

**Allowed in logs:** resource UUIDs, `formula_no`, HTTP method/url (no query secrets), `status_code`, `request_id`.

---

## 5. Status code matrix (Action layer)

| HTTP | Meaning | Typical `code` (target) | Source |
|------|---------|-------------------------|--------|
| 400 | Validation / bad input | `VALIDATION_ERROR` | `ValidationError`, business rule messages |
| 404 | Resource not found | `NOT_FOUND` | `*NotFoundError` |
| 409 | State conflict | `CONFLICT` | Closed formula, cancel twice, version conflict, duplicates |
| 500 | Unexpected / infrastructure | `INTERNAL_ERROR` | Unmapped errors, DB unavailable |

Payment record re-cancel on already-canceled record: **409** (not idempotent) — per TOCS payment rules.

---

## Document history

| Date | Change |
|------|--------|
| 2026-06-23 | v1.2.6 — Initial error handling policy (Production Hardening) |
