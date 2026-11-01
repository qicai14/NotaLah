# Sprint 6 (Stabilise) — Review and Retrospective

*Dates: 28 – 29 October 2026 (semester week 6). Run by the first orchestrator session with one ticket session per issue
(ADR 0084, ADR 0086). Reviewed by the student: 1 November 2026. Milestone "Sprint 6: Stabilise" closed with 14 issues.*

## Sprint goal

	Fix the existing work that later tickets build on before Sprint 7 (R28) starts, so the 29 October audit's findings
do not carry downstream: align the agent workflow with the orchestrator model, harden CI, record the AI scope decision,
escape the slide layout HTML that R28 will feed, match the Chapter 4 data dictionary and ERD to the schema, close the
socket and idle-session gaps, deliver the admin Modules page (R5), and measure NFR3 relevance and 10x latency.

## Sprint review

### Increment delivered

| Issue | PR | Item | Evidence |
| --- | --- | --- | --- |
| #69 | #70 | Flaky CLI-TC40 waits for the unblock focus | client suite 168/168, 5/5 runs |
| — | #71 | mattpocock skills set up, `GLOSSARY.md`, `docs/agents/` | Module = course unit, Subject = a post's hashtags |
| #72 | #87 | Workflow aligned: ship-feature stops at the PR, session-level review, tester flake mode | ADR 0086 |
| #74 | #88 | AI additions as overdelivery; R35 and R36 to future work | ADR 0085 |
| #73 | #89 | `pnpm audit` in its own non-blocking CI job; expired release-age excludes removed | `.github/workflows/` |
| #75 | #90 | Every string `layoutSlide` puts into HTML is escaped (R28 prefactor) | `shared/src/design.ts`, security review |
| #76 | #91 | Ch 4.3 data dictionary and ERD match the migrations; schema-drift check in `vp run check` | `scripts/check-schema-docs.mjs` |
| #79 | #92 | Socket cut 10 minutes before token expiry, renewal before reconnect | ADR 0088 |
| #80 | #94 | Admin Modules page (R5) | `docs/screenshots/80/` |
| #93 | #95 | Idle limit for messaging self-renewal | OPEN_QUESTIONS (answered 29 Oct) |
| #96 | #97 | Idle check for the editor lock renewal | security review |
| #98 | #99 | Idle gate and time limit for video status polling | security review |
| #77 | #100 | NFR3 relevance check over a labelled seed | RANK-TC31 to TC34 |
| #101 | #102 | Engagement and relevance re-weighted so NFR3 holds | ADR 0089 |
| #78 | #103 | Search and feed p95 at 10x the load seed | ADR 0090, `docs/testing/load/2026-10-29_latency.md` |

### Test results

	At the end of the sprint `vp run check` and `vp run -r build` passed, and `vp run --no-cache -r test` passed in 5 of
5 runs with no flakes: shared 8, client 188, server 445 passed and 2 skipped (up from client 168 and server 438 at the
25 October handover). Every PR ran the same five-run flake check before merge.

### NFR3 relevance

	On the provisional labelled seed (10 viewers, popular off-topic notes against weakly liked Subject notes) the default
weights put a verified note in every viewer's top 5 (100%) and a Subject note with any validation in 60%, but a Subject
note on relevance alone in none (0%). Under NFR5 the student re-weighted engagement from 0.30 to 0.24 and relevance from
0.15 to 0.21 (ADR 0089); all three figures are now 100%, and search precision@5 stays 0.833. The ranking is still
deterministic. The seed's labels are provisional until UAT participants label it (#86).

### Latency at 10x

	At 3,000 users and 20,000 notes, module, hashtag and lecturer-filtered search and both feeds meet the 300 ms p95
target (91 to 229 ms). Keyword and Top search do not (742 and 735 ms): the cost is `ts_rank_cd` over 91% of notes, not
row lookup, so no index helps (ADR 0090). They stay within the NFR1 limit of 3,000 ms and are recorded as SRCH-TC23
(Fail against 300 ms).

### Not completed or deferred

- Keyword and Top search p95 over 300 ms at 10x (SRCH-TC23, ADR 0090); to be stated as a limitation (#85).
- Limitations still to write up: view-collaborator annotations 404, the D75 annotation-cap race, the marked race
  shortcuts (#85).
- A branded `SafeHtml` type (#75 open item) would change the deck schema; not done, the student's call.
- R26 E2E (#81), the UAT seed (#82), the evidence pipeline (#83) and the UAT redesign (#84) move to later sprints.

## Sprint retrospective

	Sources: the orchestrator's decision log (`run-logs/autopilot_2026-10-29/decisions.md`), the FYP-1 to FYP-8 session
review (`run-logs/retro_2026-10-29/fyp1-8_review.md`) and the 29 October kickoff with the student's amendments.

### What went well

- One ticket session per issue, verified and merged by the orchestrator, closed 14 issues in two days with no
  regression on `main`.
- The five-run flake check and session-level reviews held: every PR merged green, and security reviews found a real
  issue in most auth-adjacent PRs.
- Stabilising first paid off: R28 now starts on escaped layout HTML, a schema that matches its documentation, and a
  drift check that keeps them matched.

### What did not go well

- Idle-session renewal was found one path at a time (messaging, editor lock, video polling), which took three tickets
  where one cross-cutting review would have done.
- An unmigrated worktree test DB showed up as an "autosave 500" during a UI check (#98).
- Auto mode blocks `git push origin --delete`, and removing a worktree from inside it leaves a locked folder on
  Windows, so remote branches and empty folders were left for the student.
- Weekly usage, not the 5-hour window, was the binding limit (about 2% of the week per ticket session), and the
  orchestrator reached about 490k tokens of context before handing over.
- `docs/PLAN.md` carried three wrong dates; the official timeline puts the submission on 16 December 2026.

### Actions (agreed 1 November 2026)

| # | Change | Where |
| --- | --- | --- |
| 1 | When a diff adds a timer, poll, socket or renewal, list every path that keeps a session alive and check each against the idle limit | `.claude/agents/security-reviewer.md` |
| 2 | Migrate the worktree test DB right after creating it | `ship-feature` §1 |
| 3 | Close-out leaves the worktree first and tries the remote delete once, reporting leftovers as a command for the student | `ship-feature` §6 |
| 4 | Ticket sessions list follow-up work in the PR instead of filing issues | `ship-feature` §5 |
| 5 | Agents run on the model the task needs; usage is saved by running fewer at once | `docs/conventions/agent-workflow.md` |
| 6 | Weekly thresholds (no new session at 85%, pause tickets at 92%), a resume card instead of a scheduled session start, corrected keep-warm cost | next orchestrator kickoff |
| 7 | Hand over at the end of each batch or about 400k tokens of context, whichever comes first | next orchestrator kickoff |
| 8 | A check in `vp run check` that `docs/chapter4/CHAPTER4.md` matches its sources | #105 |
| 9 | `docs/PLAN.md` dates follow `FYP_TIMELINE.pdf` | `docs/PLAN.md` |

## Summary

	Sprint 6 left `main` stable for R28: the audit's blocking findings are fixed, NFR3 holds on the labelled seed, the
10x latency gap is measured and explained, and the workflow lessons above are folded into the agents, the ship-feature
skill and the next orchestrator's kickoff.
