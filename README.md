# NotaLah (formerly PARP) — Peer-to-peer Academic Resource Platform

React + Vite + Tailwind client, Express 5 + TypeScript server, PostgreSQL 17 (Docker), dbmate migrations.

## Prerequisites
[Vite+](https://viteplus.dev) (`vp`), Docker Desktop. `vp` provides the pinned Node (`.node-version`) and pnpm
(`packageManager` in `package.json`), so neither needs a separate install.

## Setup
```sh
cp .env.example .env        # then set JWT_SECRET to a long random string
vp install                  # pnpm install, plus the git pre-commit hook
vp run db:up                # Postgres on localhost:5433 (databases notalah and notalah_test)
vp run server#db:migrate
vp run dev                  # builds shared, then shared watch + server :4000 + client :5173 (proxies /api)
```
Check: `curl http://localhost:4000/api/health/db` returns `{"status":"ok","db":"up"}`.

### First administrator
Admins cannot self-register (D6). Set `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+ chars, upper, lower case
and a digit) and `ADMIN_NAME` in your local `.env` (or the shell), then run
`vp run server#admin:create`. It creates the admin, or promotes/resets the account with that
email. Clear the password from `.env` afterwards.

## Commands
Tasks in the `vite.config.ts` files are cached: a rerun with unchanged inputs replays the result. Each one builds
`@notalah/shared` first (also cached). Server tests are never cached, since they depend on the database.

| Command | Does |
|---|---|
| `vp run check` | format check, lint, type-aware lint and type check over the whole repo |
| `vp check --fix` | the same, fixing formatting and autofixable lint |
| `vp run -r test` | server tests (migrate `notalah_test` first) and client tests |
| `vp run client#test` / `vp run server#test` | one side only (client tests need no database) |
| `vp run -r build` | shared and server with `vp pack`, client with `vp build` |
| `vp run server#start` | run the built server (`node dist/server.js`) |
| `vp run db:down` | stop Postgres (data kept in the `notalah_pgdata` volume) |
| `vp run server#db:rollback` | undo the last migration |
| `vp run server#db:status` | list applied migrations |
| `vp run server#admin:create` | create or reset the admin from `ADMIN_*` env values |
| `vp run server#db:purge` | run the daily purge now (old interactions, feed snapshots, ended rate-limit windows, old notifications, unlinked assets) |

The pre-commit hook runs `vp check --fix` on staged JS/TS files; commits touching only docs skip it.


### Client tests
Vitest in `client/`, named `*.test.ts(x)` beside the code, each name starting with its `CLI-TC` ID. They mock `fetch`, so no
server or database is needed. Files that render components start with `// @vitest-environment jsdom` and use React Testing
Library; the rest stay in the faster node environment. Tests check behaviour (text, roles, redirects), not markup, so they
survive restyling.

## Operations
- Logs are one JSON line per event on stdout (pino); silent under `NODE_ENV=test`. Each request logs method, path, status,
  duration and user id (when signed in); set-cookie and password fields are redacted and headers are never logged. `GET /api/health` is not logged.
- Every response has an `X-Request-Id` header. A short `[A-Za-z0-9._-]` id sent by the caller is reused, otherwise a UUID is made.
- `SENTRY_DSN` (optional) turns on Sentry for 5xx errors, tagged with the request id; the request (URL, headers, cookies, body) is stripped.
  Without it nothing is loaded and no network calls are made. `VITE_SENTRY_DSN` (optional, at client build time) does
  the same for browser errors, with no user, cookie, header or body data.
- `GET /api/health` is the liveness check: `{ status }` without touching Postgres, so health polls let Neon sleep (D81).
  `GET /api/health/db` is the readiness check: `{ status, db }`, 503 when Postgres is unreachable, and behind
  `PROXY_SECRET` in production.
- API responses are gzip-compressed when the caller accepts it; ranged file streams (images, video) are sent as they are.
- On SIGTERM/SIGINT the server stops accepting connections, waits up to 10 s for in-flight requests, closes the pool and exits 0;
  a second signal or the timeout exits 1.

## CI
`.github/workflows/ci.yml` runs on every push and on pull requests to `main`: `setup-vp`, `vp install`, `vp run --no-cache check`,
`vp run -r test` (against a `postgres:17-alpine` service with a fresh `notalah_test`), `vp run -r build`, then
`pnpm audit --prod --audit-level high`. The Vite Task cache is restored after install and saved after a green run.
Open the failing step in the Actions run: typecheck errors show the file and line, test failures show the Vitest diff,
and an audit failure lists the vulnerable package and advisory. Reproduce locally with `vp run db:up` and the same
commands. Newer pushes to a branch cancel its still-running older run. The audit blocks on any high or critical advisory
in production dependencies; dev-only tools are not shipped and are not audited.

`.github/workflows/deploy.yml` deploys after a green CI run on `main` (see Deploy notes); `purge.yml` runs the daily purge.

## Run locally (unchanged by the deploy files)
`vp run db:up`, `vp run server#db:migrate`, `vp run dev`, the tests and CI work exactly as before and need no new
variable. The client calls `/api` and `/socket.io` on its own origin, which the Vite dev server proxies to `:4000`.
`Dockerfile`, `render.yaml`, `client/functions/`, `client/public/_routes.json` and `.github/workflows/deploy.yml` are
used only by the live deploy; `_routes.json` is copied into `client/dist` but nothing reads it locally.

## Deploy notes
Target (D74, D77): one free origin. The client and a Pages Function proxy run on Cloudflare Pages at
`https://<project>.pages.dev`; the Function forwards `/api/*` and `/socket.io/*` (WebSockets included) to the API, a
Docker web service on Render's free plan. The database is on Neon and uploads on R2. The browser only ever sees the
`pages.dev` origin, so the login cookie is first-party and no domain is needed. Nothing here needs a paid plan.

`.github/workflows/deploy.yml` runs after CI passes on a push to `main` (or by hand from the Actions tab, on `main`
only): it migrates Neon, calls the Render deploy hook for the tested commit (`&ref=<sha>`), waits up to 15 minutes until
`<API_ORIGIN>/api/health` reports that commit as `version`, then builds the client and runs `wrangler pages deploy`
from `client/` (which also bundles `client/functions/`). Each step skips with a notice until its secret exists, so the
workflow stays green before the accounts are set up. The API is never deployed without the migration step, and the
client is not deployed when an API deploy is configured but did not run.

The Function adds a shared `PROXY_SECRET` as `X-Proxy-Secret`. In production the API refuses (403) every request and
Socket.io handshake without it, except `GET /api/health` for Render's health check, so nobody can call the public
`onrender.com` URL directly and forge `X-Forwarded-For` past the per-IP limits. Unset locally, so nothing changes in
development.

### One-time account setup (in this order)
1. **Neon** (free plan): create a project in AWS Singapore. Copy two connection strings with `sslmode=require`: the
   pooled one (host contains `-pooler`) for Render's `DATABASE_URL`, and the direct one for GitHub's
   `PROD_DATABASE_URL` (migrations and the daily purge).
2. **R2**: the bucket and bucket-scoped token from D60, with the R34 usage caps left at their defaults.
3. **Render** (free web service): New, Blueprint, pick this repository. It reads `render.yaml` (one free Docker
   service in Singapore, auto-deploy off, health check `/api/health`, `NODE_ENV=production`, `TRUST_PROXY=2`,
   `COOKIE_SECURE=true`, `STORAGE_DRIVER=r2`, `VIDEO_PROFILE=free`, `BCRYPT_ROUNDS=10`,
   `AUTH_ATTEMPTS_PER_MINUTE=20` for the 0.1 CPU, D81) and asks for the `sync: false` values:

   | Variable | Value |
   |---|---|
   | `PROXY_SECRET` | a long random string (at least 16 characters; guarded: required in production), the same value as the Pages secret below |
   | `CLIENT_ORIGIN` | `https://<project>.pages.dev` (guarded: must be https; also the Socket.io origin check and share links) |
   | `DATABASE_URL` | Neon pooled connection string |
   | `JWT_SECRET` | a long random string, never reused from development |
   | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | the R2 values |
   | `SENTRY_DSN`, `UNSPLASH_ACCESS_KEY`, `JAMENDO_CLIENT_ID` | optional; leave empty to turn each off |

   Add `DEBUG_PROXY=1` for the first deploy only (see the proxy check below). Optional tuning (`MAX_SESSION_HOURS`,
   `USAGE_CAP_*`, `PG_*`, `VIDEO_*`) is as in the example env file. Leave `PORT` unset; Render provides it. Then, under
   the service's Settings, copy the **Deploy Hook** URL. Note the service URL (`https://<service>.onrender.com`).
4. **Cloudflare Pages**:
   - Stay on the **Workers Free** plan (Workers & Pages, Plans). Never subscribe to Workers Paid: Free answers error
     1027 past 100,000 Function requests a day instead of billing.
   - Create the Pages project as Direct Upload, named `notalah` (or set the GitHub variable below), for example with
     `vp dlx wrangler@4.151.1 pages project create notalah --production-branch main` after `wrangler login`.
   - Project Settings, Variables and Secrets, Production: `API_ORIGIN` = the Render service URL (plain text) and
     `PROXY_SECRET` = the Render value (type Secret). Without either the Function answers 502
     `{"error":"API proxy is not configured"}` (fails closed); when Render cannot be reached it answers 502
     `{"error":"API unreachable"}`.
   - Project Settings (the Runtime or Functions section): set the Functions request limit failure mode to
     **Fail closed**, so the proxy never falls through to static pages.
   - Account, Notifications: add a **usage-based billing** notification at the lowest threshold as a second line of
     defence.
   - Create an API token with the **Cloudflare Pages: Edit** permission, and note the account id.
5. **GitHub** repository, Settings, Secrets and variables, Actions:
   - Secrets: `PROD_DATABASE_URL`, `RENDER_DEPLOY_HOOK_URL`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and the
     four `R2_*` values (the daily purge also deletes unlinked R2 files).
   - Variables: `API_ORIGIN` = the Render service URL (required for the API deploy; the workflow polls its
     `/api/health`). Optional: `CLOUDFLARE_PAGES_PROJECT` (default `notalah`); `VITE_SENTRY_DSN` turns on client error
     reporting (a browser DSN is public by design; empty keeps it off). Sentry on both sides replaces share-link tokens
     with `/share/:token` before anything is sent.
   - `PROXY_SECRET` lives only on Render and Pages; GitHub never needs it.
6. Run the **Deploy** workflow by hand once (Actions, Deploy, Run workflow). An environment change on Pages or Render
   takes effect on the next deploy, so re-run it after changing one.
7. **UptimeRobot** (free): an HTTP(s) monitor on `https://<project>.pages.dev/api/health` every 5 minutes keeps the
   free instance awake for UAT and the demo (R27) and checks the whole path through the proxy. That is 288 Function
   requests a day of the 100,000. One always-awake instance uses about 744 of Render's 750 free hours in a 31-day
   month, so run only this one free service, and check Render's current free-tier terms before turning the monitor on.

### First-deploy proxy check (D65, D74)
With `DEBUG_PROXY=1` set on Render, open `https://<project>.pages.dev/api/health` in a browser and find the
`proxy check` line in the Render logs. `ip` must be your own public address (compare the `ip=` line of
`https://www.cloudflare.com/cdn-cgi/trace`); if it is a Cloudflare or Render address, `TRUST_PROXY` is wrong. The
Function overwrites `X-Forwarded-For` with `CF-Connecting-IP`, and Render appends the Function's address, so two hops
are trusted. Then delete `DEBUG_PROXY` and redeploy.

### Running and operating the live API
- The image (`Dockerfile`, three stages): the pinned `ghcr.io/voidzero-dev/vite-plus` image builds `@notalah/shared`
  and the server, a fresh `vp install --frozen-lockfile --prod` stage keeps dev dependencies out, and a pinned
  `debian:trixie-slim` runtime gets the exact Node from `.node-version` plus `ffmpeg`/`ffprobe` for the video worker.
  It runs as `nobody` with `NODE_ENV=production` and a Docker health check on `/api/health`. Build it locally with
  `docker build -t notalah-api .` (no env file is copied into it).
- Production guards: the server refuses to start when `STORAGE_DRIVER` is `local`, `CLIENT_ORIGIN` is not https,
  `COOKIE_SECURE` is not true, `TRUST_PROXY` is `loopback` or `0`, or `PROXY_SECRET` is missing, naming the variable.
- `GET /api/health` and `/api/health/db` include `version` (Render's `RENDER_GIT_COMMIT`) on Render; locally the field
  is absent. Check the database through the proxy with `https://<project>.pages.dev/api/health/db`.
- Migrations run in the Deploy workflow before Render deploys, so new code never meets an old schema. By hand:
  `vp run server#db:migrate` with `DATABASE_URL` pointing at Neon.
- The free instance sleeps after 15 idle minutes (about a minute to wake), so the daily purge runs from
  `.github/workflows/purge.yml` (03:30 MYT, or Run workflow by hand) with `PROD_DATABASE_URL` and the four `R2_*`
  secrets; without `PROD_DATABASE_URL` it skips with a notice. The server's in-process timer is a best-effort fallback.
- Video uploads return 202 at once and are converted by the worker (D67). A job held by an instance that slept or
  restarted is picked up again within two minutes. Scale-up path: a paid instance with `VIDEO_PROFILE=standard`, then
  a separate worker service (`VIDEO_WORKER_IN_PROCESS=false` on the API), then a managed video service behind the same
  job table if volume demands it.
- On redeploy Render sends SIGTERM: the server stops the video worker, closes Socket.io and the HTTP server, closes the
  pool and exits 0 (10 s limit).

## Layout (full map in `docs/ARCHITECTURE.md`)
- `client/src/` — `App.tsx` routes; `features/<feature>/` pages and components; `components/`, `lib/`, `types/` shared
- `server/src/` — `app.ts`, `server.ts`; `lib/` (env, pool, health); `features/<feature>/` (auth, users, moderation,
  ranking, notes, feed, search, messaging) each with routes, repository and middleware as needed;
  `scripts/createAdmin.ts`
- `server/db/migrations/` — dbmate SQL migrations
- `server/tests/<feature>/` — Vitest + Supertest, mirroring the features
- `docker/initdb/` — creates `notalah_test` on first start
- `docs/` — decisions, architecture, Chapter 4-6 material, testing, screenshots, code snippets, sprint reviews
