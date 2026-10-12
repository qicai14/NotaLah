# PARP code (FYP_Project)

npm workspaces: `client/` (React, Vite, TS, Tailwind v4) and `server/` (Express 5, TS strict, pg, zod).
Postgres 17 in Docker on host port 5433; databases `parp` and `parp_test`. Config in root `.env`
(copy `.env.example`).

## Commands (from this folder)
- `npm run db:up` / `db:down` — start/stop Postgres
- `npm run db:migrate -w server`, `db:rollback`, `db:status`, `db:migrate:test` — dbmate
- `npm run dev` — server :4000 + client :5173
- `npm test` — server tests (global setup migrates `parp_test`)
- `npm run build`, `npm run typecheck`

## Layout
`server/src/{app,server}.ts`, `config/{env,ranking}.ts`, `db/{pool,users}.ts`, `auth/passport.ts`,
`middleware/auth.ts` (`requireAuth`, `requireRole(...)` — role/status always read from the DB), `routes/`;
tests in `server/tests/`; migrations in `server/db/migrations/`; decisions in `docs/DECISIONS.md`.

## Conventions
- Tables are UPPERCASE `_T` and always double-quoted in SQL (`"POST_T"`); columns lowercase with a table prefix.
- SQL keywords UPPERCASE. No ORM; parameterised `pg` queries.
- Schema changes only through new dbmate migration files (`-- migrate:up` / `-- migrate:down`); never edit an applied one.
- Ranking constants live only in `server/src/config/ranking.ts` (NFR5).
- Test names start with the TC ID from `docs/chapter4/4.5_test_cases.md` (e.g. `AUTH-TC3: ...`).
- Commit after each working step.
