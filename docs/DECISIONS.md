# Decision log

Choices made during the unattended run of 13 Oct 2026 that belong to the user. Review these first.
Reversibility: **Easy** (edit text/config), **Medium** (redo a diagram or migration before data exists),
**Hard** (would ripple through code and several chapters).

## D1 — FR14 bookmark/save notes: **keep**
- **Alternatives:** cut; defer to Sprint 4 stretch.
- **Why:** respondent-proposed (H2) and directly serves Objective 3 (one workspace instead of
  browser bookmarks or downloads). Cost is one join table (`"BOOKMARK_T"`) and one toggle
  endpoint, so it fits Sprint 2 beside likes.
- **Reversibility:** Easy.

## D2 — FR15 filter by lecturer and academic term: **rework**
- **Rework:** search results get two filters: *lecturer content* (posts authored by, or Super-Liked
  by, a lecturer) and *published date range*. "Academic term" is not modelled as an entity; APU
  intakes and terms differ per programme, so a date range expresses the same need without a term
  calendar that someone would have to maintain.
- **Alternatives:** full TERM_T table maintained by admin (rejected: admin workload, no data source);
  cut entirely (rejected: lecturer search had 31.3% support in D5 and filters are cheap once FR4 exists).
- **Reversibility:** Easy (filters are query parameters).

## D3 — FR17 background audio on slide notes: **cut (future work)**
- **Alternatives:** keep as Sprint 4 stretch; rework as a link to external audio.
- **Why:** lowest-supported feature (53.1% useful, 18.8% below moderate, IR §3.3.3.3 already flags it
  as deferrable). It needs file upload, storage, size limits and copyright moderation of audio, none of
  which serve the four objectives. With sprints compressed to one week, the time goes to FR1-FR7.
  Chapter 6 lists it under future enhancements.
- **Reversibility:** Medium (adds an upload pipeline later; schema change is one nullable column).

## D4 — FR18 peer/lecturer annotation of notes: **cut (covered by comments)**
- **Alternatives:** inline annotations anchored to slide text ranges.
- **Why:** proposed by one respondent and already marked "Low, deferred" in the IR. The underlying
  need (lecturer feedback on a specific note) is met by slide-referenced comments plus automatic
  pinning of lecturer comments; comments carry an optional slide number so feedback can point at
  a particular slide.
- **Reversibility:** Medium.

## D5 — FR16 direct reply to a set of notes: **keep, as one-level comment replies**
- **Why:** low priority but nearly free once comments exist (`cmt_parent_id`). One level only, to avoid
  the deep-thread visibility problem the IR cites (Lieu, 2024).
- **Reversibility:** Easy.

## D6 — Lecturer accounts are approved by an administrator
- **Decision:** anyone may register; choosing "Lecturer" creates the account with status
  `pending_lecturer` and student-level rights until an admin approves it. Admin accounts are seeded,
  never self-registered.
- **Alternatives:** trust the role checkbox (rejected: Super Like is the trust signal of the whole
  ranking design, FR1/FR3); restrict lecturer sign-up to an email domain (rejected: domain unknown,
  see OPEN_QUESTIONS).
- **Why:** without it any student could self-verify their own notes. Adds one admin use case.
- **Reversibility:** Medium.

## D7 — Subjects modelled as a seeded module catalogue (`"MODULE_T"`)
- **Decision:** each post references one module (code, name, programme), which serves FR4's
  "subject or module code" and "course or programme name" search. Catalogue is loaded by a seed
  migration; an admin UI for it is out of scope.
- **Alternatives:** free-text module field on posts (rejected: inconsistent spellings defeat search).
- **Reversibility:** Medium.

## D8 — Use case set limited to the IR deliverables (§1.6.4)
- Guest is shown as a separate actor for Register/Log In; Student, Lecturer and Admin inherit from
  an abstract *Registered User* to avoid repeating shared use cases. Lecturer inherits Student
  capabilities plus Super Like and reporting for plagiarism, as listed in §1.6.4.
- **Reversibility:** Easy.

## D9 — "Contact" is created by an accepted message request
- **Decision:** there is no separate friend-request feature. When a recipient accepts a message
  request (FR6), both users become contacts, and contacts-only posts (FR10) are visible to them.
