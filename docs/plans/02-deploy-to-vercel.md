# 02 — Deploy to Vercel

## Context

`health-check` is a personal Vite + TypeScript static SPA that renders the health of `https://us-central1-wordsmith-vocabulary-builder.cloudfunctions.net/healthCheck`. It currently only runs locally via `pnpm dev`. Goal: put it on a URL Frank can hit from anywhere, with auto-deploys on push.

Decisions made in the preceding conversation:
- **Platform:** Vercel (over Firebase Hosting / Netlify). No lock-in to Firebase since the function is a public HTTPS endpoint.
- **CI/CD approach:** Option A — Vercel's built-in Git integration. **No `.github/workflows/*.yml` file, no `VERCEL_TOKEN` secret management.** Vercel runs `pnpm install && pnpm build` in its own build container on every push and PR.
- **No custom domain** — the `*.vercel.app` subdomain is fine.
- **Direct cross-origin `fetch`** to the function is fine; no proxy/rewrite needed. (Works from `vite dev` today, so CORS is presumably handled.)

## Current state (already done)

- Repo is initialized and pushed to `git@github.com:FrankZhang2046/health-check.git`.
- Working tree is clean; `main` is up to date with `origin`.
- `README.md` (including the Health API Formatting section) is committed.
- `.gitignore` correctly excludes `node_modules/` and `dist/`.

## Approach

Connect the existing GitHub repo to Vercel via the dashboard. Vercel auto-detects the Vite preset, runs the build, deploys, and thereafter auto-deploys on every push to `main` and gives a preview URL per PR. No repo changes required.

## Steps

1. **Connect the repo to Vercel.**
   - Go to https://vercel.com/new (log in with GitHub if needed).
   - Grant the Vercel GitHub App access to `FrankZhang2046/health-check` if not already granted.
   - Click **Import** on `health-check`.
   - Confirm the auto-detected settings:
     - Framework preset: **Vite**
     - Build command: `pnpm build` (from `package.json:8` — runs `tsc && vite build`)
     - Output directory: `dist`
     - Install command: `pnpm install` (Vercel picks pnpm up from `pnpm-lock.yaml`)
     - Node version: 20.x (Vercel default is fine)
   - No environment variables to add — the function URL is hard-coded in `src/services.ts:11`.
   - Click **Deploy**.

2. **Verify auto-deploy is on.**
   - In the Vercel project → **Settings → Git**, confirm:
     - Production branch: `main`
     - Deploy hooks on push: enabled (default)
     - PR previews: enabled (default)

## Files touched

None. **No `vercel.json`, no GitHub Actions workflow.** Option A intentionally keeps the repo clean and lets Vercel own the build.

## Verification

1. Vercel build log for the first deploy shows `tsc && vite build` succeeding and `dist/` uploaded.
2. Open the assigned `https://<project>-<hash>.vercel.app` URL. Confirm:
   - Header shows "Service Health" and a status rollup (not stuck on "Loading…").
   - The Wordforge card renders a health result (either healthy JSON or a 503 payload — both are expected per `src/health.ts:16`).
   - **↻ Refresh** re-fetches and the timestamp updates.
   - **☀ Light** toggles the theme.
3. Devtools → Network: the request to `us-central1-wordsmith-vocabulary-builder.cloudfunctions.net/healthCheck` succeeds (200 or 503 with JSON body). If it fails with a CORS error, add CORS headers to the function or fall back to a Vercel rewrite in a follow-up — not expected since the fetch works locally today.
4. Push a trivial commit (e.g., a README typo fix) to `main`. Confirm Vercel automatically kicks off a new production deploy within a few seconds.
5. Open a throwaway PR from a branch. Confirm Vercel comments a preview URL on the PR and the preview loads correctly.

## Out of scope

- GitHub Actions workflow file (Option B/C rejected in favor of Option A).
- Custom domain.
- Function-URL proxy / hiding the endpoint.
- Monitoring/uptime alerts on the dashboard itself.
