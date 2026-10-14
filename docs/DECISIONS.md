# Decision log

Choices made during the unattended run of 13 Oct 2026 that belong to the user. All of D1-D28 were reviewed by the user on
14 Oct 2026; each entry ends with a **User review (14 Oct)** line, which overrides the entry where they differ.
Reversals and additions are scheduled in `PLAN.md` (Realign backlog).
Reversibility: **Easy** (edit text/config), **Medium** (redo a diagram or migration before data exists),
**Hard** (would ripple through code and several chapters).

## D1 — FR14 bookmark/save notes: **keep**
- **Alternatives:** cut; defer to Sprint 4 stretch.
- **Why:** respondent-proposed (H2) and directly serves Objective 3 (one workspace instead of
  browser bookmarks or downloads). Cost is one join table (`"BOOKMARK_T"`) and one toggle
  endpoint, so it fits Sprint 2 beside likes.
- **Reversibility:** Easy.
- **User review (14 Oct):** Keep.

## D2 — FR15 filter by lecturer and academic term: **rework**
- **Rework:** search results get two filters: *lecturer content* (posts authored by, or Super-Liked
  by, a lecturer) and *published date range*. "Academic term" is not modelled as an entity; APU
  intakes and terms differ per programme, so a date range expresses the same need without a term
  calendar that someone would have to maintain.
- **Alternatives:** full TERM_T table maintained by admin (rejected: admin workload, no data source);
  cut entirely (rejected: lecturer search had 31.3% support in D5 and filters are cheap once FR4 exists).
- **Reversibility:** Easy (filters are query parameters).
- **User review (14 Oct):** **Modify.** Keep the lecturer-content filter and custom date range, and restore the academic-term filter through a seeded term catalogue (`"TERM_T"`: name, start date, end date, loaded by migration like `"MODULE_T"`); choosing a term filters by its dates. FR15 is then delivered as written in the IR.

## D3 — FR17 background audio on slide notes: **cut (future work)**
- **Alternatives:** keep as Sprint 4 stretch; rework as a link to external audio.
- **Why:** lowest-supported feature (53.1% useful, 18.8% below moderate, IR §3.3.3.3 already flags it
  as deferrable). It needs file upload, storage, size limits and copyright moderation of audio, none of
  which serve the four objectives. With sprints compressed to one week, the time goes to FR1-FR7.
  Chapter 6 lists it under future enhancements.
- **Reversibility:** Medium (adds an upload pipeline later; schema change is one nullable column).
- **User review (14 Oct):** **Reverse.** FR17 is built. The author searches Deezer from the editor (through a server proxy: the Deezer API needs no key but sends no CORS headers) and attaches one track; the note stores provider, track id, title, artist and cover only, with no audio stored on our side. The slide viewer loops the 30-second preview behind the slides with a play/pause control; the preview URL is signed and expires, so it is fetched fresh when the note plays. If Deezer is unreachable the note works without audio. 30-second previews are acceptable (user). Alternatives considered: own upload (storage and copyright moderation), Spotify (new apps get no preview URLs, playback only through the visible embed), MusicBrainz (metadata only, no audio), YouTube (quota of about 100 searches a day; its policies forbid audio-only playback).

## D4 — FR18 peer/lecturer annotation of notes: **cut (covered by comments)**
- **Alternatives:** inline annotations anchored to slide text ranges.
- **Why:** proposed by one respondent and already marked "Low, deferred" in the IR. The underlying
  need (lecturer feedback on a specific note) is met by slide-referenced comments plus automatic
  pinning of lecturer comments; comments carry an optional slide number so feedback can point at
  a particular slide.
- **Reversibility:** Medium.
- **User review (14 Oct):** **Reverse.** FR18 is built as text-anchored annotations: select text on a slide and add an annotation (slide number, quoted text, offset) stored in a new `"ANNOTATION_T"`; highlights render on the slide with a side panel listing them; lecturer annotations carry the badge; the note's author can delete any annotation on their note; annotations are reportable like comments.

## D5 — FR16 direct reply to a set of notes: **keep, as one-level comment replies**
- **Why:** low priority but nearly free once comments exist (`cmt_parent_id`). One level only, to avoid
  the deep-thread visibility problem the IR cites (Lieu, 2024).
- **Reversibility:** Easy.
- **User review (14 Oct):** **Modify.** Keep one level of replies. Add @mentions in comments and replies: a user can mention the person they are replying to (any participant in the thread) or any of their friends (mutual follows, D9), and the mentioned user gets a notification. Needs a notification inbox (shared with the UC20 and UC22 notifications).

## D6 — Lecturer accounts are approved by an administrator
- **Decision:** anyone may register; choosing "Lecturer" creates the account with status
  `pending_lecturer` and student-level rights until an admin approves it. Admin accounts are seeded,
  never self-registered.
- **Alternatives:** trust the role checkbox (rejected: Super Like is the trust signal of the whole
  ranking design, FR1/FR3); restrict lecturer sign-up to an email domain (rejected: domain unknown,
  see OPEN_QUESTIONS).
- **Why:** without it any student could self-verify their own notes. Adds one admin use case.
- **Reversibility:** Medium.
- **User review (14 Oct):** Keep. Add a staff-email-domain check as well if a domain is confirmed (open question 5).