- **Alternatives:** separate add-friend flow (rejected: two approval mechanisms for one idea).
- **Reversibility:** Medium.

## D10 — Interest vector computed from an interaction log, not stored
- **Decision:** `"INTERACTION_T"` logs views/likes/comments; the ranking service derives each viewer's
  decayed hashtag weights at query time (cacheable later).
- **Alternatives:** a maintained `INTEREST_T` (user, hashtag, weight) updated on every interaction.
- **Why:** exact 14-day decay at any moment, and NFR5 re-tuning of interaction weights needs no data
  migration. If feed latency suffers, add a cached table later.
- **Reversibility:** Easy (an additive cache table).

## D11 — Plain-SQL migrations with dbmate
- **Decision:** migrations are `.sql` files in `server/db/migrations/` with `-- migrate:up/down`
  sections, run by `dbmate` (npm package).
- **Alternatives:** node-pg-migrate (JS builders), Prisma/Knex (generate lowercase names, fight the
  quoted `_T` convention).
- **Why:** the SQL in the repository is exactly the SQL in Chapter 4.3/5.2 (uppercase keywords, quoted
  tables), and dbmate records applied versions in `schema_migrations`.
- **Reversibility:** Easy before Sprint 2.

## D12 — Test case IDs carry a module prefix (AUTH-TC1 … ADM-TC10)
- **Decision:** eight modules × TC1-TC10; automated test names start with the ID (e.g. `AUTH-TC3: …`).
  Re-tests after a fix continue the module's sequence (AUTH-TC11).
- **Why:** the standard asks for TC1-TC10 *per module*; a prefix keeps IDs unique across the report
  and lets Chapter 5 tables be filled straight from test output.
- **Reversibility:** Easy.

## D13 — Sprint 1 implementation details within the fixed IR stack
- **Layout:** npm workspaces monorepo: `client/` (Vite + React + TS + Tailwind v4), `server/` (Express 5 + TS).
- **DB access:** `pg` with hand-written parameterised SQL (no ORM) so quoted `_T` tables and uppercase
  SQL appear verbatim in Chapter 5 snippets; `dbmate` runs migrations (D11).
- **Validation:** `zod` at the API boundary. **Passwords:** `bcryptjs` (pure JS, no native build on
  Windows; output is the 60-char hash `CHAR(60)` expects), cost 12.
- **Auth:** Passport `passport-local` for login, `passport-jwt` for every protected route; JWT
  (HS256, 1 h expiry) in an `Authorization: Bearer` header, stored by the client in memory +
  `sessionStorage`. Account status is re-read from the DB on every request so suspension takes effect
  immediately (ADM-TC6) instead of at token expiry.
- **Tests:** Vitest + Supertest against a separate `parp_test` database migrated by dbmate; test names
  start with their TC ID.
- **Postgres:** `postgres:17-alpine` in Docker Compose on host port 5433 (avoids clashing with any local 5432).
- **Alternatives:** Prisma/TypeORM (rejected, see D11); httpOnly-cookie sessions (rejected for Sprint 1:
  Socket.io handshake in Sprint 4 reuses the bearer token; revisit if XSS hardening is prioritised).
- **Reversibility:** Medium.

## D14 — Migration tool flags, TypeScript 5.9, CommonJS server
- **Decision:** every dbmate script passes `--no-dump-schema`; the server compiles to CommonJS;
  TypeScript is pinned to 5.9.3; `.env` is read with Node's built-in `process.loadEnvFile` (no dotenv).
- **Alternatives:** install `pg_dump` so dbmate can write `db/schema.sql` (rejected: dbmate shells out
  to `pg_dump`, absent on the Windows host; the migration files already are the schema record); ESM
  server (rejected: `.js` import suffixes for no benefit); TypeScript 7.x (rejected: new native
  rewrite, tooling support unproven); dotenv (rejected: Node 24 covers it).
- **Why:** fewest moving parts on Windows + Docker. `concurrently` is pinned to 10.0.5 (newest release
  older than two weeks); `npm audit` flags its `shell-quote` dependency (dev tool, runs fixed commands
  only); bump to 10.0.6 once it is two weeks old (about 22 Oct 2026).
