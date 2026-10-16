# PARP — Peer-to-peer Academic Resource Platform

React + Vite + Tailwind client, Express 5 + TypeScript server, PostgreSQL 17 (Docker), dbmate migrations.

## Prerequisites
Node 24+, npm 11+, Docker Desktop.

## Setup
```sh
cp .env.example .env        # then set JWT_SECRET to a long random string
npm install
npm run db:up               # Postgres on localhost:5433 (databases parp and parp_test)
npm run db:migrate -w server
npm run dev                 # server :4000, client :5173 (proxies /api)
```
Check: `curl http://localhost:4000/api/health` returns `{"status":"ok","db":"up"}`.

### First administrator
Admins cannot self-register (D6). Set `ADMIN_EMAIL`, `ADMIN_PASSWORD` (12+ chars, upper, lower case
and a digit) and `ADMIN_NAME` in your local `.env` (or the shell), then run
`npm run admin:create -w server`. It creates the admin, or promotes/resets the account with that
email. Clear the password from `.env` afterwards.

## Commands
| Command | Does |
|---|---|
| `npm test` | server tests (migrates `parp_test` first), then client tests |
| `npm test -w client` | client tests only (no database needed) |
| `npm run build` / `npm run typecheck` | both workspaces |
| `npm run lint` | Oxlint over both workspaces (via Vite+) |
| `npm run db:down` | stop Postgres (data kept in the `parp_pgdata` volume) |
| `npm run db:rollback -w server` | undo the last migration |
| `npm run db:status -w server` | list applied migrations |
| `npm run admin:create -w server` | create or reset the admin from `ADMIN_*` env values |


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
`.github/workflows/ci.yml` runs on every push and on pull requests to `main`: `npm ci`, lint, typecheck, `npm test` (against a
`postgres:17-alpine` service with a fresh `parp_test`), `npm run build`, then `npm audit --audit-level=high --omit=dev`.
Open the failing step in the Actions run: typecheck errors show the file and line, test failures show the Vitest diff,
and an audit failure lists the vulnerable package and advisory. Reproduce locally with `npm run db:up` and the same
commands. Newer pushes to a branch cancel its still-running older run.

## Layout (full map in `docs/ARCHITECTURE.md`)
- `client/src/` — `App.tsx` routes; `features/<feature>/` pages and components; `components/`, `lib/`, `types/` shared
- `server/src/` — `app.ts`, `server.ts`; `lib/` (env, pool, health); `features/<feature>/` (auth, users, moderation,
  ranking, notes, feed, search, messaging) each with routes, repository and middleware as needed;
  `scripts/createAdmin.ts`
- `server/db/migrations/` — dbmate SQL migrations
- `server/tests/<feature>/` — Vitest + Supertest, mirroring the features
- `docker/initdb/` — creates `parp_test` on first start
- `docs/` — decisions, architecture, Chapter 4-6 material, testing, screenshots, code snippets, sprint reviews