## D7 — Subjects modelled as a seeded module catalogue (`"MODULE_T"`)
- **Decision:** each post references one module (code, name, programme), which serves FR4's
  "subject or module code" and "course or programme name" search. Catalogue is loaded by a seed
  migration; an admin UI for it is out of scope.
- **Alternatives:** free-text module field on posts (rejected: inconsistent spellings defeat search).
- **Reversibility:** Medium.
- **User review (14 Oct):** Keep, and add an admin Modules page (list, add, rename) since the programme dropdown (D17) also depends on the catalogue. Beyond the IR.

## D8 — Use case set limited to the IR deliverables (§1.6.4)
- Guest is shown as a separate actor for Register/Log In; Student, Lecturer and Admin inherit from
  an abstract *Registered User* to avoid repeating shared use cases. Lecturer inherits Student
  capabilities plus Super Like and reporting for plagiarism, as listed in §1.6.4.
- **Reversibility:** Easy.
- **User review (14 Oct):** Keep.

## D9 — "Contact" is created by an accepted message request
- **Decision:** there is no separate friend-request feature. When a recipient accepts a message
  request (FR6), both users become contacts, and contacts-only posts (FR10) are visible to them.
- **Alternatives:** separate add-friend flow (rejected: two approval mechanisms for one idea).
- **Reversibility:** Medium.
- **User review (14 Oct):** **Reverse.** Contacts become an Instagram/TikTok-style follow model. Any student or lecturer can follow anyone (one-way allowed); a mutual follow makes the two users friends. Contacts-only posts (FR10) are visible to friends only. Friends can message each other directly; a message from a non-friend is a request the recipient must approve (FR6), and approving it opens that conversation only, without making them friends. New `"FOLLOW_T"` replaces `"CONTACT_T"` through a migration; profiles get Follow/Unfollow and follower/following counts. Also add a Following feed (notes from people you follow) beside the ranked feed.

## D10 — Interest vector computed from an interaction log, not stored
- **Decision:** `"INTERACTION_T"` logs views/likes/comments; the ranking service derives each viewer's
  decayed hashtag weights at query time (cacheable later).
- **Alternatives:** a maintained `INTEREST_T` (user, hashtag, weight) updated on every interaction.
- **Why:** exact 14-day decay at any moment, and NFR5 re-tuning of interaction weights needs no data
  migration. If feed latency suffers, add a cached table later.
- **Reversibility:** Easy (an additive cache table).
- **User review (14 Oct):** Keep.

## D11 — Plain-SQL migrations with dbmate
- **Decision:** migrations are `.sql` files in `server/db/migrations/` with `-- migrate:up/down`
  sections, run by `dbmate` (npm package).
- **Alternatives:** node-pg-migrate (JS builders), Prisma/Knex (generate lowercase names, fight the
  quoted `_T` convention).
- **Why:** the SQL in the repository is exactly the SQL in Chapter 4.3/5.2 (uppercase keywords, quoted
  tables), and dbmate records applied versions in `schema_migrations`.
- **Reversibility:** Easy before Sprint 2.
- **User review (14 Oct):** Keep.

## D12 — Test case IDs carry a module prefix (AUTH-TC1 … ADM-TC10)
- **Decision:** eight modules × TC1-TC10; automated test names start with the ID (e.g. `AUTH-TC3: …`).
  Re-tests after a fix continue the module's sequence (AUTH-TC11).
- **Why:** the standard asks for TC1-TC10 *per module*; a prefix keeps IDs unique across the report
  and lets Chapter 5 tables be filled straight from test output.
- **Reversibility:** Easy.
- **User review (14 Oct):** Keep.

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
- **User review (14 Oct):** **Reverse the token storage only.** The JWT moves to an httpOnly, SameSite=Lax cookie (Secure in production), read by passport-jwt from the cookie and cleared on logout, with a required custom header on state-changing requests against CSRF; Socket.io (Sprint 4) authenticates the handshake from the same cookie. This matches IR §2.3.6.2 (Dalimunthe et al., 2022), and the report's "contrary to the IR" paragraph in Chapter 2 is removed. The rest of D13 is kept.

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
- **User review (14 Oct):** Keep.

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
- **User review (14 Oct):** Keep.

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
- **User review (14 Oct):** Keep.

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
- **User review (14 Oct):** **Modify.** Programme becomes a dropdown sourced from the programmes in `"MODULE_T"` on registration and Edit Profile (one GET endpoint), so FR4 programme search gets consistent values. The rest of D17 is kept.

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
- **User review (14 Oct):** Keep.

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
- **User review (14 Oct):** Keep.

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
- **User review (14 Oct):** Keep.

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
- **User review (14 Oct):** Keep.

## D22 — Feed and engagement rules (Sprint 2, task 2B)
- **Who can engage:** likes, views, comments, reports and bookmark-adds need a published note the viewer may see
  (the notes `VISIBLE` predicate); anything else is 404, so a draft or contacts-only note is never revealed. Unliking,
  removing a bookmark and deleting your own comment do not re-check the note. Writes use `requireActive`; reads do not.