- **Reversibility:** Easy.

## D15 — Report chapter layout: briefing numbering for Chapters 4-6
- **Decision:** the .docx outline follows the structure guideline for front matter, Chapters 1-3, Chapter 6
  and Appendices A-G, but uses the Semester 2 briefing numbering (master checklist, `fyp-standards`) for the
  later chapters: Ch 4 "Design" = 4.1 Introduction, 4.2 System Design (Option A: use case diagram, use case
  specs, class, activity, sequence), 4.3 Database Design (ERD, schema), 4.4 Interface Design, 4.5 Test Case
  Preparation, 4.6 Summary; Ch 5 "Implementation, Results and Discussion" = intro paragraph, 5.1 System
  Screenshots, 5.2 Sample Codes, 5.3 Unit Testing, 5.4 UAT, 5.5 Summary; Ch 6 = 6.1 Critical Evaluation,
  6.2 Limitations, 6.3 Recommendations. Chapter 1.7 is "Overview of the Report" (the guideline's "Overview
  of the IR" is IR wording). Headings carry manual numbers, not Word list numbering.
- **Alternatives:** the guideline's own split (screenshots and sample code as Ch 4.6 "Execution", testing in
  Ch 5) — rejected because the briefing, the marking checklist and the skill all cite 5.1-5.4 for those items;
  Word multilevel auto-numbering — rejected as fragile when sections are moved between steps.
- **Why:** examiners mark against the briefing section numbers; every guideline item still has a home.
- **Reversibility:** Easy (rename/move headings; the TOC regenerates).

## D16 — Report page layout and numbering
- **Decision:** A4, margins left 40 mm / others 20 mm, header and footer 10 mm from the edge. Two sections:
  front matter (cover to List of Tables) numbered i, ii, ... with no header/footer on the cover; chapters
  onward numbered 1, 2, ... Header is `LIM QI CAI` left / `TP072229` right (intake code dropped, per
  HEADER-AND-FOOTER.txt); footer is the bare page number left / university name right (the old "Page |"
  prefix dropped). Body paragraphs use Word's built-in "Body Text" style (TNR 12, 1.5 spacing, justified,
  12.7 mm first-line indent); Normal stays unindented so the cover, captions and tables are unaffected.
  Captions: TNR 12 italic, centred, black. The empty trailing landscape section (US Letter, holding only a
  blank caption) was removed. Declaration of Thesis Confidentiality and Library Form pages were added after
  the cover as placeholders. Word is set to refresh the TOC and lists of figures/tables on open.
- **Alternatives:** one continuous arabic numbering from the cover (rejected: front matter is normally roman);
  first-line indent on Normal (rejected: it would indent the cover page, captions and table cells).
- **Why:** matches FINAL DOCUMENT STANDARDS, HEADER-AND-FOOTER.txt and the supervisor's indent feedback.
- **Reversibility:** Easy. Backup of the pre-change file: `FYP_Submissions/backups/MR_LIM_QI_CAI_TP072229_APU3F2605SE_SE_FYP_DOC_20261013-0347.docx`.

## D17 — Sprint 1 auth details left open by the spec
- **Decision:** register requires `role` ('student'|'lecturer') and a free-text `programme` (max 100);
  passwords 8 chars to 72 UTF-8 bytes (bcrypt truncates beyond 72); a `restricted` account can still
  log in (restriction is enforced per action later, ADM-TC7), only `suspended` gets 403 at login (`deleted` gets the generic 401 so it does not reveal the account; both are rejected on every token request);
  login and registration share one rate limit of 10 requests per minute per IP (off under NODE_ENV=test, so not covered by a
  test; behind the Vite dev proxy, which sends `X-Forwarded-For` (`xfwd: true` in `client/vite.config.ts`), Express trusts `loopback` proxies so each real client IP gets its own bucket); a rejected JWT returns JSON
  `{ error: 'Unauthorized' }`. The client refreshes the stored user from `/api/auth/me` on page load
  (so an approval shows without re-login) and, on any 401 to an authenticated call, clears
  `sessionStorage` and does a full reload to `/login?expired=1`.
