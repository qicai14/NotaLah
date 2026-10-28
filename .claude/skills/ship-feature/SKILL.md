---
name: ship-feature
description: Takes one NotaLah GitHub issue from branch to open PR - worktree with a private test DB, builder agent, session-level no-comments, reviewer (plus security-reviewer when needed) and code-review, fixes, tester with a flake check, PR that closes the issue (ADR, test-case rows and docs/PLAN.md milestone in the same PR) - then stops; the orchestrator merges. Use when the orchestrator starts a ticket session for an issue whose spec is agreed.
---

# Ship an issue

Run from the repo root. The issue must hold an agreed spec (from `/to-spec` and `/to-tickets`, or written with the
user); if not, grill the user first (`mattpocock-skills:grilling`). This skill ends at an open PR. Never run
`gh pr merge`: the orchestrator verifies and merges.

## 1. Branch and worktree
- Branch `<type>/<issue#>-<slug>` (`feat`, `fix`, `chore`, `docs`), from an up-to-date `main`:
  `git fetch origin && git worktree add ../worktrees/<short> -b <branch> origin/main`.
- Copy `.env` into the worktree and point both `DATABASE_URL` and `TEST_DATABASE_URL` at `notalah_test_<short>`
  with `sed -i`; create it: `docker exec fyp_project-db-1 createdb -U notalah notalah_test_<short>`; run `vp install`.
  Never read or print `.env`; the dev DB `notalah` is never touched.
- Tests need no ports. The browser pass uses 4000/5173, one worktree at a time. At most 3 worktrees, never two
  builders on the same files.

## 2. Build
One builder per issue, given the issue body, branch, the absolute worktree path (every Bash call starts with
`cd "<path>" &&`, edits use absolute paths inside it) and the test DB:
- `implementer` (server and logic; `model: opus` for ranking, auth, real-time), `frontend` (UI), `scribe` (pure text edits).
- Use `mattpocock-skills:tdd` at the seams in the issue's testing decisions (pre-agreed).
- The builder names the next free ADR number (`docs/adr/`) and TC IDs; if two branches run at once, the orchestrator
  reserves numbers for each up front.

## 3. Review (in this session, not the builder: subagents cannot spawn subagents)
- `no-comments` on the diff, pre-approved: delete, no encodings, report open constraints.
- `reviewer` on the branch for correctness and fit. Add `security-reviewer` when the diff touches auth, cookies,
  sessions, sharing, uploads, the proxy, CI secrets or Docker.
- `mattpocock-skills:code-review` against `origin/main` and the issue (Standards and Spec).
- Blockers and should-fix items go back to the same builder (SendMessage), then re-review only the fix.

## 4. Test
`tester` in the worktree: `vp run check`, `vp run -r build`, then the flake check, `vp run --no-cache -r test` five
times (every run's counts, any failure verbatim), plus the E2E suite for user flows. UI issues: browser pass at 1440
and 375 px, light and dark.

## 5. PR, then stop
- The `docs/PLAN.md` milestone line, ADR, TC rows and any other record `docs/conventions/delivery.md` lists go in this
  PR, never after the merge.
- Merge `origin/main` into the branch right before opening the PR; resolve conflicts there, never on `main`.
- Body from `mattpocock-skills:pr` (Summary / Evidence / Merge Danger), ADR number and `Closes #<issue>`. No AI
  attribution lines. Open the PR and stop.

## 6. Close out (after the orchestrator says it merged)
From the repo root, not the worktree:
```bash
git worktree remove "../worktrees/<short>"
docker exec fyp_project-db-1 dropdb -U notalah notalah_test_<short>
git branch -D <branch>
git push origin --delete <branch>   # only if the remote branch still exists
```
Tell the user any step they must do, with the exact command.
