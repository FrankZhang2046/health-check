# 02 — Deploy to Vercel

## Context

`health-check` is a personal Vite + TypeScript static SPA that renders the health of `https://us-central1-wordsmith-vocabulary-builder.cloudfunctions.net/healthCheck`. It currently only runs locally via `pnpm dev`. Goal: put it on a URL Frank can hit from anywhere, with auto-deploys on push.

Decisions already made in the conversation preceding this plan:
- Platform: **Vercel** (over Firebase Hosting / Netlify). No lock-in to Firebase since the function is a public HTTPS endpoint.
- No custom domain — the `*.vercel.app` subdomain is fine.
- **Git workflow is required** — deploys happen on `git push`, not from a local CLI upload.
- Direct cross-origin `fetch` to the function is fine; no proxy/rewrite needed. (The function already works from `vite dev`, so CORS is presumably handled.)

## Approach

Initialize git, push to a new private GitHub repo, connect the repo to Vercel, let Vercel auto-detect Vite and deploy. No `vercel.json` needed — Vite is a first-class framework preset.

## Steps

1. **Initialize git and make the first commit**
   - `cd /Users/frankzhang/Documents/Coding/health-check`
   - Verify `.gitignore` covers `node_modules/` and `dist/` (it already does — confirmed at `.gitignore`).
   - `git init`
   - `git add .` then `git commit -m "Initial commit"`.

2. **Create a private GitHub repo and push**
   - Prefer `gh repo create health-check --private --source=. --push` (requires `gh` logged in). Falls back to creating the repo in the GitHub UI and `git remote add origin ... && git push -u origin main` if `gh` isn't available.

3. **Connect the repo to Vercel**
   - At https://vercel.com/new, import the `health-check` repo.
   - Vercel auto-detects **Vite**. Confirm the detected settings match:
     - Framework preset: `Vite`
     - Build command: `pnpm build` (repo has a `build` script that runs `tsc && vite build` — see `package.json:8`)
     - Output directory: `dist`
     - Install command: `pnpm install` (Vercel detects pnpm from `pnpm-lock.yaml`)
   - No env vars needed — the function URL is hard-coded in `src/services.ts:11`.
   - Click Deploy.

4. **Confirm auto-deploys**
   - After the first deploy, any `git push` to the default branch triggers a production deploy. PRs get preview URLs automatically. No further config needed.

## Files touched

- **New:** `.git/` (via `git init`)
- **No config files added** — `vercel.json` is not needed for this Vite preset.
- `package.json`, `src/`, `index.html`, `tsconfig.json`, `.gitignore` — unchanged.

## Verification

1. Vercel build log shows `tsc && vite build` succeeding and `dist/` uploaded.
2. Open the assigned `https://health-check-<hash>.vercel.app` URL.
3. Confirm the dashboard renders:
   - Header shows "Service Health" and a status rollup (not stuck on "Loading…").
   - The Wordforge card appears and shows a health result (either healthy JSON or a 503 payload — both are expected outcomes, per `src/health.ts:16`).
   - "↻ Refresh" re-fetches; the timestamp updates.
   - "☀ Light" toggles the theme.
4. Open devtools → Network: the request to `us-central1-wordsmith-vocabulary-builder.cloudfunctions.net/healthCheck` succeeds (200 or 503 with JSON body). If it fails with a CORS error, we'll need to either add CORS to the function or fall back to a Vercel rewrite — but this is not expected since the fetch works locally today.
5. Make a trivial commit (e.g., README tweak), push, confirm Vercel kicks off a new deploy automatically.

## Out of scope

- Custom domain (Frank confirmed not needed).
- Function-URL proxy / hiding the endpoint (Frank confirmed direct fetch is fine).
- Monitoring/uptime alerts on the dashboard itself.