- **Alternatives:** programme as a dropdown from `"MODULE_T"` (no endpoint yet; revisit with the
  search module); default role student when omitted (rejected: the form always sends it, explicit is
  clearer); blocking restricted users at login (rejected: UC21 says restricted users can still read).
- **Why:** most conventional secure option for each gap; nothing changes the schema.
- **Reversibility:** Easy.

## D18 — Lecturer approval API and admin bootstrap
- **Decision:** approve takes an optional reason (logged as 'Approved' when absent); reject requires a
  non-blank reason (max 300, matching `aac_reason`); acting on a user without a pending application
  returns 404, so a rejected applicant cannot be approved later without re-applying (no re-apply flow
  yet). The first admin comes from `npm run admin:create -w server`, which reads `ADMIN_EMAIL`,
  `ADMIN_PASSWORD` (12+ chars, upper, lower case and a digit) and `ADMIN_NAME`, and upserts: an
  existing account with that email is promoted to admin and its password reset.
- **Alternatives:** a seed migration with a fixed admin password (rejected: credential in the repo);
  insert-only script (rejected: no way to recover a lost admin password).
- **Why:** UC22 and D6 without storing any credential in git.
- **Reversibility:** Easy.

## D19 — Feature-folder structure for every sprint
- **Decision:** server code lives in `server/src/features/<feature>/` (auth, users, moderation, ranking, notes,
  feed, search, messaging) with shared code in `lib/` (env, pool, health) and `types/`; the client mirrors it in
  `client/src/features/<feature>/` plus shared `components/`, `lib/`, `types/` (no client `ranking` folder: it has no UI).
  Tests mirror features under `server/tests/<feature>/`. The ranking config moved to
  `server/src/features/ranking/config.ts`, now the single "one config module" for NFR5; CLAUDE.md and README were
  updated, while older DECISIONS entries that mention `config/ranking.ts` are historical. Likes, comments, reports
  and bookmarks live in `feed`; lecturer note verification has its own `verification` feature (lecturer-only routes,
  `"VERIFICATION_T"`, `VER-TC*`), kept apart from the admin-only `moderation` router (amended after review). Moved: config/env -> lib/env, db/pool ->
  lib/pool, routes/health -> lib/health, auth/passport -> features/auth/passport, middleware/auth ->
  features/auth/middleware, routes/auth -> features/auth/routes, db/users -> features/users/repository,
  routes/admin -> features/moderation/routes; client auth/, pages/Login+Register, ProtectedRoute -> features/auth,
  pages/AdminLecturers -> features/moderation. Docs folders for chapters 5-6, testing, screenshots and code
  snippets were created with READMEs.
- **Alternatives:** keep layer folders (routes/, db/, middleware/) and add features later (rejected: moves later cost
  more); keep `config/ranking.ts` (rejected: the ranking feature needs a home and few references existed).
- **Why:** one agreed map so each sprint only fills folders; the folder name tells which FR and test table it serves.
- **Reversibility:** Medium (imports touched across ~20 files).

## D20 — Sprint 2 implementation choices
- **Slide content:** each slide is HTML produced by a TipTap editor (StarterKit: headings, bold, italic,
  lists, code blocks) and sanitised on the server with `sanitize-html` against that same allow-list before
  it is stored (NOTE-TC10). The server never trusts client sanitising.
- **Feed order in Sprint 2:** published, visible posts newest first. The heuristic score replaces this order in
  Sprint 3 behind the same endpoint, so the client does not change.
- **Search document:** `pst_search_doc` is rebuilt in SQL on every publish/edit from title, slide text (tags
  stripped) and hashtags with `to_tsvector('english', ...)`, ready for Sprint 4 search.
- **Interactions:** views, likes and comments are logged to `"INTERACTION_T"` from Sprint 2 so that Sprint 3's
  interest vector has history to work with.
- **Lecturer comment pinning (ENG-TC7)** is done now with comment ordering, not in Sprint 3, because it is one
  ORDER BY clause and ENG-TC7 belongs to the engagement test table.