- **Views:** logged once per user and note per 30 minutes (query-side `NOT EXISTS`), so reloading cannot inflate the
  interest history. Window is a constant in `engagement/repository.ts`.
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
- **User review (14 Oct):** Keep.

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
- **User review (14 Oct):** Keep.

## D24 — Ranking service and ranked feed (Sprint 3, task 3A)
- **Scoring in the app:** `GET /api/feed` fetches candidates and the viewer's interactions, scores each note with the
  pure functions in `ranking/service.ts`, sorts by score desc (ties: `published_at` desc, id desc) and slices the page.
  Four queries per request: the `asOf` cutoff, candidates and interactions (run in parallel), then the full notes for the
  page only, so slide HTML is never loaded for the whole candidate set. The `FEED_ORDER` constant is gone.
- **Candidate window:** the 500 most recent visible published notes at or before `asOf` (`candidateLimit` in config),
  plus every visible published note with a valid Super Like, so verified notes stay reachable however old (RANK-TC14).
  The two sets are a `UNION` of the newest-N CTE and a CTE driven from `"VERIFICATION_T"` (valid Super Likes made by
  `asOf`), filtered once for visibility, so the per-note verified `EXISTS` is no longer evaluated for every note
  (Sprint 3 review).
  A count cap bounds the scoring work whatever the posting rate; with a 72 h recency half-life an old unverified note
  rarely outranks newer ones. Known limit (a `shortcut:` comment in `ranking/repository.ts`): an unverified note older
  than the newest 500 is never ranked, however much engagement it has; widen the window if UAT shows misses.
- **Engagement:** the comment multiplier is `commentEngagementWeight` (2) in config, not inlined.
- **Interest vector:** view 1, like 3, comment 5 (config `interactionWeights`; the IR fixes only the order), decayed by
  0.5^(ageDays / 14) against `asOf`, summed per hashtag of the interacted post (its current hashtags), normalised to max 1.
  Known effect, kept because IR §2.3.4.5 defines it: normalising to the maximum makes the strongest interest 1.0 however
  weak it is in absolute terms, so a viewer whose only history is one view 80 days ago gets M = 1.0 for that hashtag,
  the same as a daily commenter. Recorded as an NFR5/UAT check (does a near-empty history over-steer the feed?); the
  fix, if UAT shows one is needed, is a floor or absolute scale in config, not a formula change.
  Interactions older than 90 days (`interestWindowDays`, weight below 1.2 %) or after `asOf` are ignored. No history gives
  M = 0 for every note.
- **Validation:** `verified` (one `VERIFIED` fragment used by `ENGAGEMENT_COLS` and the candidate query, so the feed and
  note detail agree) counts only a Super Like by an approved lecturer whose account is active or restricted; a restricted
  lecturer keeps their past endorsements, while a suspended or deleted lecturer's Super Likes stop counting. V = 0.5
  (lecturer author) uses the same rule through the shared `countingLecturer` fragment (approved lecturer, account
  active or restricted; RANK-TC16), so a suspended lecturer's own notes lose the bonus too (Sprint 3 review; it was
  any account status before).
- **Response:** each feed item adds `score` and `components {E, R, V, M}` (unrounded) for the "why am I seeing this" panel
  and UAT/NFR5 analysis. Shape and the `asOf` contract are otherwise unchanged; `nextPage` comes from the ranked length.
- **Paging:** `asOf` freezes the candidate set, recency and the scored engagement: likes, comments and Super Likes
  count only when created at or before `asOf` (`lik_created_at`, `cmt_created_at`, `ver_created_at`), so one `asOf`
  gives one ranking and pages can neither skip nor repeat a note when engagement lands between requests (RANK-TC15;
  Sprint 3 review, replacing the earlier "accepted" reorder). The counts shown on each item stay live, because they are
  displayed, not ranked. Still not frozen: an unlike, a deleted comment, a note hidden or deleted, a verifier or author
  suspended between requests (no removal timestamps); such a note can shift or drop from a later page.
- **Refactor:** the hashtag-list subquery repeated three times in `notes/repository.ts` is now one `HASHTAGS_COL` fragment.
- **Alternatives:** scoring in SQL (rejected: the components would not be separately testable, Chapter 4 sequence text);
  storing scores (rejected: stale as soon as a like or verification lands); loading full notes for all candidates
  (rejected: slide HTML for 500 notes per request).
- **Reversibility:** Easy; constants are in config.
- **User review (14 Oct):** Keep; tune after UAT (NFR5). Build the "why am I seeing this" panel showing E, R, V and M per feed card (beyond the IR).

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
- **User review (14 Oct):** Keep. Edit Chapters 1-3 to match the 14 Oct reversals: FR15, FR17 and FR18 are delivered (the requirement-change table shrinks), FR19 stays, and the Chapter 2 token-storage paragraph is rewritten for the httpOnly cookie (D13).

## D26 — Super Like, report queue and account actions API (Sprint 3, task 3B)
- **Path:** Super Like is `POST`/`DELETE /api/notes/:id/verify`, matching every other note route; VER-TC1's test data
  said `/api/posts/P/verify` and was corrected in `4.5_test_cases.md`.
