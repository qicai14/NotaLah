# Sprint 3 (Ranking and Verification) — Review and Retrospective

*Planned dates: 3 – 9 November 2026. Increment completed: 13 October 2026. Reviewed by the student: 14 October 2026.*

## Sprint goal

	Replace the newest-first feed with the heuristic ranking that is the technical core of Objective 1, combining engagement, recency, lecturer validation and hashtag relevance with weights held in one configuration module (FR3, NFR5), and deliver the trust and moderation features the ranking depends on: the lecturer Super Like with a visible verified indicator (FR1, FR2), the administrator report queue and account actions (UC19–UC21).

## Sprint review

### Increment delivered

| Item | Evidence |
| --- | --- |
| Ranking service: pure scoring functions for E, R, V and M, weights and constants in one module | `server/src/features/ranking/service.ts`, `ranking/config.ts` |
| Ranked feed: candidate set (newest 500 plus notes with a valid Super Like), scored in the application, paged against a frozen `asOf` | `server/src/features/feed/`, `ranking/repository.ts` |
| Per-item score and components returned for a later "why am I seeing this" panel and for NFR5 tuning | `GET /api/feed` response |
| Lecturer Super Like and withdrawal, "Verified by" the earliest valid verifier on every list | `server/src/features/verification/`, `VERIFIED_BY` fragment |
| Administrator report queue grouped per note, hide or dismiss with a required remark | `server/src/features/moderation/` |
| Account search and restrict, suspend, reinstate and delete (anonymising) actions, logged in `"ACCOUNT_ACTION_T"` | `moderation/routes.ts` |
| Notes of suspended authors hidden from everyone but the author until reinstated | `VISIBLE` predicate |
| Client: Super Like button and dialog, verified frame, admin Reports and Users pages | `client/src/features/{verification,moderation}/` |

### Test results

	At the end of the sprint all 120 server tests and the client test passed, together with type checking and production builds. The RANK, VER and ADM tables of Chapter 4 are automated, with cases added when a review exposed an untested rule (RANK-TC14 to TC16, ADM-TC18 to TC20). A follow-up audit on 15 October added RANK-TC17 to TC19 (Section "After the sprint").

### Quality process

	Both increments, ranking (3A) and verification with moderation (3B), went through review before testing, and the findings were fixed before the next increment started. No review found a blocking defect, but the sprint-wide review found that later pages of the feed could repeat or skip a note when someone liked or verified a note between page requests, because engagement was counted live while the candidate set was frozen. Likes, comments and Super Likes are now counted only up to `asOf`, so one `asOf` always produces one ranking; this matters for Objective 1, because a feed that reshuffles while the student scrolls defeats the purpose of ranking. The same review aligned the lecturer-author bonus with the rule for valid Super Likes, so a suspended lecturer's notes lose both.

### Not completed or deferred

- Notifying an author when an administrator hides a note (UC20 step 5) and notifying an applicant of the lecturer decision (UC22) need a notification channel; both are planned with the notification inbox in Sprint 4 (R8).
- The ranking components are returned by the API but have no interface yet; the "why am I seeing this" panel is planned (R6).
- This review document was written on 15 October, after the student's review, instead of at the end of the sprint.

### After the sprint

	A whole-codebase audit on 15 October found that the set of ranking candidates grew with every Super Like ever given and that a client-supplied `asOf` in the future reduced every note's recency to zero. Candidates added only through a Super Like are now limited to Super Likes from the last 180 days (a configuration constant), while a note's verified status and its V component are unaffected, and the feed cut-off is capped at the database clock (D30, RANK-TC17 to TC19).

## Sprint retrospective

### What went well

- Writing the ranking as pure functions over plain rows made each component testable in isolation and made the formula in IR Section 2.3.4 directly traceable to code.
- Freezing every input of the score at `asOf` turned an intermittent paging defect into a deterministic, testable rule.
- Shared SQL fragments (`VISIBLE`, `VERIFIED`, `countingLecturer`) kept the feed, note detail and profile lists consistent, so a rule changed in one place applied everywhere.

### What did not go well

- The sprint ran unattended in the same day as Sprints 0 to 2. Several scope decisions were made without the student and were reversed in the 14 October review (D2 to D4, D9, D13), which costs rework in later sprints.
- Commits went straight to the main branch, so there was no pull-request record of each review.
- Client logic remained almost untested; only server behaviour is covered automatically.

### Actions for the next sprint

- The student agrees each module's specification before coding starts.
- Every change goes through a feature branch and a pull request, merged only when tests pass.
- Add component tests for client logic and an end-to-end smoke suite (R26).
