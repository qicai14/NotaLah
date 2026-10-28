# 0086 - Orchestrator merges; review runs at session level (issue #72, 29 Oct 2026)

- **Context:** ADR 0084 had ship-feature merge its own PR and the builders run `no-comments`. Under the orchestrator
  model one session tracks issues and ticket sessions build them, and subagents cannot spawn subagents.
- **Decision:** ship-feature stops at the open PR and the orchestrator verifies and merges it. `no-comments`,
  `reviewer`, `code-review` and `pr` run in the ticket session, not inside a builder. The tester gets a flake mode
  (`vp run --no-cache -r test` five times). ADR 0084's "Kept: no-comments (builders' comment pass)" now reads "kept,
  run by the session".
- **Alternatives:** keep self-merge (no independent check of CI and scope); keep `no-comments` in builders (it needs a
  subagent, which a builder cannot spawn, so it ran as a second in-context pass).
- **Reversibility:** High; skill and agent text only.
- **Tests:** none; `scripts/check-agents.mjs` covers the agent files.