- **Super Like checks:** lecturer role and approved status (403), then 404 for an unknown, draft or invisible note (the
  feed's `getTarget`), 400 for a remark over 300 characters (blank stored as NULL), 409 for the author's own note, the
  same order as reports (D22). A repeat returns 200 with the stored verification unchanged (a new remark is ignored).
  Withdrawal deletes only the caller's row and skips `requireActive`, so a restricted lecturer can still undo (D22
  removal rule; the task spec listed `requireActive` for both routes). It answers with the note's state afterwards,
  because another lecturer's Super Like may keep it verified.
- **Verifier name:** `verifiedBy` is the display name of the earliest valid verifier (same rule as `VERIFIED`, D24),
  shared through `VERIFIED_BY`; `verifiedByMe` (any row by the viewer) drives the "Remove Super Like" toggle. Both are
  in `ENGAGEMENT_COLS` (feed, detail, ranking candidates) and `verifiedBy` is in `SUMMARY_COLS` (saved list, profile
  lists), so every list shows the same name.
- **Report resolution:** per note, not per report: one remark resolves every open report on it; 404 when it has none.
  Open reports on a note its author deleted are excluded from the queue and resolving them returns 404 (ADM-TC19); they
  stay `open` in `"REPORT_T"` rather than being auto-dismissed, because no administrator decided them and the row keeps
  the history (Sprint 3 review).
  Hide only flips a published note to hidden (a deleted note stays deleted). The queue returns the full note so the
  review panel can preview a contacts-only note the admin cannot open through `GET /api/notes/:id`. UC20 step 5
  "notifies the author" is not implemented: there is no notification channel until messaging (Sprint 4).
- **Accounts:** search is a case-insensitive substring match on name or email (`STRPOS`, so `%` needs no escaping),
  first 50 alphabetically, deleted accounts included so their history stays inspectable. Any administrator target,
  including the caller, is 403; a deleted account is 409 for every action (anonymised data cannot be restored); a
  repeated action (suspending a suspended user) is allowed and logged again. Delete sets name "Deleted user", email
  `deleted-<id>@invalid`, clears bio, avatar and staff ID, hides published notes and leaves drafts; the password hash
  stays (login is already refused for deleted accounts, D17). No migration: `"ACCOUNT_ACTION_T"` and `"REPORT_T"`
  already had the columns.
- **Suspension and content:** `VISIBLE` now also requires the author's account to be active or restricted for every
  viewer except the author, so a suspension takes the user's notes out of the feed, note detail, profile lists, saved
  list, comments and engagement routes until reinstated, with no change to the notes themselves (ADM-TC20; Sprint 3
  review). Restricted authors stay visible (restriction limits posting, not past content). The report queue does not
  use `VISIBLE`, so reported notes of a suspended author can still be reviewed. No existing test relied on a suspended
  author's notes staying visible, so none was changed.
- **Tests:** the `lecturerOnlyApp` stand-in was removed; AUTH-TC7 and ADM-TC9/10 now call the real Super Like route.
  `insertNote` moved to `tests/helpers.ts`.
- **Review fixes (3B):** delete also clears programme and lecturer status, and `approvedLecturer` is now NULL-safe
  (`COALESCE`), so a deleted lecturer's comments lose the pin and badge (ADM-TC18). Public search (Sprint 4) must
  exclude deleted accounts. Re-registering with a deleted user's original email is allowed (the old row now holds
  `deleted-<id>@invalid`). A note published in a concurrent request just after the delete's hide UPDATE stays visible
  (accepted; `shortcut:` comment in `moderation/repository.ts`). Withdrawal reports the note state only when the
  lecturer can still see the note, else `{verified: false, verifiedBy: null}`. Ranking candidates select only counts
  and `verified` (`COUNTS_COL`), not the full engagement columns. `decide` (UC22) reuses `requiredText`; a reason stays
  optional only for approval. The client hides "Super Like" from a restricted lecturer but keeps "Remove Super Like".
- **Reversibility:** Easy.
- **User review (14 Oct):** Keep.

## D27 — Super Like and admin console client choices (Sprint 3, task 3B)
- **Super Like button** in the shared `NoteActions`; the card and the note detail own the verify state and pass an
  `onVerify` callback, so the frame and "Verified by <name>" update without a refetch. After a new Super Like the
  label keeps the existing earliest verifier when there is one. "Remove Super Like" acts at once without a dialog
  (reversible, like unlike/unsave). The note detail now also draws the verified frame, as the card does.
- **"Verified by"** text also appears in the saved and profile lists (from `SUMMARY_COLS`, D26).
- **Reports page:** the review panel previews the slides (the admin may not be able to open a contacts-only note) and
  links to the note; the wireframe's third outcome "hide with account action" is Hide note followed by a link to the
  author on the Users page, rather than a combined call.
- **Users page:** the search term lives in the URL (`?q=`), so that link and the back button work; action buttons are
  only those that change the status (no Reinstate for an active account), none for admins or deleted accounts.
- **Reversibility:** Easy.
- **User review (14 Oct):** Keep.

