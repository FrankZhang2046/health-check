# Health Check Dashboard

A minimal Vite + TypeScript dashboard that polls `/healthCheck` endpoints across your services and renders a rollup status, per-service cards, and per-check breakdowns.

## Local dev

```sh
pnpm install
pnpm dev      # http://localhost:5173
pnpm build    # → dist/
pnpm preview  # serve dist/ locally
```

## Adding a service

Append to `SERVICES` in `src/services.ts`:

```ts
{ id: 'my-service', name: 'My Service', url: 'https://.../healthCheck' }
```

The endpoint must conform to the contract below.

---

## Health API Formatting

> Paste the section below into another project's coding agent to have it implement a compatible `/healthCheck` endpoint.

### Goal

Expose a public HTTP `GET /healthCheck` endpoint that returns a JSON payload describing the service's overall health plus a per-dependency breakdown. The response is consumed by a browser dashboard, so it must be reachable cross-origin without authentication.

### HTTP behavior

- **Method:** `GET`. No auth. No query params required.
- **Status codes:**
  - `200 OK` when overall status is `healthy` or `degraded`.
  - `503 Service Unavailable` when overall status is `unhealthy`. The body **must still be the same JSON schema** — the dashboard parses 503 responses, it does not treat them as opaque errors.
  - Any other non-2xx (e.g. `500`, `502`) is treated as a hard error and only the HTTP status is shown; do not use them for expected unhealthy conditions.
- **CORS:** respond with `Access-Control-Allow-Origin: *` (or an explicit allow-list including the dashboard's origin). Preflight is not needed for a plain GET, but returning permissive CORS on `OPTIONS` doesn't hurt.
- **Latency budget:** respond within a few seconds. Consumers apply an 8-second client timeout. Run dependency probes in parallel and cap each probe individually — never let one slow dependency stall the whole response.
- **Caching:** send `Cache-Control: no-store`. The dashboard also sets `cache: 'no-store'` on the fetch, but be defensive.
- **Content-Type:** `application/json; charset=utf-8`.

### Response schema

```ts
type CheckStatus = 'healthy' | 'degraded' | 'unhealthy';

interface Check {
  name: string;           // Short human label, e.g. "Postgres", "Redis", "Stripe API"
  status: CheckStatus;
  latencyMs: number;      // Integer milliseconds this probe took. Use 0 if not measured.
  critical: boolean;      // If true, an unhealthy result forces the rollup to unhealthy.
  error?: string;         // Optional short error message when status !== 'healthy'.
}

interface HealthResponse {
  status: CheckStatus;    // Overall rollup — see rules below.
  service: string;        // Service name, e.g. "wordforge-api".
  version: string;        // Deployed version, e.g. "1.4.2" or a git SHA. No leading "v".
  timestamp: string;      // ISO 8601 UTC, e.g. "2026-07-20T15:04:05.000Z".
  checks: Check[];        // May be empty, but the field must be present.
}
```

### Rollup rules

Compute the top-level `status` from `checks`:

1. If **any** check with `critical: true` has `status: 'unhealthy'` → overall is `'unhealthy'` (respond `503`).
2. Else if **any** check has `status: 'unhealthy'` or `status: 'degraded'` → overall is `'degraded'` (respond `200`).
3. Else → overall is `'healthy'` (respond `200`).

A non-critical check being unhealthy degrades the rollup but does not fail it. Errors thrown inside a probe must be caught and converted to an unhealthy `Check` with an `error` string — an uncaught exception must not fail the whole endpoint.

### Example — healthy

```json
{
  "status": "healthy",
  "service": "wordforge-api",
  "version": "1.4.2",
  "timestamp": "2026-07-20T15:04:05.000Z",
  "checks": [
    { "name": "Postgres", "status": "healthy", "latencyMs": 8,  "critical": true  },
    { "name": "Redis",    "status": "healthy", "latencyMs": 2,  "critical": true  },
    { "name": "Stripe",   "status": "healthy", "latencyMs": 142, "critical": false }
  ]
}
```

### Example — degraded (non-critical dependency down, HTTP 200)

```json
{
  "status": "degraded",
  "service": "wordforge-api",
  "version": "1.4.2",
  "timestamp": "2026-07-20T15:04:05.000Z",
  "checks": [
    { "name": "Postgres", "status": "healthy",   "latencyMs": 9,  "critical": true  },
    { "name": "Stripe",   "status": "unhealthy", "latencyMs": 8000, "critical": false, "error": "Timeout after 8s" }
  ]
}
```

### Example — unhealthy (critical dependency down, HTTP 503)

```json
{
  "status": "unhealthy",
  "service": "wordforge-api",
  "version": "1.4.2",
  "timestamp": "2026-07-20T15:04:05.000Z",
  "checks": [
    { "name": "Postgres", "status": "unhealthy", "latencyMs": 8000, "critical": true, "error": "connection refused" }
  ]
}
```

### Implementation checklist

- [ ] Public unauthenticated `GET /healthCheck`.
- [ ] Response matches the schema above exactly (field names, casing, types).
- [ ] `checks` is always an array, even when empty.
- [ ] Each dependency probe is wrapped in try/catch and has its own timeout (recommended ≤ 2s each).
- [ ] Probes run in parallel (`Promise.all` / `errgroup` / equivalent).
- [ ] Rollup status follows the three-rule precedence above.
- [ ] HTTP 200 for healthy/degraded, HTTP 503 for unhealthy — never 500 for expected outages.
- [ ] `Access-Control-Allow-Origin` header is set.
- [ ] `Cache-Control: no-store` header is set.
- [ ] `version` reflects the actual deployed build (env var, git SHA, or package version).
- [ ] `timestamp` is generated at response time, not at boot.
