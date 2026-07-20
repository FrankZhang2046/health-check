# Health Check Dashboard — Plan

## Context

You run multiple SaaS products, each exposing a public `/healthCheck` endpoint that returns a `{ status, service, version, timestamp, checks[] }` payload (wordforge is the first, running at `https://us-central1-wordsmith-vocabulary-builder.cloudfunctions.net/healthCheck`). You want a single dashboard that shows the live status of all of them at a glance.

Requirements locked in this session:
- **Live view only** — no history, no alerts, no cron, no storage
- **Simplest possible stack** — Vite + vanilla TS, static site
- Browser polls each endpoint directly; endpoints have open CORS, so no proxy needed

Out of scope for v1: auth, uptime %, latency history, incident timeline, notifications. Any of those can be layered on later without rewriting the frontend.

## Stack

- **Vite** (vanilla TS template) — dev server + build tooling
- **TypeScript** — for the response schema type
- **No framework, no dependencies beyond Vite**
- **pnpm** for all install/run commands
- **Firebase Hosting** for deploy (you already have a Firebase account; swap for Vercel/Netlify/GitHub Pages if preferred — all work with the same static build output)

## Project layout

```
health-check/
├── index.html          # single page shell
├── src/
│   ├── main.ts         # bootstrap + poll loop + render
│   ├── services.ts     # config: list of SaaS products to monitor
│   ├── health.ts       # fetch + parse one endpoint, with timeout
│   ├── types.ts        # HealthResponse type mirroring the endpoint schema
│   └── style.css       # status pills, layout
├── package.json
├── tsconfig.json
├── vite.config.ts
└── firebase.json       # only if deploying to Firebase Hosting
```

## Implementation

### `src/types.ts`
Mirror the endpoint schema exactly:
```ts
export type CheckStatus = 'healthy' | 'degraded' | 'unhealthy';
export interface Check {
  name: string;
  status: CheckStatus;
  latencyMs: number;
  critical: boolean;
  error?: string;
}
export interface HealthResponse {
  status: CheckStatus;
  service: string;
  version: string;
  timestamp: string;
  checks: Check[];
}
```

### `src/services.ts`
Hardcoded array. Adding a product = one line + redeploy.
```ts
export interface Service {
  id: string;            // used as DOM key
  name: string;          // display name, e.g. "Wordforge"
  url: string;           // health endpoint
}
export const SERVICES: Service[] = [
  {
    id: 'wordforge',
    name: 'Wordforge',
    url: 'https://us-central1-wordsmith-vocabulary-builder.cloudfunctions.net/healthCheck',
  },
];
```

### `src/health.ts`
- `fetchHealth(service)` — `fetch()` with `AbortController` timeout (default 8s)
- Returns a discriminated union: `{ ok: true, data: HealthResponse, fetchedAt: Date }` or `{ ok: false, error: string, fetchedAt: Date }`
- Treats HTTP 503 as a valid response (parse the body — the endpoint returns 503 when `unhealthy`), only network/timeout errors become `ok: false`

### `src/main.ts`
- On load: render one card per service in `SERVICES` (initial "loading" state)
- Poll loop: every **30s**, `Promise.allSettled(SERVICES.map(fetchHealth))`, then re-render
- Pause polling when `document.hidden` (Page Visibility API), resume on visibility change — avoids hammering endpoints while the tab is backgrounded
- Manual "Refresh" button forces an immediate poll
- Show "last updated Xs ago" per card

### `index.html` + `src/style.css`
- Grid of service cards, one per SaaS
- Each card: service name + version, top-level status pill (green/amber/red for `healthy`/`degraded`/`unhealthy`), list of `checks[]` with per-check pill and latency
- Failed checks show the `error` string in a muted color
- Dark mode via `prefers-color-scheme`

## Scaffolding

- `pnpm create vite@latest . --template vanilla-ts` in the empty `health-check/` dir
- `pnpm install`

## Verification

1. `pnpm install && pnpm dev` — dev server on `http://localhost:5173`
2. Open in browser — wordforge card should render, poll once, show all four checks (firestore, firebase-auth, stripe, openai) as healthy pills with latencies
3. Wait 30s in a foreground tab — card should refresh (watch the "last updated" tick reset)
4. Switch to a different tab for a minute, come back — polling should have paused (no extra network requests in DevTools while backgrounded) and resume on focus
5. Temporarily point `services.ts` at a bad URL (e.g. append `/nope`) — card should render an error state instead of crashing
6. `pnpm build && pnpm preview` — production build should also work
7. Deploy: `pnpm dlx firebase-tools init hosting` (public dir = `dist`), then `pnpm dlx firebase-tools deploy --only hosting`

## Adding another SaaS later

1. Append a new entry to `SERVICES` in `src/services.ts`
2. `pnpm build && pnpm dlx firebase-tools deploy --only hosting`

No other code changes needed as long as the new service returns the same response schema.
