---
name: ship-feature
description: Takes one NotaLah GitHub issue from branch to merged PR - worktree with a private test DB, builder agent, reviewer (plus security-reviewer when needed), fixes, tester, PR that closes the issue, merge when CI is green - then ADR, test-case rows and docs/PLAN.md milestone. Use when the orchestrator starts building an issue whose spec is agreed.
---

# Ship an issue

Run from the repo root. The issue must hold an agreed spec (from `/to-spec` and `/to-tickets`, or written with the
user); if not, grill the user first (`mattpocock-skills:grilling`).

## 1. Branch and worktree
- Branch `<type>/<issue#>-<slug>` (`feat`, `fix`, `chore`, `docs`), from an up-to-date `main`:
  `git fetch origin && git worktree add ../worktrees/<short> -b <branch> origin/main`.
- Copy `.env` into the worktree and point both `DATABASE_URL` and `TEST_DATABASE_URL` at `notalah_test_<short>`
  with `sed -i`; create it: `docker exec fyp_project-db-1 createdb -U notalah notalah_test_<short>`; run `vp install`.
  Never read or print `.env`; the dev DB `notalah` is never touched.
- Own ports per live worktree (API 4100+, client 5100+). At most 3 worktrees, never two builders on the same files.

## 2. Build
One builder per issue, given the issue body, branch, worktree, ports and test DB:
- `implementer` (server and logic; `model: opus` for ranking, auth, real-time), `frontend` (UI).
- The builder names the next free ADR number (`docs/adr/`) and TC IDs; if two branches run at once, the orchestrator
  reserves numbers for each up front.

## 3. Review
- `reviewer` on the branch. Add `security-reviewer` when the diff touches auth, cookies, sessions, sharing, uploads,
  the proxy, CI secrets or Docker.
- Blockers and should-fix items go back to the same builder (SendMessage), then re-review only the fix.

## 4. Test
`tester` in the worktree: `vp run check`, `vp run -r test`, `vp run -r build`, plus the E2E suite for user flows. UI
issues: browser pass at 1440 and 375 px, light and dark.

## 5. PR and merge
- Merge `origin/main` into the branch right before opening the PR; resolve conflicts there, never on `main`.
- `gh pr create`: short title, body with what and why, tests, ADR number, `Closes #<issue>`. No AI attribution lines.
- Merge only when CI is green on the PR, it is mergeable, the reviewers have no open blockers, and the user has
  approved merges for this session (autopilot rules count as approval).

## 6. Close out
- Remove the worktree, drop `notalah_test_<short>`, delete the local branch.
- `docs/PLAN.md` milestone line if the issue closes one. Tell the user any step they must do, with the exact command.
