# Delivery: branches, commits, PRs, decisions

- Work comes from GitHub issues. One issue, one branch `<type>/<issue#>-<slug>` (`feat`, `fix`, `chore`, `docs`),
  one PR whose body says `Closes #<issue>`. Never commit to `main` (a ruleset enforces PRs and green CI).
- Lean change: the smallest diff that fully solves the issue; no speculative options or abstractions.
- Before opening or merging a PR: merge `origin/main` into the branch, resolve conflicts there, and run
  `vp run check`, `vp run -r test`, `vp run -r build`. Merge only on green CI.
- Commits: subject under ~60 characters, a body with what and why, no AI attribution lines.
- Decisions: one file per decision in [`../adr/`](../adr/README.md) (D1-D83 are in `../DECISIONS.md`, frozen).
- In the same PR: test-case rows for new tests ([testing.md](testing.md)), the Chapter 4.3 data dictionary for schema
  changes, and a Mermaid source update when a documented flow changes.
- Questions only the user can answer go in [`../OPEN_QUESTIONS.md`](../OPEN_QUESTIONS.md).
