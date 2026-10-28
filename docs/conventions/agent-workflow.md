# Agent workflow (solo developer, Claude Pro)

The main session orchestrates: it plans with the user, writes specs, reviews and decides. Subagents in `.claude/agents/`
do the work; spawn the cheapest one that can do the job. Other tools (Codex, Copilot, Antigravity) follow the same
`AGENTS.md` files and these conventions, usually for reviews or one-off checks.

| Agent | Model | For |
|---|---|---|
| `Explore` | haiku | read-only search of the repo and the `../` workspace |
| `scribe` | haiku | rewording, status and log edits, issue, PR and commit text |
| `researcher` | haiku | web and library-doc lookups (agent-browser, Context7) |
| `tester` | haiku | check, tests, build, E2E; reports verbatim |
| `implementer` | sonnet (opus for auth, ranking, real-time) | server and logic issues |
| `frontend` | sonnet | UI issues on the design system |
| `reviewer` | sonnet | every PR |
| `security-reviewer` | opus | PRs touching auth, cookies, sharing, uploads, the proxy or CI secrets |
| `writer` | sonnet (opus for the final .docx pass) | report drafts in `../FYP_Submissions/drafts/` |

Work flow (plugin `mattpocock-skills`; these slash commands are user-invoked only, so ask the user to type them):
- New work: `/grill-with-docs` or `/grilling`, then `/to-spec` and `/to-tickets` into GitHub issues.
- Building an issue: the `ship-feature` skill (a ticket session; it stops at the open PR and the orchestrator merges). A hard bug: `/diagnosing-bugs`. Unattended runs: `autopilot`, only when
  the user asks.
- End of a milestone: `reviewer` with the `thermo-nuclear-code-quality-review` skill on the range, then `/retro`.
- Periodically: `/improve-codebase-architecture`; accepted candidates become issues.
- Ending a session: the `handover` skill (the user types `/handoff` for the kickoff).

Lean code is enforced on coding agents by the ponytail hook (`PONYTAIL_SUBAGENT_MATCHER` in `.claude/settings.json`).
Add a rule to an `AGENTS.md` or a conventions file only after an agent repeats a mistake, and put it in the narrowest
file that covers it.