## D28 — Report Chapter 4 written from docs/chapter4 (documentation step 3)
- **Decision:** Chapter 4 text and tables taken from `chapter4/CHAPTER4.md` (as of 13 Oct 23:37, 127 test cases) into the
  D15 outline; the report's own 4.5 headings kept (4.5.1 Introduction, 4.5.2 Unit Testing, 4.5.3 UAT Preparation).
  Numbering continues the document: Figures 84-121, Tables 34-70; in-text references renumbered, and IR references
  pointed at this report (FR table = Table 31, worked example = Table 11, FR15/17/18 changes = Table 33, UC22 = FR19).
- **Added:** an explanatory paragraph beneath every table (22 use case specs, 9 test tables, 5 UAT tables), half a
  page on testing methods in 4.5.1, a 4.6 summary. Light humanizer edits to the source prose (no change of substance).
  Test-case rows sorted by TC number inside each table; Actual Outcome and Pass/Fail blank.
- **Layout:** class diagram (Figure 85) and ERD (Figure 96) on landscape pages (237 mm wide) with their first
  explanatory paragraph; the text continues on portrait pages. Page numbering stays continuous (only the first
  body section restarts at 1). All other diagrams portrait at text width, height-capped (use case and publish
  activity diagrams are tall, so narrower than text width).
- **Schema:** Table 56 in 4.3.2 is the three high-resolution images (schema rule: images); the same schema as an
  editable Word table is a new Appendix H ("Table H1", not a SEQ caption, so the List of Tables is unaffected),
  to avoid four duplicated pages in the counted body.
- **Alternatives:** Word table in the body (rejected: duplicates the images and adds ~4 counted pages); rotating the
  wide diagrams on portrait pages (rejected: same size as landscape, harder to read on screen).
- **Reversibility:** Easy. Re-runnable builder in the session scratchpad; backups `FYP_Submissions/backups/…_2336`
  (before Chapter 4) to `…_2345`.
- **User review (14 Oct):** Keep.

## D29 — Live deployment with CI/CD (user decision, 14 Oct 2026)
- **Decision:** the final demonstration and UAT run on a live deployment. Frontend: Cloudflare Pages on `app.<domain>`.
  Backend: Express + Socket.io on Fly.io (shared-cpu-1x, about $3/month, no cold starts) at `api.<domain>`. Database:
  Neon free Postgres. Domain: the free `.me` domain from the GitHub Student Developer Pack. Both hosts sit under one
  registrable domain, so the httpOnly SameSite=Lax auth cookie (D13 review) is same-site. Pipeline: GitHub Actions runs
  typecheck, tests against a Postgres 17 service container and build on every push and PR; on `main` it runs dbmate
  against Neon and deploys (Pages builds from git, Fly via `flyctl` with a token secret). Local hosting stays as the fallback.
- **Alternatives:** Render free backend (rejected: about 1 min cold start after 15 min idle, bad for UAT); one origin
  with Express serving the client (simplest, kept as the fallback; rejected as the main design because the user wants a
  separate CDN frontend); Vercel/Netlify for the backend (cannot hold Socket.io connections); Render free Postgres (expires
  after 30 days); Supabase (pauses after a week idle, 500 MB); Koyeb (now paid). Source: researcher notes, 14 Oct 2026.
- **Why:** the user values end-to-end delivery (DevOps evidence for the report), and testers can use their own devices.
  Beyond the IR, which documented a free-tier host with local fallback (§2.3.9); the report records the change.
- **Reversibility:** Easy (fallback is local or one origin).

## D30 - Audit quick fixes: verified window and asOf cap (15 Oct 2026)
- **Decision:** a note older than the newest-N window becomes a ranking candidate through a Super Like only if that Super Like
  was made within `RANKING.verifiedCandidateWindowDays` (180) before asOf, so the candidate set no longer grows with every
  Super Like ever given. A future `asOf` on the feed is capped at the database clock (`LEAST(..., NOW())`), because a cutoff
  ahead of now zeroed recency for every note and let later engagement change a "frozen" page. Also fixed in the same pass: note editor reseeding from stale router state,
  `inTransaction` masking the original error when ROLLBACK fails, and sequential profile queries.
- **Alternatives:** reject a future asOf with 400 (rejected: breaks a harmless client clock skew); an index on the Super Like date (out of scope, no migration).
- **Reversibility:** Easy (one constant, one SQL expression).


## D34 - Database tuning: indexes, pool settings, interaction retention (15 Oct 2026)
- **Decision:** migration `20261015000001_query_indexes.sql` adds four indexes: `comment_like_comment_idx` on
  `"COMMENT_LIKE_T" (clk_cmt_id)` (like counts per comment; the primary key leads with the user), `interaction_user_post_time_idx` on
  `"INTERACTION_T" (int_usr_id, int_pst_id, int_created_at DESC)` (the 30-minute view dedupe in `logView`), `report_post_idx` on
  `"REPORT_T" (rpt_pst_id)` (upheld-report counts per note; the existing partial unique index covers open reports only) and
  `message_request_recipient_pending_idx`, a partial index on `"MESSAGE_REQUEST_T" (mrq_recipient_id) WHERE mrq_status = 'pending'`
  (added ahead of the Sprint 4 inbox query, since no code reads `"MESSAGE_REQUEST_T"` yet; re-check it when that query is written). `interaction_user_time_idx` is kept: the ranking interest query filters on user and time range only, which
  the new index cannot serve as well. EXPLAIN on 200,000 seeded interactions and 400,000 comment likes showed an index scan on the
  new index for the dedupe query and a bitmap scan on `comment_like_comment_idx`. The pool reads `PG_POOL_MAX` (10),
  `PG_IDLE_TIMEOUT_MS` (30000) and `PG_CONNECTION_TIMEOUT_MS` (10000, to survive a Neon cold start) from the environment, validated by zod. `"INTERACTION_T"` rows
  older than `RANKING.interestWindowDays` (90) plus `RANKING.purgeGraceDays` (1) are deleted by `purgeOldInteractions`, run daily by an unref'd timer in `server.ts`
  (first run 1 minute after start) and on demand with `npm run db:purge-interactions -w server`.
