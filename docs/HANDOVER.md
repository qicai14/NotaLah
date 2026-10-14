# Handover — after the 13 Oct 2026 autopilot run

Rewritten 14 Oct 2026 in the "Review & realign" session. The autopilot run ended at 23:56 on 13 Oct (last commit
7130013); nothing is running. Everything is committed and pushed to `origin/main`. Step-by-step log: `docs/PROGRESS.md`.
Usage limits stopped the run from about 10:30 to 23:04, so roughly 12 hours of the planned window were lost.

**State at HEAD (checked 14 Oct):** server tests 120/120, client tests 1/1. Sprints 0-3 are built; Sprint 4 (search,
messaging) is not started. Report Chapters 1-4 are in the .docx; Chapters 5-6 are not. **None of the autopilot's work
has been reviewed by you yet.**

## What got done

### Sprint 0: Chapter 4 design (`docs/chapter4/`)
| Deliverable | File |
|---|---|
| Assembled, numbered Chapter 4 draft | `docs/chapter4/CHAPTER4.md` (rebuild: `python -X utf8 docs/chapter4/build_chapter.py`) |
| Use case diagram and 22 use case specifications | `4.2.1_use_cases.md` |
| Class diagram, 5 activity and 5 sequence diagrams with explanatory text | `4.2.3_class_activity_sequence.md` (PlantUML in `diagrams/src/`) |
| ERD (19 tables), schema table and images | `4.3_database_design.md`, `diagrams/png/` |
| 25 greyscale wireframes with descriptions | `4.4_interface_design.md`, `wireframes/png/` (generator `wireframes/build.mjs`) |
| Test case tables (AUTH, NOTE, RANK, ENG, VER, SRCH, MSG, ADM, USR) and UAT template | `4.5_test_cases.md` |
| Sprint 0 review (FR traceability; why sprints went from 2 weeks to 1) | `docs/sprints/sprint0_review_retrospective.md` |

### Sprint 1: architecture, data and auth (`docs/sprints/sprint1_review_retrospective.md`)
- npm-workspaces monorepo: `client/` (React, Vite, TS, Tailwind v4), `server/` (Express 5, TS). Postgres 17 in Docker on 127.0.0.1:5433.
- dbmate migrations in `server/db/migrations/`; feature folders on both sides (`docs/ARCHITECTURE.md`).
- Register, login and `/me` with Passport (local + JWT) and bcrypt; role and status re-read from the DB on every request.
- Admin approves lecturer accounts (UC22, D6); `npm run admin:create -w server` creates the first admin.

### Sprint 2: notes, feed and engagement (`docs/sprints/sprint2_review_retrospective.md`)
- **API:** drafts and publishing (public / contacts-only), hashtags, sanitised slide HTML, full-text search document,
  profiles (UC04); paged feed with `asOf`; views, likes, comments (one reply level, lecturer comments pinned), reports, bookmarks.
- **Client:** TipTap slide editor, publish dialog, drafts, infinite-scroll feed, note detail with comments, report
  dialog, saved list, profile and edit-profile pages.

### Sprint 3: ranking, verification and moderation (no sprint review doc yet)
- **3A ranking** (58e77c0, fixes ea1d8f3): feed ranked by E, R, V, M from `server/src/features/ranking/config.ts`;
  each item returns `score` and `components`. Details and known limits: D24.
- **3B verification and moderation** (49a6b44, cbecf64, fixes 85d8cd5): lecturer Super Like with "Verified by <name>",
  admin report queue (resolve / hide), admin user search with suspend / restrict / reinstate / delete (UC19-UC21).
  Details: D26, D27. Client pages: `/admin/reports`, `/admin/users`.
- **Sprint-wide `/code-review high`** fixes (7130013): ranking frozen per `asOf`, suspended authors' notes hidden,
  report queue skips deleted notes. **Not yet verified by the tester at the time; verified 14 Oct: 120/120.**
- Missing: `docs/sprints/sprint3_review_retrospective.md`.

### Dissertation .docx (`writer` agent; `FYP_Submissions/`, not in git)
- **Step 1 (done):** APU formatting, page numbering and full outline (D15, D16).
- **Step 2 (done 23:28):** Chapters 1-3 and References from the IR, with the supervisor's requested Ch 2 appraisal
  and Ch 3 survey cross-tabulation added (D25). About 31.5k words of prose.
- **Step 3 (done 23:47):** Chapter 4 from `docs/chapter4/` (Figures 84-121, Tables 34-70, schema in Appendix H; D28).
- **Step 4 (Chapters 5-6):** not started; needs Sprint 4, UAT and screenshots first.
- Latest backup: `FYP_Submissions/backups/…_20261013-2345.docx`.
- **Report length is now the main writing risk:** about 39k words of prose against an 18-20k standard (open questions 7, 9, 11).

## Needs your decision
1. **D2-D4 scope cuts are to be reversed** (your scope rule, 14 Oct): FR15 term filter, FR17 background audio, FR18 annotation.
2. **D13 token storage:** the JWT sits in `sessionStorage`, while IR §2.3.6.2 cites Dalimunthe et al. (2022) and promises an httpOnly cookie.
3. D6 (admin approval of lecturers, new FR19), D9 (contacts via accepted message request), D17 (programme as free text).
4. Report length (open questions 7/9/11) and demo hosting (open question 8).
5. Everything else in `docs/DECISIONS.md` (D1-D28) and `docs/OPEN_QUESTIONS.md` (1-11).

## Broken or half-done
- **Dev database `parp` not migrated and no admin exists.** Setup: `npm run db:migrate -w server`, add `ADMIN_EMAIL`,
  `ADMIN_PASSWORD`, `ADMIN_NAME` to `.env`, then `npm run admin:create -w server`.
- `parp_test` holds smoke-test data from browser checks; tests truncate it, so harmless.
- Stray folder `C:\Users\reymy\Code%20Projects\` (duplicate wireframe PNGs from a fixed path bug) is safe to delete.
- `concurrently` 10.0.5 has a dev-only `npm audit` finding; bump to 10.0.6 after about 22 Oct (D14).
- Waiting on Socket.io (Sprint 4): socket disconnect on logout (UC03), notify user on lecturer decision (UC22) and on
  hidden note (UC20 step 5).
- Public search (Sprint 4) must exclude deleted accounts (D26).
- Only one client test (hashtag rules); everything else is server-side.

## Next steps
1. Review & realign (this session): decide D1-D28 and the open questions, add a realign backlog to `PLAN.md`.
2. Migrate the dev DB, create the admin, click through every built screen.
3. Write the Sprint 3 review, then Sprint 4 (search FR4-5 with the < 3 s check, messaging FR6-7, FR12-13) plus the realign backlog.
