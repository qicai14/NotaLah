# Handover — autopilot run of 13 Oct 2026

Sprints 0, 1 and 2 are done (Sprint 2 closed at 23:20 after the run resumed; see `docs/sprints/sprint2_review_retrospective.md`).
Everything is committed and pushed to `origin/main`. Usage limits stopped two agents at about 10:30, and work only
resumed at 23:04, so roughly 12 hours of the planned window were lost. The step-by-step log is `docs/PROGRESS.md`.

## What got done

### Sprint 0: Chapter 4 design (`docs/chapter4/`)
| Deliverable | File |
|---|---|
| **Assembled, numbered Chapter 4 draft** | `docs/chapter4/CHAPTER4.md`. Rebuild it with `python -X utf8 docs/chapter4/build_chapter.py` |
| Use case diagram and 22 use case specifications | `4.2.1_use_cases.md` |
| Class diagram, plus 5 activity and 5 sequence diagrams, each with an explanatory paragraph | `4.2.3_class_activity_sequence.md` (PlantUML sources in `diagrams/src/`) |
| ERD (19 tables), schema table and schema-table images | `4.3_database_design.md`, `diagrams/png/` |
| 25 greyscale wireframes with descriptions | `4.4_interface_design.md`, `wireframes/png/` (generator: `wireframes/build.mjs`) |
| Test cases: AUTH, NOTE, RANK, ENG, VER, SRCH, MSG, ADM and USR tables, plus the UAT template | `4.5_test_cases.md` (rows added as the code grew) |
| Sprint 0 review: FR traceability, and why sprints went from 2 weeks to 1 | `docs/sprints/sprint0_review_retrospective.md` |

### Sprint 1: architecture, data and auth
- **Folder layout:** monorepo with `client/` (React, Vite, TS, Tailwind v4) and `server/` (Express 5, TS). Postgres 17 runs in Docker on 127.0.0.1:5433.
- **Migrations:** dbmate, in `server/db/migrations/`.
- **Feature folders:** both sides use feature folders, and features not built yet have a README. The layout is described in `docs/ARCHITECTURE.md`.
- **Auth:** register, login and `/me` use Passport (local and JWT) and bcrypt. Roles and account status are re-read from the database on every request.
- **Admin:** an admin approves lecturer accounts (UC22), and `npm run admin:create -w server` creates the first admin.
- **Reviews:** a reviewer, a fix pass and the tester ran on every commit, and `/code-review high` ran over the whole sprint. None found blockers, and all should-fix items were applied (ca66cd7, c7641b7).
- **Write-up:** `docs/sprints/sprint1_review_retrospective.md`.

### Sprint 2: notes, feed and engagement (server done, client needs one fix)
- **2A, notes and profile API** (85ffcd3, 15c5603):
  - Notes: drafts and publishing with public or contacts-only visibility, hashtags, and slide HTML cleaned with sanitize-html.
  - Each note gets a full-text search document, built in the same transaction that saves it.
  - Profiles (UC04).
  - Tests: NOTE-TC1 to TC21 and USR-TC1 to TC10.
- **2B, feed and engagement API** (bdad8ab, bd7c21c):
  - The feed is paged with `asOf`, so pages don't shift while you scroll. It is newest-first for now; Sprint 3 swaps in the ranking score at the single `FEED_ORDER` constant.
  - Views are logged to `INTERACTION_T`, with one log per user per note every 30 minutes.
  - Likes, comments (one level of replies, lecturer comments pinned, comment likes), reports and bookmarks.
  - Tests: ENG-TC1 to TC15, RANK-TC9 and RANK-TC10.
- **2C, client screens** (40e665e):
  - TipTap slide editor, publish dialog, drafts list, infinite-scroll feed with a slide viewer, note detail with comments, report dialog, saved list and profile pages.
  - Tested by hand in a browser against the test database.
- **Server tests:** 76 of 76 pass, and typecheck and build are clean.