- **Alternatives:** Markdown slides (rejected: FR8 asks for a formatting interface, and survey users are not all
  technical); Quill/Lexical (TipTap has the smallest React integration for this feature set).
- **Reversibility:** Medium for the editor (stored HTML), easy for the rest.

## D21 — Notes and profile API rules (Sprint 2, task 2A)
- **Limits:** at most 30 slides per note and 20 000 characters per slide after sanitising; at most 5 hashtags
  (enforced for drafts too, since the link table is the same). A title is always required, even for drafts.
- **Sanitising:** `sanitize-html` 2.17.6 with the TipTap StarterKit allow-list and no attributes; `b`, `i`,
  `strike`, `del` are rewritten to `strong`, `em`, `s` so pasted formatting survives (NOTE-TC10).
- **Publishing:** empty slides are dropped when publishing (at least one non-empty slide required); visibility is
  required to publish; a published note cannot be changed back to a draft (400).
- **Access:** PUT/DELETE on a note the caller cannot see (another user's draft, contacts-only) return 404 so
  existence is not revealed; on a note they can see but do not own they return 403 (NOTE-TC9). A moderator-hidden
  note cannot be edited by its author (403). Restricted users are blocked from POST and PUT only (`requireActive`);
  they can still delete their own notes. DELETE is a soft delete (status 'deleted').
- **Contacts:** visibility checks treat `"CONTACT_T"` as symmetric (a row in either direction counts); accepting a
  message request inserts both rows together (D9), so this only protects against a half-written pair.
- **Verified lecturer:** `isVerifiedLecturer` is true when role is lecturer and lecturer status is approved.
- **Profiles:** `PUT /api/users/me` returns the updated user in the same shape as `/api/auth/me`; empty
  programme/bio are stored as NULL; avatar upload is out of scope for now. Deleted accounts return 404.
- **Alternatives:** returning 403 for every non-owner (rejected: leaks drafts' existence); allowing publish-to-draft
  (rejected: would pull a note out of feeds others already saw).
- **Reversibility:** Easy.

## D22 — Feed and engagement rules (Sprint 2, task 2B)
- **Who can engage:** likes, views, comments, reports and bookmark-adds need a published note the viewer may see
  (the notes `VISIBLE` predicate); anything else is 404, so a draft or contacts-only note is never revealed. Unliking,
  removing a bookmark and deleting your own comment do not re-check the note. Writes use `requireActive`; reads do not.
- **Views:** logged once per user and note per 30 minutes (query-side `NOT EXISTS`), so reloading cannot inflate the
  interest history. Window is a constant in `feed/repository.ts`.
- **Status codes:** a new like (note or comment) returns 201, a repeated one 200, both with `{liked, likes}`;
  unlike returns 200 (ENG-TC1/TC3).
- **Comments:** body is trimmed before the 1-1000 check; `slideNo` must be within the note's slide count; a parent must
  be a live top-level comment on the same note (a deleted parent cannot be replied to). Deleted comments show
  `[deleted]` with no author when they still have replies and are omitted otherwise; deleted replies are omitted.
  Pinned = author is an approved lecturer; ordering is done in code after one query (pinned, likes desc, oldest first).
  The feed's comment count excludes deleted comments.
- **Reports:** check order is visibility (404), reason valid (400), own note (400), lecturer-only reason (403), then
  insert; duplicates map the partial unique index violation (23505) to 409. Details are trimmed, blank stored as NULL.
- **Bookmarks:** list returns the summary shape plus `savedAt`; notes that became hidden/deleted/invisible are skipped
  but the row is kept, so they reappear if made visible again.
- **Feed:** `GET /api/feed?page=N` fetches 11 rows to learn `nextPage`; ordering lives in one `FEED_ORDER` constant.
  `page` above 1,000,000 is treated as invalid.
- **Unlike, unbookmark, delete own comment:** need no visibility check (code matches this rule); an owner can still
  delete their comment on a note that later became invisible.
- **Paging stability:** page 1 returns `asOf` (ISO timestamp); later pages send `?asOf=` and only notes published at or
  before it are listed, so new posts do not shift pages. Invalid `asOf` is 400. Sprint 3 must compute recency against
  `asOf`, not NOW(); the client also drops ids it has already shown.
- **View dedupe race:** the 30-minute check is check-then-insert, so simultaneous requests can double-log; the client
  guards per mount, accepted as a known shortcut.
- **Alternatives:** a migration for a view-dedupe index (rejected: the task forbade new schema unless needed and the
  window check is cheap); a separate counts table (rejected: counts are aggregated at read time at this scale).
- **Review fixes (Sprint 2):** the feed cutoff is `COALESCE($asOf, NOW())` read from the database (one extra tiny query, so an empty page
  still returns it), matching the clock that stamps `pst_published_at`. Self-engagement does not inflate ranking E: liking your own note is
  400 "You cannot like your own note"; `ENGAGEMENT_COLS` counts comments `AND cmt_usr_id <> p.pst_usr_id` (the thread still shows them all);
  the author's own views and comments write no INTERACTION_T row. `PUT /users/me` updates only the fields sent (empty string clears to NULL).
  Removal routes (unlike, unlike comment, unbookmark) drop `requireActive`, so a restricted user can undo. Template is the enum
  plain/lecture/revision/howto (default plain). `approvedLecturer(alias)` in `users/repository.ts` is the one SQL fragment for D21.
  Judgement: the pg driver returns millisecond `Date`s, so a note published in the same millisecond as the cutoff can drop off page 2 (accepted).
- **Reversibility:** Easy.

## D23 — Sprint 2 client choices (task 2C)
- **TipTap 3.31.3** (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`) pinned exactly: 3.31.4 was under two weeks old. npm
  also resolved the optional bubble/floating-menu peers to 3.31.4, so the root `package.json` `overrides` pins those two and
  `@tiptap/core` to 3.31.3.
- **Allow-list:** StarterKit v3 ships Underline, Link, ListKeymap and TrailingNode; all four are disabled so the editor can only
  emit the server's allow-list (D20). The toolbar has one button per allowed node/mark.
- **Published notes:** the editor offers only Public and Contacts only when editing a published note (the server rejects
  publish-to-draft, D21), and shows "Update" instead of Save Draft. New notes and drafts get the three equal options (FR10).
- **"Verified by":** the feed returns only a `verified` flag, not the verifier, so the card says "Verified by a lecturer".
  Naming the lecturer needs an API change (Sprint 3 Super Like work).
- **Note detail** shows slides, hashtags, the shared action bar (like, save, report) and comments; `GET /api/notes/:id` returns the
  engagement state (see the review-fix entry below).
- **Templates:** plain, lecture, revision, howto (server accepts any string up to 30 characters).
- **Own profile** loads via `GET /api/users/:id` with the caller's id because `/auth/me` has no bio; the auth user is refreshed
  from the `PUT /api/users/me` response through a new `setUser` on the auth context.
- **Delete confirmations** (drafts, own comments) use an inline "Are you sure?" button pair, not `window.confirm`.
- **Feed card views:** logged after 1 s at >=50 % visibility, guarded by a ref (once per card per mount).
- **Reversibility:** Easy.
- **Review fixes (2C):** `getVisibleNote` now returns counts, liked, bookmarked and verified (shared `ENGAGEMENT_COLS` fragment in
  `notes/repository.ts`, also used by the feed), so the note detail shows the same action bar as the feed card. `ol[start]` is allowed by the
  sanitiser because TipTap writes it on continued lists. The editor is keyed by note id and, after the first draft save, receives the saved
  note through router state instead of refetching. The mobile feed snaps through `scroll-snap-type` on `html` while the feed is mounted.
  A minimal client Vitest setup (node environment, pure logic only) covers the hashtag rules (NOTE-TC24).

## D24 — Ranking service and ranked feed (Sprint 3, task 3A)
- **Scoring in the app:** `GET /api/feed` fetches candidates and the viewer's interactions, scores each note with the
  pure functions in `ranking/service.ts`, sorts by score desc (ties: `published_at` desc, id desc) and slices the page.
  Four queries per request: the `asOf` cutoff, candidates and interactions (run in parallel), then the full notes for the
  page only, so slide HTML is never loaded for the whole candidate set. The `FEED_ORDER` constant is gone.
- **Candidate window:** the 500 most recent visible published notes at or before `asOf` (`candidateLimit` in config).
  With a 72 h recency half-life an older note needs very high E and V to matter, and 500 covers weeks of faculty-scale
  posting; a count cap was chosen over a 60-day cap because it bounds the scoring work whatever the posting rate.
- **Interest vector:** view 1, like 3, comment 5 (config `interactionWeights`; the IR fixes only the order), decayed by
  0.5^(ageDays / 14) against `asOf`, summed per hashtag of the interacted post (its current hashtags), normalised to max 1.
  Interactions older than 90 days (`interestWindowDays`, weight below 1.2 %) or after `asOf` are ignored. No history gives
  M = 0 for every note.
- **Validation:** `verified` (shared `ENGAGEMENT_COLS`, so the feed and note detail agree) now counts only a Super Like by
  an approved lecturer whose account is active; a suspended or deleted lecturer's past Super Likes stop counting. V = 0.5
  uses the existing author flag (approved lecturer, any account status), as the IR ties it to authorship.
- **Response:** each feed item adds `score` and `components {E, R, V, M}` (unrounded) for the "why am I seeing this" panel
  and UAT/NFR5 analysis. Shape and the `asOf` contract are otherwise unchanged; `nextPage` comes from the ranked length.
- **Paging:** `asOf` freezes the candidate set and recency, so pages are stable; a like or comment added between page
  requests can move a note across a page boundary (accepted; the client already drops ids it has shown, D22). A note
  hidden or deleted between the two queries is dropped from that page.
- **Refactor:** the hashtag-list subquery repeated three times in `notes/repository.ts` is now one `HASHTAGS_COL` fragment.
- **Alternatives:** scoring in SQL (rejected: the components would not be separately testable, Chapter 4 sequence text);
  storing scores (rejected: stale as soon as a like or verification lands); loading full notes for all candidates
  (rejected: slide HTML for 500 notes per request).
- **Reversibility:** Easy; constants are in config.

## D25 — Report Chapters 1-3 written from the IR (documentation step 2)
- **Decision:** IR text kept in substance; figures, OMML equations and tables copied from the IR .docx. Rewritten:
  all of Chapter 1 (tense, Part II scope, D1-D6 changes, re-baselined plan; Table "project plan" gains a Sprint 0
  row and one-week sprint dates, Part II weeks counted from 21 Sep 2026), every Chapter 2.2 figure/text pair
  (description now sits beneath each screenshot), 3.1.4/3.1.5 (one-week sprints, time-boxes 2 h / 1 h / 45 min).
  Added: 2.1.1.6 and 2.1.2.3 (appraisal of implications), a methodology-domain appraisal paragraph, 2.3.11 with a
  trade-off table, 3.3.1.9 cross-tabulation (6 tables + Spearman table, computed from the survey CSV), 3.3.3.4
  requirement changes (FR19 = admin approval of lecturer accounts added to the FR table), an explanatory
  paragraph under every figure and table. References: the 49 IR entries (all cited in Ch 1-3), hanging indent.
- **Corrections made to IR content:** FR8 evidence (19 selections, 59.4%, not 20/62%); Figure 18 source
  (Moodle, not Notion); Moodle captions now n.d.-a/-b; "Table 2.3/3.1/1.3" refs; Figure 49 -> 47 ref in 3.1.4;
  question tables 3.2-3.9 turned into numbered captions; Ch 2 now records that Sprint 1 stores the JWT in
  memory/sessionStorage (D13), contrary to the IR's httpOnly-cookie plan, with mitigations (D17, D20/D21).
  Figures 6-8 were linked web images inside INCLUDEPICTURE fields in the IR; they are now embedded copies.
- **Alternatives:** full rewrite of 29k words (rejected: OPEN_QUESTIONS #7, risk of losing substance).
- **Reversibility:** Easy. Backups in `FYP_Submissions/backups/` (…_0945 = before Ch 1, …_2321 before Ch 2,
  …_2322 before Ch 3, …_2323 before References, …_2324 before the sanitisation fix).
