# NotaLah

A peer-to-peer academic note platform (an APU final-year project): a vertical feed ranked by a deterministic heuristic,
subject search, a slide-note editor and note-anchored messaging. It runs locally for the demo and submission.

- pnpm monorepo driven by Vite+: use `vp`, never npm or npx (`vp run dev`, `vp run check`, `vp run -r test`,
  `vp run -r build`; server tests only through `vp run server#test`). Postgres runs in Docker (`vp run db:up`).
- Never read or print `.env` (it holds real keys); check a key with `grep -c '^KEY=' .env`.

## Layout
- `client/`: React web app
- `server/`: Express API, Socket.io, Postgres migrations
- `shared/`: deck schema and design data used by both
- `docs/`: design docs, decisions, test cases, report sources
- `../FYP_Submissions/`, `../FYP_Resources/`: the dissertation and the reference material (outside this repo)

## References
- Before adding, cutting or changing a feature, or touching the stack or AI use: [docs/conventions/project-rules.md](docs/conventions/project-rules.md)
- When committing, branching, opening or merging a PR, or recording a decision: [docs/conventions/delivery.md](docs/conventions/delivery.md)
- When writing or running tests: [docs/conventions/testing.md](docs/conventions/testing.md)
- When planning work or delegating to subagents: [docs/conventions/agent-workflow.md](docs/conventions/agent-workflow.md)
- Current state and what's next: [docs/HANDOVER.md](docs/HANDOVER.md); every other doc: [docs/README.md](docs/README.md)

## Agent skills

### Issue tracker

GitHub Issues on `qicai14/NotaLah`, via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context. See `docs/agents/domain.md`.
