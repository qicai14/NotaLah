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

## Commands
| Command | Does |
|---|---|
| `npm test` | server tests (migrates `parp_test` first) |
| `npm run build` / `npm run typecheck` | both workspaces |
| `npm run db:down` | stop Postgres (data kept in the `parp_pgdata` volume) |
| `npm run db:rollback -w server` | undo the last migration |
| `npm run db:status -w server` | list applied migrations |

## Layout
- `client/` — React app (`src/App.tsx` routes)
- `server/src/` — `app.ts`, `server.ts`, `config/` (env, ranking), `db/pool.ts`, `routes/`
- `server/db/migrations/` — dbmate SQL migrations
- `server/tests/` — Vitest + Supertest
- `docker/initdb/` — creates `parp_test` on first start
- `docs/` — decisions, Chapter 4 material