### Dissertation .docx (`writer` agent)
- **Step 1 (done):** formatting set to the APU standard (A4, margins, header and footer, styles, roman then arabic page numbers) and the full chapter outline added. Decisions D15 and D16.
- **Step 2 (partly done):** Chapter 1 is written into the .docx, about 3,300 words that filled 14 of the 79 `[TBC]` placeholders. The usage limit stopped the run before Chapters 2 and 3, and before the References section.
  - Last backup before that run: `FYP_Submissions/backups/…_20261013-0945.docx`.
  - Chapter 1 has not been reviewed yet. Read it before you rerun step 2.
- **Steps 3 (Chapter 4) and 4 (later chapters):** not started.

## Decisions to review first (`docs/DECISIONS.md`)
1. **D2, D3 and D4 change the report's scope.** FR17 (background audio) and FR18 (annotation) are cut, and FR15 is reworked into a lecturer filter plus a date-range filter. Take these to supervisor meeting #2.
2. **D6 adds a step the IR doesn't have.** Lecturer accounts need an admin's approval (UC22). This protects the Super Like signal.
3. **D17 makes programme free text at registration.** Search (FR4) needs consistent values, and the Edit Profile wireframe shows a dropdown. I recommend a list built from the `"MODULE_T"` programmes.
4. **D9 creates contacts only by accepting a message request.** Each accepted request writes two rows, and the visibility check matches either direction.
5. **D15 follows the briefing's numbering for the report.** Chapter 5 is 5.1 screenshots, 5.2 code, 5.3 unit tests, 5.4 UAT.
6. **D19 and D20 to D23 cover the folder layout and Sprint 2 choices.** Covered: TipTap matched to the server's allowed HTML, newest-first feed until Sprint 3, `asOf` paging, view throttling, and which removals skip the visibility check.

## Open questions (`docs/OPEN_QUESTIONS.md`)
- The final deadline (assumed to be about 29 Nov).
- Form 421, the PG Bank log for meeting #1, and booking meeting #2.
- A staff email domain for lecturer sign-up.
- IR Chapters 1-3 run to about 29k words against an 18-20k standard. Cut them, or keep them?
- A stray folder to delete (see below).

## Broken or half-done
- **Sprint 2 closed after the handover was first written:** the 2C editor blocker and all review items were fixed (bfa3b67), the sprint-wide `/code-review high` found 0 blockers and its 7 findings were fixed (eb460fd); server 82/82, client 1/1.
- **Dev database not migrated.** The command guard blocked `db:migrate` all day. To set it up, run `cd FYP_Project && npm run db:migrate -w server`. Then set `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_NAME` in `.env` and run `npm run admin:create -w server`.
- **The `parp_test` database holds smoke-test users and notes** from the browser checks. The tests truncate it, so this is harmless.
- **Stray folder `C:\Users\reymy\Code%20Projects\`** holds 25 duplicate wireframe PNGs written by a path bug, which is fixed. It is safe to delete; the autopilot was blocked from deleting it.
- `concurrently` 10.0.5 has an `npm audit` finding in a dev-only package. Bump it to 10.0.6 after about 22 Oct (D14).
- **Waiting on Socket.io (Sprint 4):** UC03's socket disconnect on logout and UC22's notification to the user.
- **No client tests yet.** All automated tests are on the server.

## Next three steps
1. **Read the Sprint 2 review** (`docs/sprints/sprint2_review_retrospective.md`) and click through the new screens on your dev DB once it is migrated.
2. **Run the dev migration and `admin:create`.** Then click through register, admin approval and lecturer login, read the Chapter 1 the writer produced, and rerun writer step 2 for Chapters 2-3.
3. **Sprint 3** (ranking E/R/V/M from `features/ranking/config.ts`, computed against `asOf`):
   - lecturer Super Like with the verifier's name (`features/verification`, VER-TC)
   - admin report queue and suspend/restrict (UC20-21)
   - review D2-D4, D6 and D17 at supervisor meeting #2
