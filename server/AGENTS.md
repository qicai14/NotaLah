# server (Express 5 ESM, pg, zod, Socket.io)

- Request flow: `features/auth/middleware.ts` (`requireAuth`, `optionalAuth`, `requireRole`; role and status read from
  the DB every request) → `features/<f>/routes.ts` (zod validation, status codes) → `service.ts` when logic outgrows
  the route → `repository.ts`, the only place with SQL.
- Shared visibility rules are SQL fragments exported from `features/notes/repository.ts` (`VISIBLE`, `READABLE`,
  `NOTE_COLS`, ...); reuse them with their aliases instead of rewriting a check. Details: `../docs/ARCHITECTURE.md`.
- Config comes only from `src/lib/env.ts` (zod-validated); ranking constants only from `features/ranking/config.ts`.
- New tables or columns: a new file in `db/migrations/` (`vp run server#db:migrate`), plus the Chapter 4.3 data
  dictionary in `../docs/chapter4/4.3_database_design.md` in the same PR.
- Tests in `tests/<feature>/` against the real `notalah_test` DB, named with their TC ID; run `vp run server#test`
  (never a bare `vp test` from the repo root: it skips the server test config).
- SQL style: tables UPPERCASE `_T`, always double-quoted (`"POST_T"`); columns lowercase with a table prefix; keywords
  UPPERCASE; parameterised `pg` only, no ORM. Never edit an applied migration.
