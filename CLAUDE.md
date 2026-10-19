# NotaLah code (FYP_Project)

pnpm workspaces run through Vite+ (`vp`): `client/` (React 19, Tailwind v4, shadcn/ui), `server/` (Express 5 ESM, pg,
zod, Socket.io) and `shared/` (`@notalah/shared`, the zod deck schema; built by `vp pack`). Postgres 17 in Docker on
port 5433 (`notalah`, `notalah_test`); config in the root `.env`.

## Commands
Use `vp`, never npm/npx. Tasks are cached; server tests never are.
- `vp install` · `vp run db:up` · `vp run server#db:migrate` · `vp run dev` (API :4000, client :5173)
- `vp run check` (format, lint, types) · `vp run -r test` · `vp run -r build`
- Full list and operations: `README.md`. The pre-commit hook runs `vp check --fix` on staged files.

## Layout
`server/src/features/<feature>/` and `client/src/features/<feature>/` per feature; SQL only in `repository.ts`;
migrations in `server/db/migrations/`; tests mirror features. Map: `docs/ARCHITECTURE.md`.

## Rules
- Tables UPPERCASE `_T`, always double-quoted (`"POST_T"`); columns lowercase with a table prefix; SQL keywords
  UPPERCASE; parameterised `pg` only, no ORM.
- Schema changes only through a new dbmate migration (`-- migrate:up` / `-- migrate:down`); never edit an applied one.
- Ranking weights and constants only in `server/src/features/ranking/config.ts` (NFR5).
- Test names start with their TC ID from `docs/chapter4/4.5_test_cases.md`.
- Never commit to `main`: branch, PR, merge when CI is green. Short subjects, no AI attribution lines.

## When you are
- Changing UI: read `client/DESIGN.md` first (tokens, components; no raw colours).
- Making a decision the user hasn't: stop and ask; log agreed ones in `docs/DECISIONS.md`.
- Picking up work: `docs/HANDOVER.md`.