- **Alternatives:** table partitioning of interactions (rejected: needless at this scale); keeping all history (rejected: ranking
  ignores rows past the window, D24, so they only slow the table); a cron service outside the process (rejected: one more moving part).
- **Why:** the first three indexes serve queries the application already runs; the purge keeps the table bounded; pool limits matter on the
  small Neon and Fly tiers (D29). The delete is idempotent, so several instances running it is harmless. The one-day grace keeps a purge between feed pages from changing the interest vector of later pages, which read a window ending at an earlier asOf.
- **Reversibility:** Easy (drop the indexes through the down migration; remove the timer).

## D35 - JWT in an httpOnly cookie with a CSRF header (R1, 15 Oct 2026)
- **Decision:** implements the D13 user review (14 Oct). Login sets cookie `parp_token`: HttpOnly, SameSite=Lax,
  Path=/, Max-Age 3600 (the JWT lifetime; HS256 unchanged) and Secure when `COOKIE_SECURE` is true (default: only when
  `NODE_ENV=production`, because browsers drop Secure cookies on local http). The token is no longer in any response body.
  Register sets no cookie: the client sends new users to the login page, so a cookie there would leave a hidden live
  session (a risk on shared PCs).
  passport-jwt reads it from that cookie only, through a small extractor over the `Cookie` header (no cookie-parser or
  `cookie` dependency); the `Authorization: Bearer` extractor is removed so no page script can ever hold a token.
  `POST /api/auth/logout` clears the cookie with the same attributes and returns 204 without requiring a valid token.
  CSRF: one middleware in `app.ts` rejects every /api request other than GET, HEAD and OPTIONS (so POST, PUT, PATCH,
  DELETE, login and register included) with 403 `{ error: 'Forbidden' }` unless it carries `X-Requested-With: parp`.
  A cross-site page can only add a custom header through a CORS preflight, and CORS allows only `CLIENT_ORIGIN`
  (now with `credentials: true` and allowed headers Content-Type and X-Requested-With). SameSite=Lax already keeps the
  cookie off cross-site subresource and POST requests; the header covers same-site but cross-origin pages and older
  browsers. The client keeps the user only in React state, learns it from `GET /api/auth/me` on load (a 401 there means
  logged out, with no redirect) and keeps the 401 -> `/login?expired=1` redirect for calls made while signed in.
  Socket.io (Sprint 4) must authenticate its handshake from the same cookie and check `Origin` (messaging README).
- **Alternatives:** double-submit CSRF token (rejected: needs a readable token cookie or an extra endpoint plus client
  plumbing, and buys nothing over a preflighted custom header while CORS is locked to one origin); SameSite=Strict
  (rejected: a user following a link to PARP from email or Moodle would arrive logged out, and Strict alone still does not
  cover same-site subdomains); keeping the bearer header alongside the cookie (rejected: any script that can read a
  token defeats httpOnly); `cookie-parser` (rejected: one regex over one cookie name does the job).
- **Why:** matches IR §2.3.6.2 (Dalimunthe et al., 2022): an XSS bug can no longer exfiltrate the token. Test cases
  AUTH-TC11 to AUTH-TC16.
- **Deploy notes (D29):** still to do: set `COOKIE_SECURE=true` explicitly on Fly rather than relying on
  `NODE_ENV`. `trust proxy` must change from `'loopback'` to trust Fly's edge proxy (R11); otherwise every request appears
  to come from the proxy and all users share one rate-limit bucket. Already done: the client prefixes API calls with `VITE_API_URL` (e.g.
  `https://api.<domain>`, empty in development so the Vite proxy still applies); the cookie stays host-only (no Domain attribute), and `app.` and `api.` share a
  registrable domain, so SameSite=Lax still sends it.
- **Reversibility:** Medium (server extractor, CORS and CSRF middleware, client api wrapper and auth context).

## D37 - Programme catalogue endpoint and admin Modules API (R4, R5, 15 Oct 2026)

- **Decision:** (R4, modifies D17) `GET /api/programmes` (no login, register needs it) returns `{ items }`, the distinct
  `mod_programme` values of `"MODULE_T"` sorted. Register and `PUT /api/users/me` accept a non-empty programme only if
  one `SELECT EXISTS` finds it in the catalogue, else 400 "Choose a programme from the list"; an empty programme still
  clears to NULL (D22). No hard-coded list. (R5, modifies D7) Admin Modules API under the admin router:
  `GET /api/admin/modules` (all modules with `noteCount` of published notes, sorted by code), `POST` (code trimmed and
  uppercased, `^[A-Z0-9][A-Z0-9-]*$` up to 20 characters, which accepts every seeded code; name 1-150; programme 1-100;
  409 on a duplicate code) and `PATCH /:id` (name and/or programme; the code is immutable because notes and the
  dissertation refer to it; 404 unknown id; 400 when nothing changes). Queries live in `features/modules/repository.ts`.
  No delete, as it was not requested.
