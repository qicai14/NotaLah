# NotaLah (formerly PARP) — Peer-to-peer Academic Resource Platform

React + Vite + Tailwind client, Express 5 + TypeScript server, PostgreSQL 17 (Docker), dbmate migrations.

## Prerequisites
[Vite+](https://viteplus.dev) (`vp`), Docker Desktop. `vp` provides the pinned Node (`.node-version`) and pnpm
(`packageManager` in `package.json`), so neither needs a separate install.

## Setup
```sh
cp .env.example .env        # then set JWT_SECRET to a long random string
vp install                  # pnpm install, plus the git pre-commit hook
vp run db:up                # Postgres on localhost:5433 (databases parp and parp_test)
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
`@parp/shared` first (also cached). Server tests are never cached, since they depend on the database.

| Command | Does |
|---|---|
| `vp run check` | format check, lint, type-aware lint and type check over the whole repo |
| `vp check --fix` | the same, fixing formatting and autofixable lint |
| `vp run -r test` | server tests (migrate `parp_test` first) and client tests |
| `vp run client#test` / `vp run server#test` | one side only (client tests need no database) |
| `vp run -r build` | shared and server with `vp pack`, client with `vp build` |
| `vp run server#start` | run the built server (`node dist/server.js`) |
| `vp run db:down` | stop Postgres (data kept in the `parp_pgdata` volume) |
| `vp run server#db:rollback` | undo the last migration |
| `vp run server#db:status` | list applied migrations |
| `vp run server#admin:create` | create or reset the admin from `ADMIN_*` env values |

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
`.github/workflows/ci.yml` runs on every push and on pull requests to `main`: `setup-vp`, `vp install`, `vp run check`,
`vp run -r test` (against a `postgres:17-alpine` service with a fresh `parp_test`), `vp run -r build`, then
`pnpm audit --prod --audit-level high`. The Vite Task cache is restored after install and saved after a green run.
Open the failing step in the Actions run: typecheck errors show the file and line, test failures show the Vitest diff,
and an audit failure lists the vulnerable package and advisory. Reproduce locally with `vp run db:up` and the same
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
