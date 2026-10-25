# 0084 - Agentic workflow restructure (user, 25 Oct 2026)

- **Context:** agent config lived in the unversioned `FYP/` workspace, only Claude Code had instructions, backlog status
  was spread across PLAN, HANDOVER and run logs, and every parallel PR conflicted on `DECISIONS.md`.
- **Decision (user):**
  - The repo is the root for all agent config: `.claude/` (agents, project skills, `.env` hook, settings) is versioned
    here and sessions open in `FYP_Project/`; the workspace is reached through `additionalDirectories: [".."]`.
  - `AGENTS.md` (root and nested in `client/`, `server/`, `shared/`, `docs/`) is the source of truth for Claude Code,
    Codex, Copilot and Antigravity; each `CLAUDE.md` imports its `AGENTS.md`; `vp run check` enforces it.
  - Remaining work lives in GitHub issues (mattpocock flow: grill, `/to-spec`, `/to-tickets`); one issue, one branch,
    one PR; `docs/PLAN.md` keeps only milestones and dates.
  - Decisions go to `docs/adr/`, one file each, from 0084; `DECISIONS.md` is frozen at D83.
  - Main session on `opusplan`; subagents on the cheapest model that fits (Haiku: Explore, researcher, tester, scribe;
    Sonnet: implementer, frontend, reviewer, writer; Opus: security-reviewer, and implementer or writer when a task
    needs it). `frontend-designer` retired.
  - Added skills: Playwright, Vercel React and Postgres best practices (skills.sh, pinned in `skills-lock.json`).
    Archived: unslop, best-practices, apple-design, thermo-nuclear review, no-comments.
  - `main` protected by a GitHub ruleset (PR and CI required, no force-push or deletion).
- **Alternatives:** keep config in the workspace (unversioned, invisible to other tools); keep the PLAN table (status
  drift); keep one decision file (merge conflicts); Opus for everything (uses the Pro window fastest).
- **Reversibility:** High: files and settings only; no product code changed.
