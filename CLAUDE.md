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

## Layout (details: `docs/ARCHITECTURE.md`)
- `server/src/{app,server}.ts`; `lib/` (env, pool, health); `types/`; `scripts/createAdmin.ts`.
- `server/src/features/<feature>/` for auth, users, moderation, ranking, notes, feed, search, messaging:
  `routes.ts` -> `middleware.ts` (`requireAuth`, `requireRole(...)`, role/status always read from the DB) ->
  `repository.ts` (the only SQL). Empty features hold a README naming their FRs and sprint.
- `server/tests/<feature>/` mirrors features; `helpers.ts` and `globalSetup.ts` are shared.
- `client/src/features/<feature>/` holds pages and components per feature; shared `components/`, `lib/`, `types/`.
- `server/db/migrations/` dbmate migrations; `docs/` decisions, chapter4-6, testing/{unit,uat}, screenshots,
  code-snippets, sprints.

## Conventions
- Tables are UPPERCASE `_T` and always double-quoted in SQL (`"POST_T"`); columns lowercase with a table prefix.
- SQL keywords UPPERCASE. No ORM; parameterised `pg` queries.
- Schema changes only through new dbmate migration files (`-- migrate:up` / `-- migrate:down`); never edit an applied one.
- Ranking constants live only in `server/src/features/ranking/config.ts` (NFR5).
- Test names start with the TC ID from `docs/chapter4/4.5_test_cases.md` (e.g. `AUTH-TC3: ...`).
- Commit after each working step.
