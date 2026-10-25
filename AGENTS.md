# NotaLah

Peer-to-peer academic note platform (Lim Qi Cai's APU final-year project, SDG 4): a vertical feed ranked by a
deterministic heuristic (engagement, recency, lecturer validation, hashtag relevance), subject search, a slide-note
editor and note-anchored messaging. This file is the source of truth for every AI tool; tool-specific files only add
to it. Folders below have their own `AGENTS.md`, read when you work there.

## Rules
- **Scope** is the Investigation Report's FR list (`../FYP_Resources/IR/Mine/*_IR.md` §3.3.3). Cutting or shrinking an
  FR needs a technical reason and the user's agreement; additions must serve the four objectives and get an ADR.
- **Stack is fixed**: React + Vite + TypeScript + Tailwind · Node + Express · PostgreSQL · Socket.io · JWT (httpOnly
  cookie) + Passport · versioned migrations. Toolchain Vite+ (`vp`) with pnpm. Changing it means rewriting the report.
- **AI**: the feed ranking stays a heuristic with no ML. AI only as the approved optional aids (editor assistant,
  photo import, dictation), never beyond a provider's free tier.
- **Local first**: `vp run dev` against Docker Postgres is what the demo and submission use. Live deployment is
  optional (ADR D82); deploy changes must never change local behaviour or add a required local env value.
- **Ask the user before**: scope changes, paid services, new keys, deleting user files, repo settings.
- **Never read or print `.env`** (real keys). Check a key with `grep -c '^KEY=' .env`; edit one line with `sed -i`.

## Commands (use `vp`, never npm or npx)
- `vp install` · `vp run db:up` · `vp run server#db:migrate` · `vp run dev` (API :4000, client :5173)
- `vp run check` (format, lint, types) · `vp run -r test` · `vp run -r build` · server tests: `vp run server#test`
- More in `README.md`. The pre-commit hook runs `vp check --fix` on staged files.

## Layout
`client/` React app · `server/` API · `shared/` zod deck schema (`@notalah/shared`) · `docs/` design, ADRs, tests,
report sources · `.claude/` Claude Code agents and skills. Features live in `<pkg>/src/features/<feature>/`.
Map: `docs/ARCHITECTURE.md`; doc index: `docs/README.md`.

## Code rules
- SQL: tables UPPERCASE `_T`, always double-quoted (`"POST_T"`); columns lowercase with a table prefix; keywords
  UPPERCASE; parameterised `pg` only, no ORM; SQL only in `repository.ts`.
- Schema changes only through a new dbmate migration; never edit an applied one.
- Ranking weights and constants only in `server/src/features/ranking/config.ts` (NFR5).
- Tests are named with their TC ID from `docs/chapter4/4.5_test_cases.md`.
- Lean code: the smallest change that fully solves the task; no speculative options or abstractions.

## Git
- Work comes from GitHub issues. One issue, one branch `<type>/<issue#>-<slug>` (`feat`, `fix`, `chore`, `docs`),
  one PR whose body says `Closes #<issue>`. Never commit to `main`.
- Merge `origin/main` into your branch and resolve conflicts before opening or merging a PR; merge only on green CI.
- Short commit subjects (< ~60 chars), a body with what and why, no AI attribution lines.
- Decisions: one file per decision in `docs/adr/` (from 0084; `docs/DECISIONS.md` holds D1-D83).

## Where things live
| Need | Go to |
|---|---|
| Current state, user steps, next issues | `docs/HANDOVER.md` |
| Milestones and dates | `docs/PLAN.md`; work items are GitHub issues |
| Decisions | `docs/adr/`, `docs/DECISIONS.md` (history) |
| Open questions for the user | `docs/OPEN_QUESTIONS.md` |
| Report drafts (Markdown) and the dissertation | `../FYP_Submissions/` (own git repo) |
| IR, templates, senior samples | `../FYP_Resources/` |
