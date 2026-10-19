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
Check: `curl http://localhost:4000/api/health` returns `{"status":"ok","db":"up"}`.

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
  Without it nothing is loaded and no network calls are made.
- `GET /api/health` returns `{ status, db }` and 503 when Postgres is unreachable (use it as the readiness check).
- On SIGTERM/SIGINT the server stops accepting connections, waits up to 10 s for in-flight requests, closes the pool and exits 0;
  a second signal or the timeout exits 1.

## CI
`.github/workflows/ci.yml` runs on every push and on pull requests to `main`: `setup-vp`, `vp install`, `vp run --no-cache check`,
`vp run -r test` (against a `postgres:17-alpine` service with a fresh `notalah_test`), `vp run -r build`, then
`pnpm audit --prod --audit-level high`. The Vite Task cache is restored after install and saved after a green run.
Open the failing step in the Actions run: typecheck errors show the file and line, test failures show the Vitest diff,
and an audit failure lists the vulnerable package and advisory. Reproduce locally with `vp run db:up` and the same
commands. Newer pushes to a branch cancel its still-running older run.

## Deploy notes
Target (D65): client on Cloudflare Pages at `app.<domain>`, API on one Render free web service at `api.<domain>`, Neon
Postgres, R2 uploads. A custom domain is required: `pages.dev` and `onrender.com` are public suffixes, so the login cookie
would not travel between them.

API environment on Render (the server refuses to start in production when a guarded value is wrong, naming the variable):

| Variable | Production value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the Neon connection string (`sslmode=require`) |
| `JWT_SECRET` | a long random string, never reused from development |
| `CLIENT_ORIGIN` | `https://app.<domain>` (guarded: must be https) |
| `COOKIE_SECURE` | `true` (guarded) |
| `TRUST_PROXY` | `1`, Render's one proxy hop, with `api.<domain>` DNS-only (grey cloud) in Cloudflare; `2` if it is proxied (orange cloud). Guarded: `loopback` and `0` refused; never `true` |
| `STORAGE_DRIVER` | `r2` (guarded: the disk is wiped on restart), with `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` |
| `NODE_VERSION` | `24` (the repo needs Node 24) |
| `MAX_SESSION_HOURS` | optional; default `12`, the longest a login is renewed |
| `DEBUG_PROXY` | `1` for the first deploy only, see below |
| `PORT` | leave unset; Render provides it |
| `VIDEO_PROFILE` | `free` on the free instance: compatible H.264 MP4 is stream-copied, anything else re-encoded to at most 720p, one job at a time; `standard` on a paid instance (1080p) (D67) |
| `VIDEO_CONCURRENCY` | jobs a worker runs at once under `standard` (default 2, 1-8); `free` always runs 1 |
| `VIDEO_WORKER_IN_PROCESS` | `true` (default): the API runs the video worker itself. Set `false` once a separate Render background worker runs `vp run server#worker` with the same environment |
| `SENTRY_DSN`, `UNSPLASH_ACCESS_KEY`, `USAGE_CAP_*`, `PG_*` | optional, as in `.env.example` |

Client build on Cloudflare Pages: `VITE_API_URL=https://api.<domain>`.

Render service settings (there is no global `vp` on Render; the repo's own copy runs through pnpm):
- Build command: `corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm exec vp run server#build`
  (`--prod=false` because `NODE_ENV=production` would otherwise skip the dev dependencies the build needs).
- Start command: `pnpm --filter server start`.

First-deploy proxy check: deploy with `DEBUG_PROXY=1`, open `https://api.<domain>/api/health` in a browser and find the
`proxy check` log line. `ip` must be your own public address; if it is a Render or Cloudflare address, the hop count is
wrong. Then remove `DEBUG_PROXY`.

The service starts with `vp run server#start` and uses `GET /api/health` as its health check. Apply new migrations to
Neon with `vp run server#db:migrate` (with `DATABASE_URL` pointing at Neon) before deploying code that needs them. The free instance sleeps after 15 idle minutes (about a minute to wake), so the daily purge runs from
`.github/workflows/purge.yml` (03:30 MYT, or Run workflow by hand). It needs repository secrets `PROD_DATABASE_URL` and the
four `R2_*` values (unlinked assets are deleted from R2 too); without `PROD_DATABASE_URL` it skips with a notice. The
server's in-process daily timer remains as a best-effort fallback.

Video uploads return 202 at once and are converted by the worker (D67); the server and any worker need `ffmpeg` and
`ffprobe` on the PATH. A job held by an instance that slept or restarted is picked up again within two minutes.
Scale-up path: a paid instance with `VIDEO_PROFILE=standard`, then a separate worker service
(`VIDEO_WORKER_IN_PROCESS=false` on the API), then a managed video service behind the same job table if volume demands it.

## Layout (full map in `docs/ARCHITECTURE.md`)
- `client/src/` — `App.tsx` routes; `features/<feature>/` pages and components; `components/`, `lib/`, `types/` shared
- `server/src/` — `app.ts`, `server.ts`; `lib/` (env, pool, health); `features/<feature>/` (auth, users, moderation,
  ranking, notes, feed, search, messaging) each with routes, repository and middleware as needed;
  `scripts/createAdmin.ts`
- `server/db/migrations/` — dbmate SQL migrations
- `server/tests/<feature>/` — Vitest + Supertest, mirroring the features
- `docker/initdb/` — creates `notalah_test` on first start
- `docs/` — decisions, architecture, Chapter 4-6 material, testing, screenshots, code snippets, sprint reviews