- **Renaming a programme** is allowed (PATCH `programme`). Users keep their old value until they change it, so
  `PUT /api/users/me` also accepts the programme the user already holds, otherwise a legacy or renamed value would block
  every profile save. A malformed module id is 404, like the users router; the PATCH body is strict, so a `code` field is 400.
- **Client:** the registration and Edit Profile dropdowns and the admin Modules page come with the client redesign;
  this change is backend only.
- **Why:** consistent programme values for FR4 programme search, and the catalogue stays editable without a migration.
  Test cases AUTH-TC17, AUTH-TC18, USR-TC22, USR-TC23, ADM-TC21 to ADM-TC28.
- **Alternatives:** a programmes table (rejected: the catalogue already carries the programme, and a new table adds a
  migration for no new data); hard-coded list (rejected, drifts from the catalogue).
- **Reversibility:** High (two small routes and one repository file).

## D38 - Follows replace contacts; friends are mutual follows; Following feed (R2, 15 Oct 2026)
- **Decision:** implements the D9 user review (14 Oct). Migration `20261015000002_follows.sql` creates `"FOLLOW_T"`
  (`fol_follower_id`, `fol_followee_id`, `fol_created_at`; primary key on the pair, `CHECK` follower <> followee, index
  `follow_followee_idx` on the followee), copies every `"CONTACT_T"` row into it in both directions (skipping pairs with a deleted user) and drops
  `"CONTACT_T"`; the down migration recreates `"CONTACT_T"` from mutual pairs only. Anyone (student or lecturer) may follow
  anyone, and one-way follows are allowed. Two users who follow each other are **friends**; the `friends(a, b)` SQL helper in
  `users/repository.ts` (two `EXISTS` on `"FOLLOW_T"`) is the one definition, and the notes `VISIBLE` fragment uses it, so a
  contacts-only note (`pst_visibility` 'contacts', label unchanged for now) is visible to the author's friends only, in every
  route that already used `VISIBLE` (feed, note detail, profile lists, engagement, Super Like). This supersedes the D21
  "Contacts" bullet.
- **API:** `POST /api/users/:id/follow` (`requireActive`): 201 new, 200 already following, 400 "You cannot follow
  yourself", 404 "User not found" when the target is unknown or deleted. A suspended user can be followed: the rule is "if you
  can open the profile, you can follow it", so follow gives no way to probe whether an account is suspended (its notes are
  already hidden by `VISIBLE`, and counts and lists already leave it out). `DELETE /api/users/:id/follow` is 200 and
  idempotent, 404 for an unknown or deleted user, without `requireActive` (D22 removal rule). Both answer with the target's follow state
  `{followerCount, followingCount, followedByMe, followsMe, isFriend}`, which `GET /api/users/:id` now also carries.
  `GET /api/users/:id/followers` and `/following` return `{items: [{id, displayName, role, isVerifiedLecturer, followedByMe,
  isFriend}], nextCursor}`, 20 per page, newest follow first; 404 for an unknown or deleted user (the profile rule), 400
  "Invalid cursor". Counts and lists leave out deleted and suspended accounts. Admin account deletion deletes the user's
  follow rows in both directions in the same transaction.
- **Cursor:** keyset on (`fol_created_at`, user id), sent as `<microseconds since epoch>_<id>` and built in SQL, because a
  JavaScript `Date` holds milliseconds only and a millisecond cursor would skip follows made within the same millisecond.
- **Following feed:** `GET /api/feed?tab=following` lists visible published notes by followed authors, newest first, with the
  same `page`/`asOf` paging and response shape as the ranked feed but without `score` and `components`. It is chronological
  rather than ranked because a user who opens it has already chosen the authors; the value is "what is new from people I
  follow", and ranking would hide a followed author's latest note behind older popular ones. The ranked For You feed stays the
  default; any other `tab` value is 400 "Invalid tab".
- **Messaging (Sprint 4):** friends message directly; a non-friend's first message is a request (FR6), and approving it opens
  that conversation only, without making the two users friends.
- **Not changed:** the client (the UI waits for the redesign); Chapter 4 use cases, activity and sequence diagrams that still say
  "contact" (UC04, UC10, UC15-UC18, Figures 4.7 and 4.12) and the ERD image.
- **Alternatives:** keeping `"CONTACT_T"` beside follows (rejected: two relationships for one idea); a friends table maintained
  on each follow (rejected: a derived fact that can drift; two indexed `EXISTS` are cheap); offset paging for follower lists
  (rejected: rows shift as people follow and unfollow); a ranked Following feed (rejected, see above).
- **Tests:** USR-TC12 to USR-TC21 and USR-TC24 (cursor tie-break), RANK-TC21 to RANK-TC23; NOTE-TC7 and USR-TC4 fixtures now use follows.
- **Reversibility:** Medium (one migration with a down step that keeps mutual pairs; one-way follows are lost on rollback).

