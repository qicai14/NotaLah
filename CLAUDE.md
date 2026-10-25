@AGENTS.md

## Claude Code: how work runs
Sessions open in this folder. The main session orchestrates: it plans with the user, writes specs, reviews and
decides; subagents in `.claude/agents/` do the work. Spawn the cheapest agent that can do the job.

| Agent | Model | For |
|---|---|---|
| `Explore` | haiku | read-only search of the repo and `../` workspace |
| `scribe` | haiku | rewording, status and log edits, issue/PR/commit text |
| `researcher` | haiku | web and library-doc lookups (agent-browser, Context7) |
| `tester` | haiku | check, tests, build, E2E; reports verbatim |
| `implementer` | sonnet (opus for auth, ranking, real-time) | server and logic issues |
| `frontend` | sonnet | UI issues on the design system |
| `reviewer` | sonnet | every PR |
| `security-reviewer` | opus | PRs touching auth, cookies, sharing, uploads, proxy, CI secrets |
| `writer` | sonnet (opus for the final .docx pass) | report drafts in `../FYP_Submissions/drafts/` |

Workflow (mattpocock skills, plugin `mattpocock-skills`):
- New work: align with `/grill-with-docs` or `/grilling`, then `/to-spec` and `/to-tickets` into GitHub issues.
- Build an issue: the `ship-feature` skill. Hard bug: `/diagnosing-bugs`. Unattended: `autopilot`, only when asked.
- Periodically: `/improve-codebase-architecture`; turn accepted candidates into issues.
- Ending a session: the `handover` skill (it runs `/handoff`).

Rules for agents: lean code is enforced on coding agents by the ponytail hook (`PONYTAIL_SUBAGENT_MATCHER` in
`.claude/settings.json`). Diagrams are Mermaid text, never PlantUML.
