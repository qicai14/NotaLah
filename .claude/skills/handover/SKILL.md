---
name: handover
description: Closes a NotaLah work session - rewrites docs/HANDOVER.md, updates docs/PLAN.md milestones and the open GitHub issues, records unlogged decisions as ADRs, then runs /handoff for the next session's kickoff. Use when the user is ending or switching sessions, asks for a handover, or context is getting full.
---

# Handover

## 1. Check the real state
`git log --oneline -15`, `gh pr list`, `gh issue list`, `git worktree list`: what merged, what is open, what is half done.

## 2. Update the records (on a `docs/handover-<MMDD>` branch, PR, merge when CI is green)
- `docs/HANDOVER.md` (rewrite, under ~50 lines): date and phase; state of `main` (PRs since the last handover, test
  counts); open branches and PRs and what each needs; **user steps** with exact commands; next issues in order; known
  limits. Link to ADRs and issues, don't repeat them.
- `docs/PLAN.md`: milestone status and the "Where we are" line.
- Each decision the user made this session that isn't recorded: an ADR in `docs/adr/`. Questions only the user can
  answer: `docs/OPEN_QUESTIONS.md`. New or changed work: a GitHub issue (or a comment on the existing one).
- Hand the mechanical edits to `scribe`; keep the judgement (what is true, what is next) in the main session.

## 3. Kickoff
Run `/handoff` (`mattpocock-skills:handoff`) with the next focus as its argument. Copy its output to
`../run-logs/KICKOFF_next_session.md` and make sure it starts: "Continue NotaLah from the <date> handover. Catch up
from files only: docs/HANDOVER.md, docs/PLAN.md, the ADRs since <n>, and the open issues." and ends with: "Ask me before
anything that needs a key, a cost, or a scope change."

Reply with the user steps and the kickoff path.