## D40 - Scale and payload fixes: feed snapshot, paged lists, shared write limit (R25, 15 Oct 2026)
- **Rank once per asOf (audit #2):** migration `20261015000003_feed_snapshot.sql` adds `"FEED_SNAPSHOT_T"` (`fsn_usr_id`,
  `fsn_as_of`, `fsn_pst_ids INTEGER[]` in ranked order, `fsn_scores DOUBLE PRECISION[]` holding `[score, E, R, V, M]` per id,
  `fsn_created_at`; primary key (viewer, asOf), index on `fsn_created_at` for the purge). The first request for an asOf (page 1, or
  any page whose snapshot is missing) ranks the candidates as in D24 and stores the result; a request that sends an `asOf` reads its
  slice with array slicing (`fsn_pst_ids[11:20]`) and skips the candidate, interaction and scoring work. The API is unchanged. Snapshots
  older than `RANKING.snapshotTtlHours` (2) are deleted by the daily purge (D34) and, for one viewer, whenever that viewer stores a new
  one; a page requested after its snapshot expired is simply recomputed. The snapshot lives in Postgres, so any instance can serve the
  next page. It also closes the D24 gap: an unlike, a deleted comment or a suspended verifier between pages no longer reorders later
  pages for the same asOf (a note hidden or deleted since still drops out, because the page's notes are loaded through `VISIBLE`).
  Measured on the test database with 500 notes (5 slides each, about 2,500 likes, 167 viewer interactions), mean of 20 requests through
  Supertest: page 1 30.0 ms, page 2 from the snapshot 10.1 ms, page 2 recomputed 31.5 ms.
- **Report queue (audit #4):** `GET /api/admin/reports` returns summaries (id, title, status, module, author id and name, report
  count, oldest report time, the open reports) without slides, 20 per page, keyset on (oldest open report, note id) with `nextCursor`.
  Keyset rather than offset paging because the queue shrinks while an admin works through it: with offsets, resolving five groups on
  page 1 would make page 2 skip five. `GET /api/admin/reports/:noteId` returns the full note with its open reports (404 when it has
  none or was deleted, 400 for a malformed id); `AdminReports.tsx` fetches it when a group is opened and shows only the first page until
  the redesign adds "load more".
- **Unbounded lists (audit #5):** comments, `GET /api/bookmarks`, profile notes and `GET /api/notes/drafts` take `?cursor=` and
  `?limit=` (default 50, 1-100) and answer `nextCursor`; without a cursor they return the first page, so the current client keeps
  working. Cursors are microseconds since the epoch built in SQL, as in D38: bookmarks on (saved at, note id), drafts on (updated at,
  id), profile notes on (published at, id). The profile response embeds its first 50 notes plus `notesNextCursor`, and the new
  `GET /api/users/:id/notes` continues from it (404 for an unknown or deleted user). Comments keep the ENG-TC7 order (approved
  lecturer first, most liked, oldest), now applied in SQL so it can be paged, with the cursor `<0 pinned|1>_<likes>_<micros>_<id>`;
  replies come with their top-level comment and are not paged. Likes are live, so a comment liked between two page requests can cross
  the page boundary (accepted; the client can drop ids it already shows). A malformed cursor or limit is 400 "Invalid cursor" / "Invalid
  limit". The parsing (zod), the microsecond SQL fragments and the page split are one module, `lib/keyset.ts`, which the D38 follower
  lists now use too.
- **Write rate limit (audit #6):** every POST, PUT, PATCH and DELETE under /api passes `writeLimiter`, 120 per minute keyed by the user
  id in a valid auth cookie (verified with the JWT secret, before `requireAuth` runs) or the client IP when signed out; login and register
  keep their 10 per minute per IP. Both count in `"RATE_LIMIT_T"` (`rlt_key`, `rlt_window_start`, `rlt_hits`; migration
  `20261015000004_rate_limit.sql`) through `PgStore`, a small implementation of express-rate-limit's `Store` (one UPSERT per hit that
  starts a new fixed window when the old one has passed), so the limits hold across instances with no new dependency. Settings are in
  `RATE_LIMITS` in `features/auth/rateLimit.ts`; the daily purge deletes expired counters. Still skipped under `NODE_ENV=test`; the
  store itself is tested directly.
- **Alternatives:** an in-memory snapshot cache (rejected: lost on restart and not shared by instances); storing full feed items
  (rejected: stale counts, and slide HTML for 500 notes); offset paging for the four lists (rejected: rows shift as users add and remove
  them); a Redis store or `rate-limit-postgresql` (rejected: a new service or dependency for one UPSERT); a per-route write limit
  (rejected: one limit for all writes is simpler and still stops a script flooding comments or likes).
- **Not changed:** the client lists beyond AdminReports (the redesign adds "load more"); Chapter 4.3 ERD and schema table do not show
  the two new tables yet.
- **Tests:** RANK-TC24, RANK-TC25, ADM-TC29, ADM-TC30 (ADM-TC16 now expects no slides), ENG-TC18, ENG-TC19, NOTE-TC26, USR-TC25,
  AUTH-TC19.
- **Reversibility:** Easy (two migrations with down steps; the list routes accept the old call unchanged).
