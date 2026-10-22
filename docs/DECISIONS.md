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

## D2 — FR15 filter by lecturer and academic term: **rework** (restored in full by the user, 14 Oct; see User review)
- **Rework:** search results get two filters: *lecturer content* (posts authored by, or Super-Liked
  by, a lecturer) and *published date range*. "Academic term" is not modelled as an entity; APU
  intakes and terms differ per programme, so a date range expresses the same need without a term
  calendar that someone would have to maintain.
- **Alternatives:** full TERM_T table maintained by admin (rejected: admin workload, no data source);
  cut entirely (rejected: lecturer search had 31.3% support in D5 and filters are cheap once FR4 exists).
- **Reversibility:** Easy (filters are query parameters).
- **User review (14 Oct):** **Modify.** Keep the lecturer-content filter and custom date range, and restore the academic-term filter through a seeded term catalogue (`"TERM_T"`: name, start date, end date, loaded by migration like `"MODULE_T"`); choosing a term filters by its dates. FR15 is then delivered as written in the IR. Shape confirmed 14 Oct: the lecturer filter also offers one named lecturer.

## D3 — FR17 background audio on slide notes: ~~cut~~ **restored by the user, 14 Oct** (Jamendo, D43)
- **Alternatives:** keep as Sprint 4 stretch; rework as a link to external audio.
- **Why:** lowest-supported feature (53.1% useful, 18.8% below moderate, IR §3.3.3.3 already flags it
  as deferrable). It needs file upload, storage, size limits and copyright moderation of audio, none of
  which serve the four objectives. With sprints compressed to one week, the time goes to FR1-FR7.
  Chapter 6 lists it under future enhancements.
- **Reversibility:** Medium (adds an upload pipeline later; schema change is one nullable column).
- **User review (14 Oct):** **Reverse.** FR17 is built. The author searches Deezer from the editor (through a server proxy: the Deezer API needs no key but sends no CORS headers) and attaches one track; the note stores provider, track id, title, artist and cover only, with no audio stored on our side. The slide viewer loops the 30-second preview behind the slides with a play/pause control; the preview URL is signed and expires, so it is fetched fresh when the note plays. If Deezer is unreachable the note works without audio. 30-second previews are acceptable (user). Alternatives considered: own upload (storage and copyright moderation), Spotify (new apps get no preview URLs, playback only through the visible embed), MusicBrainz (metadata only, no audio), YouTube (quota of about 100 searches a day; its policies forbid audio-only playback).

## D4 — FR18 peer/lecturer annotation of notes: ~~cut~~ **restored by the user, 14 Oct** (text-anchored, R10)
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

## D9 — "Contact" is created by an accepted message request (superseded by follows, D38)
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

## D29 — Live deployment with CI/CD (user decision, 14 Oct 2026; host superseded by Render, D65)
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

## D31 - Canva-style slide editor, author-chosen slide size, images (user decision, 15 Oct 2026)
- **Decision:** FR8's editor becomes a free-form canvas: each slide is a fixed-size board holding positioned elements
  (text boxes with rich text, shapes, lines, images, code blocks, later video) with templates, deck themes, a curated
  font list, colours, alignment, layers and undo, modelled on Canva's editor layout. The author picks the slide size per
  note: 4:5, 9:16 or 16:9. Images come from uploads (JPEG/PNG/WebP up to 5 MB, re-encoded on the server, stored in
  Cloudflare R2) or a stock-photo search through the Unsplash API. Slides change from one sanitised HTML block to a
  validated JSON list of elements; text inside elements is still sanitised against the allow-list, and the search
  document is built from the text elements. The canvas is DOM-based, not `<canvas>`, so slide text stays selectable for
  FR18 annotations and readable by screen readers. Plan items R21 and R22.
- **Alternatives:** structured layouts with rich styling only (smaller, but not the Canva-like authoring the user wants);
  keeping the flowing TipTap editor with fonts and colours added (smallest, rejected for the same reason); a `<canvas>`
  renderer such as Konva (rejected: text is not selectable, which breaks annotations and accessibility).
- **Why:** the editor is the core authoring feature (Objective 3) and the user wants it comparable to tools students
  already use.
- **Reversibility:** Hard once notes exist in the new format (needs a data migration); decided before any production data.

## D32 - Short video element on slides (user decision, 15 Oct 2026)
- **Decision:** a slide may hold one video element: MP4 or WebM, up to 90 seconds and 50 MB, type, size and duration
  validated on the server, stored in R2 with a poster frame, no transcoding. It autoplays muted in the feed and the
  viewer taps for sound. Plan item R29, sharing R22's upload pipeline.
- **Alternatives:** YouTube or Vimeo links only (no storage, less like the TikTok-style feed); no video.
- **Reversibility:** Medium.

## D33 - Optional AI writing assistant in the editor (user decision, 15 Oct 2026)
- **Decision:** the editor gets an optional assistant that turns messy text or an imported file (.txt, .md, .docx, .pdf,
  .pptx) into a draft deck, and rewrites, shortens or makes quiz questions from a selected text box. Calls go from the
  server to any OpenAI-compatible provider configured by `AI_BASE_URL`, `AI_API_KEY` and `AI_MODEL`; output is
  validated against the slide element schema and always lands as an editable draft. Notes made with it carry an
  "AI-assisted" label, and each user has a daily limit. The ranking feed stays a deterministic heuristic. Plan item R28.
- **Scope note:** this reverses the IR's exclusion of AI components (IR Section 1.6), so the report's scope and
  limitations sections must record it as an extension added during Part II, with its academic-integrity safeguards
  (label, author must edit and publish).
- **Alternatives:** leave it to future work (keeps the IR exclusion); decide after supervisor meeting #2.
- **Reversibility:** Easy (feature behind configuration; without a key the assistant is hidden).

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

## D36 - Number not used
- Left unassigned when parallel branches reserved numbers on 15 Oct 2026; nothing refers to it.

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
  keyset paging as the other lists (D40, `lib/keyset.ts`) on (`pst_published_at`, id): `?cursor=` and `?limit=` (default 10, 1-100) with the `asOf` cutoff, answering `{items, nextCursor, asOf}` (400 "Invalid cursor" / "Invalid limit"), without `score` and `components`; keyset rather than offset because a note published or deleted between two requests would shift every later offset. It is chronological
  rather than ranked because a user who opens it has already chosen the authors; the value is "what is new from people I
  follow", and ranking would hide a followed author's latest note behind older popular ones. The ranked For You feed stays the
  default; any other `tab` value is 400 "Invalid tab".
- **Messaging (Sprint 4):** friends message directly; a non-friend's first message is a request (FR6), and approving it opens
  that conversation only, without making the two users friends.
- **Not changed:** the client (the UI waits for the redesign); Chapter 4 use cases, activity and sequence diagrams that still say
  "contact" (UC04, UC10, UC15-UC18, Figures 4.7 and 4.12) and the ERD image.
- **Alternatives:** keeping `"CONTACT_T"` beside follows (rejected: two relationships for one idea); a friends table maintained
  on each follow (rejected: a derived fact that can drift; two indexed `EXISTS` are cheap); offset paging for follower lists
  (rejected: rows shift as people follow and unfollow); offset paging for the Following feed (rejected for the same reason); a ranked Following feed (rejected, see above).
- **Tests:** USR-TC12 to USR-TC21 and USR-TC24 (cursor tie-break), RANK-TC21 to RANK-TC23; NOTE-TC7 and USR-TC4 fixtures now use follows.
- **Reversibility:** Medium (one migration with a down step that keeps mutual pairs; one-way follows are lost on rollback).

## D39 — CI pipeline on GitHub Actions (R11/R26)
- **Decision:** one workflow job runs typecheck, tests (Postgres 17 service, `parp_test` created with psql), build and a production-only `npm audit --audit-level=high` on every push and PR to `main`; it creates an empty `.env` because the dbmate npm scripts require the file (D29 covers deployment).

## D40 - Scale and payload fixes: feed snapshot, paged lists, shared write limit (R25, 15 Oct 2026)
- **Rank once per asOf (audit #2):** migration `20261015000003_feed_snapshot.sql` adds `"FEED_SNAPSHOT_T"` (`fsn_usr_id`,
  `fsn_as_of`, `fsn_pst_ids INTEGER[]` in ranked order, `fsn_scores DOUBLE PRECISION[]` holding `[score, E, R, V, M]` per id,
  `fsn_created_at`; primary key (viewer, asOf), index on `fsn_created_at` for the purge). The first request for an asOf (page 1, or
  any page whose snapshot is missing) ranks the candidates as in D24 and stores the result; a request that sends an `asOf` reads its
  slice with array slicing (`fsn_pst_ids[11:20]`) and skips the candidate, interaction and scoring work. The API is unchanged. Snapshots
  older than `RANKING.snapshotTtlHours` (2) are deleted by the daily purge (D34) and, for one viewer, whenever that viewer stores a new
  one, and the same write also keeps only that viewer's newest `RANKING.snapshotsPerViewer` (4), so reloading page 1 many times within the TTL cannot grow the table; a page requested after its snapshot expired or was dropped is simply recomputed. The snapshot lives in Postgres, so any instance can serve the
  next page. It also closes the D24 gap: an unlike, a deleted comment or a suspended verifier between pages no longer reorders later
  pages for the same asOf (a note hidden or deleted since still drops out, because the page's notes are loaded as published and through `VISIBLE`, so a snapshot cannot leak it, even to the author who still sees a hidden note elsewhere; RANK-TC27, RANK-TC28).
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
- **Client until the redesign:** CommentPanel asks for `?limit=100` so new comments are not lost past 50 top-level comments; Saved,
  Drafts and Profile show their first 50; each carries a `shortcut:` comment, and "load more" comes with the redesign. AdminReports
  reloads the queue when resolving empties the loaded page and more groups exist.
- **Report follow-up:** the Chapter 4.3 ERD and schema table must gain `"FEED_SNAPSHOT_T"` and `"RATE_LIMIT_T"`; they do not show them yet.
- **Review fixes:** the comments query filters on `cmt_pst_id` in the outer select and in the reply `EXISTS`, so both scans use
  `comment_post_idx` (EXPLAIN on 60,000 comments: index scan for the top-level page, bitmap index scan for the rows and replies);
  `tokenSubject` and the JWT strategy share one verify-options constant (AUTH-TC20 covers forged and expired tokens).
  The "deleted comment still has live replies" check was an `EXISTS` inside an `OR`, which the planner turned into a hash of every
  live reply in `"COMMENT_T"` (a full seq scan of 50,000 rows whenever the note had a deleted top-level comment). Migration
  `20261015000005_comment_parent_index.sql` adds the partial index `comment_parent_idx` on `cmt_parent_id` (non-null only), and the
  check is now a `LEFT JOIN LATERAL ... LIMIT 1` that probes that index once per deleted comment (a one-time filter skips the rest).
  EXPLAIN ANALYZE on 60,000 comments, for a note with 50 deleted top-level comments (half with live replies): index scan on
  `comment_parent_idx` (50 probes), no seq scan of `"COMMENT_T"`, 9.3 ms down to 1.2 ms.
- **Tests:** RANK-TC24 to RANK-TC27, ADM-TC29, ADM-TC30 (ADM-TC16 now expects no slides), ENG-TC18, ENG-TC19, NOTE-TC26, USR-TC25,
  AUTH-TC19, AUTH-TC20.
- **Reversibility:** Easy (two migrations with down steps; the list routes accept the old call unchanged).

## D41 - Observability and graceful shutdown (R18, 15 Oct 2026)
- **Context:** the server logged with `console.*`, had no way to tie a log line to a request, no error tracking and no clean stop on
  deploy (Fly sends SIGTERM/SIGINT), so in-flight requests and pool connections were dropped.
- **Decision:** `lib/logger.ts` holds one pino logger plus `pino-http` middleware mounted first in `app.ts`. It logs JSON, redacts
  set-cookie and password fields, and is silent under `NODE_ENV=test`. The request id is the caller's
  `X-Request-Id` when it matches `[A-Za-z0-9._-]{1,64}`, else `crypto.randomUUID()`, and is echoed in the response header. Health checks
  are not logged. Pretty printing was left out (`pino-pretty` is not a dependency; plain JSON is readable enough in dev).
- **Sentry:** `lib/errorReporting.ts` imports `@sentry/node` dynamically only when `SENTRY_DSN` is set (zod-validated optional URL), so
  without it there is no load and no network traffic. The central error handler calls `reportError(err, { requestId })` for 5xx only;
  Sentry receives 5xx route errors plus uncaught crashes and no request data (`beforeSend` deletes `event.request`, since the URL or query can carry a searched email). The request log serialises only id, method and path, never headers.
- **Shutdown:** `server.ts` handles SIGTERM/SIGINT once: `server.close`, clear the purge timers, wait up to `SHUTDOWN_TIMEOUT_MS`
  (10 s), `pool.end()`, exit 0. A second signal or the timeout exits 1. Each step is logged. `fly.toml` needs `kill_timeout = 15` because shutdown waits up to 10 s. When Socket.io arrives (Sprint 4), `io.close()` must run before `server.close`.
- **Readiness:** `GET /api/health` already ran `SELECT 1` and answered `{ status, db }` with 503 when it failed; kept, and the 503
  path is now tested (OPS-TC2) by making `pool.query` reject once.
- **Versions:** pino 10.3.1 (10.4.0 is under two weeks old), pino-http 11.0.0, @sentry/node 10.75.3 (11.x and later 10.76 are under
  two weeks old; adds 19 packages).
- **Alternatives:** winston (slower, no request middleware of this quality); always loading Sentry (rejected: breaks the "no network
  without a DSN" rule); a shutdown helper module (rejected: one caller).
- **Tests:** OPS-TC1 to OPS-TC4 (TC4 checks log redaction). The signal handling itself is not unit tested.
- **Reversibility:** Easy (remove the middleware, logger and handlers; no data or schema change).

## D42 - Client test foundation: jsdom and React Testing Library (R26 part 1, 15 Oct 2026)
- **Context:** the client had one logic test, and none of the auth, API-wrapper or route-guard behaviour added by D35 and the R1/R25 fixes.
- **Decision:** dev dependencies `jsdom` 30.1.1, `@testing-library/react` 16.3.3, `@testing-library/dom` 10.4.2 (RTL peer) and
  `@testing-library/user-event` 14.6.7, all exact and over two weeks old (newer patch releases of jsdom and user-event were not).
  The default Vitest environment stays node; only files that render React start with `// @vitest-environment jsdom`, so pure
  logic tests (api.ts, roles.ts, hashtags.ts) do not pay for jsdom. `fetch` is stubbed per test; nothing reaches a server.
  Tests are behaviour-first (visible text, roles, redirects, thrown errors) and avoid class names and DOM structure, because the
  frontend redesign is pending and should not break them. Cases are CLI-TC1 to CLI-TC14 in Chapter 4.5.
- **Alternatives:** happy-dom (rejected: less complete, RTL and jsdom are the documented pair); snapshot tests (rejected: break on
  every redesign); a Vitest workspace or `environmentMatchGlobs` (rejected: a per-file pragma is one line and explicit).
- **Next:** Playwright end-to-end tests run against the real app after the redesign (R26 part 2).
- **Reversibility:** Easy (dev dependencies and test files only; no runtime code changed).

## D43 - User decisions after the overnight run (15 Oct 2026, morning)
- **Wireframes v2 accepted in direction**, with changes (plan R32): lower fidelity (main labels only, descriptive copy as
  lorem ipsum), produced as SVG for import into a Figma project; keep every designer extra (page notes, duplicate
  slide/draft, pinned profile notes, follower/following/like counts, curated fonts, Unsplash credit, module rename);
  the visibility label becomes **"Friends only"**; the **"For You" tab becomes "Feed"**.
- **Editing:** authors can edit a published note at any time (content, details, music); D21's rule that a published
  note cannot return to draft still holds.
- **New features to specify** (interview first): collaboration with view/edit share links, owner-managed access
  (anyone with the link or invited users), and requests from viewers to collaborate (R30); guest browsing of the feed
  without an account, with search, comments, messaging and other actions prompting login or registration (R31).
- **Editor spec (R21) answers:** add a table/text-grid element; whole-box text styling agreed; `shared/` workspace;
  500 MB per-user quota with automatic compression, GIFs stored as still WebP; assets reusable across notes; local
  unsaved-changes backup for published notes accepted if its costs stay small (see the R21 spec update); ffmpeg via the
  production route (system ffmpeg in the Docker image and CI, installed locally), not npm binary downloads.
- **FR17 music switches from Deezer to Jamendo** (Creative Commons catalogue, free API key): Deezer's terms limit use
  to private, family-scope use, which a public demo would breach. Supersedes the Deezer parts of D3's review and D31.
- **UC17 "Chat with Friend"** and **UC18 group chats limited to friends** confirmed.
- **AI assistant (D33):** provider Groq, model `openai/gpt-oss-120b`, configured by the user in `.env`.
- The decisions logged without the user overnight (D30-D42) are accepted.

## D44 - Collaboration (R30) and guest browsing (R31) specs (15 Oct 2026, user interview)
**R30 collaboration**
- Any note can be shared, draft or published. An edit never resets `pst_published_at`; engagement stays with the note;
  a content edit after a Super Like marks the note "edited since verification" and removes V until the lecturer
  re-confirms (lecturer notified through R8); hashtag edits change M at once; the note also appears in the Following
  feed of each co-author's followers.
- Owner access options: view link and edit link (random tokens, revocable and regenerable), invite specific users with
  view or edit, and viewer requests to collaborate that the owner approves or declines from notifications. A view link
  opens a draft or friends-only note for that token only.
- Co-authors edit content (slides, hashtags, music) only; the owner alone publishes, deletes, changes visibility and
  manages access. Co-authors are credited on the card.
- One editor at a time (soft lock plus the `baseUpdatedAt` 409 check). Real-time co-editing (Yjs over Socket.io) is a
  stretch goal for the December buffer; if unbuilt it goes to Chapter 7 as future work.

**R31 guest browsing**
- Signed-out visitors land on a short Welcome page (Browse as guest, Log in, Register).
- Guests can read the Feed (public notes only, M = 0, snapshot keyed by IP and asOf), open a note with its comments,
  view public profiles and search public notes. This reverses D43's "search prompts login".
- Like, save, comment, report, follow, message and create open a Log in / Register sheet that returns the visitor to
  the same note afterwards. Friends-only and private notes never reach guests; guest endpoints are rate-limited by IP.

## D45 - Guest browsing on the server (R31, 15 Oct 2026)
- **Context:** D44 lets signed-out visitors read the Feed, a note with its comments, and public profiles; everything else stays signed-in.
- **Decision:** `optionalAuth` (next to `requireAuth`) attaches the user for a valid cookie and otherwise treats the request
  as a guest, including an invalid or expired cookie, so a stale session degrades to guest reading instead of a 401. Such
  responses carry `X-Viewer: guest` (exposed through CORS); the client treats it like a 401 while it believes it is signed
  in, so an expired session still reaches the session-expired login (CLI-TC19) instead of silently browsing as a guest. A guest
  is viewer id 0 (`GUEST_ID`), which matches no account, so the existing `VISIBLE` rule passes only published public notes by
  active or restricted authors and every per-viewer flag (liked, saved, follows) is false; no query was duplicated. Guests
  have no interest history, so M = 0. Views are only logged by an authenticated endpoint, so guests log nothing.
- **Snapshot:** every guest gets the same ranking for one asOf, so no IP key is needed (D44 suggested one). Guest rankings
  are not stored in "FEED_SNAPSHOT_T" (`fsn_usr_id` is a foreign key to "USER_T"); page 1 keeps the ranking in an
  in-process Map keyed by the cutoff, capped at `RANKING.guestRankingCacheSize` (50) with the oldest dropped, and later
  guest pages with that asOf read their slice from it. Re-ranking per page was rejected: an unlike deletes the like row,
  which changes E even at an old asOf, so pages could skip or repeat a note (RANK-TC31). The cache is per process and is
  not shared across Fly machines (R27); marked as a `shortcut:` in `feed/service.ts`.
- **Rate limit:** guest reads are limited to 120 per IP per minute (`RATE_LIMITS.guestReads`) on the shared Postgres store
  (D40); a scrolling reader uses about 20, so several guests behind one campus NAT still fit. Signed-in reads are not
  counted. The key is `req.ip`, so `trust proxy` must be set for the host before deploy (the D35 pre-deploy item). That
  change must use the hop count `1` (or read `Fly-Client-IP`), never `true`: with `true` a client can forge
  `X-Forwarded-For` to bypass the guest limit, and with the current `'loopback'` every guest behind Fly's proxy shares one bucket.
- **Tests:** AUTH-TC21, NOTE-TC27, ENG-TC20, ENG-TC21, USR-TC26, RANK-TC29 to RANK-TC31, CLI-TC19; RANK-TC10 and USR-TC5 changed
  because the feed and profile no longer return 401 without a cookie.
- **Reversibility:** Easy (swap `optionalAuth` back to `requireAuth` on five routes; no schema change).

## D46 - Collaboration on the server (R30, 15 Oct 2026)
- **Context:** D44 and the R30 backend spec: collaborators, view and edit links, requests, a soft lock, and edits that
  must not reset publication but must void stale lecturer verification. UI waits for wireframe sign-off.
- **Schema:** one migration adds "COLLABORATOR_T", "SHARE_LINK_T", "COLLAB_REQUEST_T" and `pst_content_edited_at`,
  `pst_lock_usr_id`, `pst_lock_expires_at` on "POST_T". Partial unique indexes enforce one active link per note and role and
  one pending request per note and user; check constraints keep the lock pair and `crq_decided_at` consistent.
- **Access rule:** the existing `VISIBLE` is unchanged, so likes, comments, bookmarks, search and ranking ignore
  collaboration. A separate `SHAREABLE` rule (draft or published, author active or restricted) gates every collaborator
  and link path, so hidden or deleted notes and suspended authors give no access. `GET /api/notes/:id` reads
  `VISIBLE OR collaborator`; the link route reads any `SHAREABLE` note once the token resolves.
- **Edit links join by POST:** the spec put joining on `GET /api/share/:token`. A GET that writes would skip the CSRF
  header check and the write limiter (D35, D40) and could be triggered by a prefetch, so GET only resolves the link (an
  edit link needs a login) and `POST /api/share/:token` (signed in, active) joins. The owner redeeming their own link
  gets role `owner` and no row; a view collaborator redeeming an edit link is upgraded.
- **Tokens:** 32 bytes from `crypto.randomBytes`, base64url (43 characters); only the SHA-256 hex is stored and looked
  up by equality on a unique index, so no timing-sensitive comparison is needed. The raw token appears only in the create
  response. Malformed tokens answer 404 without a query. `GET /share/:token` uses the guest IP limiter for signed-in users
  too, since `optionalAuth` only limits guests.
- **Optimistic check:** no `baseUpdatedAt` existed before R30. It is required from editors and optional for the owner, so
  the current editor client keeps working until the frontend sends it. The check, the lock check and the update run in
  one transaction with `SELECT ... FOR UPDATE`; timestamps compare at millisecond precision because that is what the
  client receives. An owner's PUT is also refused with 423 while an editor holds a live lock.
- **Publication time and V:** `replaceNote` keeps `COALESCE(pst_published_at, NOW())`, so an edit never moves it. A title
  or slide change to an already published note stamps `pst_content_edited_at`; hashtag, template and draft edits do not
  (publishing a draft is not a content edit). `VALID_VERIFICATIONS` now joins "POST_T" and drops Super Likes older than
  that stamp, so V, the badge, `verifiedBy` and the ranking candidates all follow one rule. `editedSinceVerification` is
  true when any counting Super Like predates the edit, even if another lecturer has re-confirmed. A repeat
  `POST /notes/:id/verify` moves only a stale row's `ver_created_at` to now and still answers 200. Known limit: the rule
  compares against the latest edit, not the feed's asOf, so an edit after page 1 changes V if the ranking were recomputed
  for that asOf; stored snapshots (D40) and the guest cache (D45) keep pages stable, and the next page 1 picks it up.
- **Requests:** a view collaborator may request edit access (the spec said "non-collaborator"; asking for an upgrade is
  the obvious use). Owners get 400, editors 409. Approving upserts the collaborator with the chosen role (default edit).
- **Smaller choices:** co-authors are `{id, displayName}` because "USER_T" has no username column; suspended or deleted
  co-authors are left out of the credit. Music is in the spec's editable fields but no music field exists yet, so there
  is nothing to guard. Removing a collaborator also releases their lock. The lock TTL (120 s), token size and request
  message limit live in `collaboration/config.ts`, not the ranking config. R8 notifications will read the pending
  requests and `editedSinceVerification`; there is no separate list endpoint for lecturers yet.
- **Review fixes (same day):**
  - Credit only after the first edit: `clb_edited_at` is set on an editor's first successful save. `coauthors` and the
    Following-feed reach use only edit collaborators with that stamp, so an owner cannot put someone's name on a note or
    push it to their followers by inviting them. Access itself is unchanged: an invited editor can read and edit at once.
  - Edit collaborators count as authors for like (400) and Super Like (409), so a co-author cannot raise E or V of their
    own work. View collaborators can still like.
  - The request log replaces `/api/share/<token>` with `/api/share/[token]` (`logPath`), since a token grants access.
  - `GET /api/notes/:id` (and the share-link GET) add `myRole` (`owner`, `edit`, `view` or null) for the editor UI; the
    feed does not carry it.
  - Co-authors may edit, lock or join an edit link only while the author is `active` (UC21); reading is unchanged.
    `replaceNote` re-checks the editor's role under `FOR UPDATE`, link regeneration locks the note row so concurrent
    requests cannot break the one-active-link index, a downgrade to view frees that user's lock, and a re-confirmation
    updates the remark when one is sent.
- **Tests:** COL-TC1 to COL-TC24, OPS-TC5.
- **Reversibility:** Medium. The migration has a down step; dropping the feature means reverting the PUT role check,
  `VALID_VERIFICATIONS` and the Following-feed clause.

## D47 - User decisions, 16 Oct 2026 (early morning): likes, suspension, Vite+, Sprint 4
- **Confirmed:** D45's shared in-process guest ranking cache; D46's co-author credit only after a first edit; an owner's
  or co-author's title/slide edit drops V until a lecturer re-verifies the latest version.
- **Self-likes (reverses part of D46):** an author or co-author may like their own note and the like shows in the count,
  but the ranking engagement score E ignores likes by the author or any edit collaborator, so nobody boosts their own
  note. Super Like by a co-author lecturer stays blocked (FR1/FR2 conflict of interest).
- **Suspension (D26 applied to the public):** a suspended user's profile, notes and comments are hidden from everyone
  except admins, guests and signed-in users alike (comments show as "comment unavailable", like deleted ones).
- **Vite+ adopted:** move the workspace from Vite 8 + Vitest 5 to Vite+ (`vite-plus`, MIT), pinned to 1.0.0 (28 Sep,
  passes the two-week rule). Justification for Chapter 2: Vite+ keeps the same Vite core (Rolldown) and Vitest, so the
  IR's Vite choice and its rationale stand; it adds what the project lacked, linting (Oxlint) and formatting (Oxfmt),
  behind one CLI (`vp dev/build/test/check`), which simplifies CI. Build speed is roughly unchanged because Vite 8
  already bundles with Rolldown; the gain is fewer tools and configs, not raw speed.
- **Sprint 4 spec:** `docs/specs/Sprint4_spec.md` (interview 16 Oct). Search blends text relevance with feed signals
  (fallback to text-only if FR5's 3 s fails under the 10,000-note test); academic terms come from an admin-editable
  `"TERM_T"` that starts empty, and the term filter is hidden until terms exist (FR15 delivered as written); chat
  supports text, note cards, reply to a message, delete own message, read receipts, typing indicator, images (after
  R22); groups up to 30, any member adds their friends; notifications in-app only, kept 30 days; users can block users.
- **Implementation (16 Oct, `fix/d47-likes-suspension`):**
  - Self-likes: the like route no longer answers 400. E is computed only from `countsCol(asOf)` (ranking candidates), which
    now skips likes by the author or any edit collaborator (credited or not); the feed snapshot stores that E, so "Why
    this note" follows. The displayed count (`countsCol()` without asOf) still includes them. Super Like keeps its 409.
  - Suspension: `SHOWN_USER` (users repository) hides a suspended account from non-admins in the profile, its notes
    list, its follow lists and follow/unfollow (404, as for a deleted account); the admin check reads the viewer's role
    from the database. Comments use the deleted-comment path: a suspended author's comment shows as
    `[comment unavailable]` with no author or pin only while it has visible replies, and their replies are omitted.
    Co-author credit and `verifiedBy` already dropped suspended users. An admin also sees the published notes on the
    profile and in the note detail (`VISIBLE_OR_ADMIN`); the shared `VISIBLE` is unchanged, so the feed still withdraws
    them for everyone (D26). Unfollowing a user who became hidden answers 204. The shown comment count leaves out
    suspended authors' comments, and replying to or liking such a comment is refused as for a deleted one. The client
    shows an author-less comment as its body text alone.
  - Review fixes: a self-like or co-author like logs no `INTERACTION_T` row, so M is not skewed. `OWN_LIKE` reads the
    current collaborators, so re-ranking the same asOf after a collaborator change can shift E slightly.
  - Admin comment read (16 Oct, `fix/admin-suspended-comments`): `GET /api/notes/:id/comments` uses `VISIBLE_OR_ADMIN`, so an admin sees the comments list of a suspended author's note, with suspended commenters shown in full (`GONE` already honours `viewerIsAdmin`). Only that read path changed: like, comment and reply still use `VISIBLE` and answer 404 for admins, and search still hides suspended content from everyone. As with note detail and profiles, this covers any published note, including friends-only notes and notes across a block; drafts, hidden and deleted notes stay closed.
  - Not changed: likes by suspended users, and their comments in E, still count.
  - **Tests:** ENG-TC16, COL-TC19, USR-TC16 and ADM-TC20 updated; RANK-TC32, USR-TC27, ENG-TC22 added.
- **Implementation (16 Oct, `chore/vite-plus`):** `vite-plus` 1.0.0 with `vite` aliased to `@voidzero-dev/vite-plus-core` 1.0.0
  and `vitest` pinned to the bundled 5.0.1 through npm `overrides`; `dev`, `build` and `test` run through `vp`, and `lint`,
  `format:check` and `check` are new scripts. CI gains a Lint step. Typecheck, 208 server tests, 21 client tests and build pass.
  Oxlint reports 0 errors and 5 warnings. The format check is not in CI because Oxfmt would change 107 files; a dedicated
  formatting PR comes first. Measured build and test times were not faster (build 5.94 s to 6.54 s, server tests 32.5 s to 35.8 s).
  Details in `docs/sprints/vite_plus_migration.md`.
  Bumped to 1.3.0 on 16 Oct as a user-approved exception to the two-week rule (1.3.0 published that day; vitest pin 5.0.5).
  Interleaved re-timing, median of 3 plain Vite vs Vite+: build 8.81 s vs 8.41 s, client tests 3.98 s vs 4.40 s, server tests
  55.90 s vs 54.93 s, so the speed is the same within noise and the earlier 10 percent slowdown does not reproduce.

## D48 - Search and academic terms on the server (Sprint 4, 16 Oct 2026)
- **Context:** Sprint 4 spec (D47): FR4, FR5/NFR1, FR12, FR15 and R7; SRCH-TC1 to SRCH-TC16. UI waits for wireframe sign-off.
- **Endpoint:** `GET /api/search?q=&tab=top|notes|people|hashtags|modules&lecturer=any|<id>&term=<id>&from=&to=&module=<id>&cursor=&limit=`
  with `optionalAuth` (guests search public notes, IP limit, D44/D45). zod gives 400 for a blank query, one over 100
  characters, from after to, a term together with from/to, an unknown term (on every tab), or a malformed `asOf`, filter
  or cursor. Ids in the query are digits only, 1 to 2147483647 (`invalidId`, so `1e3`, `+1` and `1.0` are refused).
- **Tabs:** Top returns the notes page plus, on page 1 only, up to 3 people, hashtags and modules; the other tabs page one
  kind. People, hashtags and modules ignore a leading `#` or `@` and ignore the note filters.
- **Matching:** a note matches through `pst_search_doc` (`websearch_to_tsquery`, so quoted phrases work) or through its
  module's code (prefix), name or programme (contains); `#tag` matches that exact hashtag only. People match by display
  name, hashtags by name, modules by code, name or programme (`ILIKE` with the user's text escaped). Visibility is the
  shared `VISIBLE` rule plus `published`, so suspended authors' notes never appear; suspended and deleted accounts never
  appear in people, even for admins; a hashtag appears only while a note the viewer can see carries it.
- **Note order:** S = 0.5·T + 0.25·E + 0.25·V (`RANKING.searchWeights`, NFR5), ties by newest then id. T is
  `ts_rank_cd` (normalisation 1, length-damped) divided by the best T among the matches, because raw ranks are tiny
  (about 0.04 to 0.25) and would be swamped by E and V. E and V are the feed's `engagement()` and `validation()` on the
  ranking counts (self-likes excluded, D47). No R and no M, so there is no personalisation; the only viewer difference is
  that a friend's contacts-only notes take part in the "best T". The keyset cursor is the last note's (score scaled to an
  integer, published time, id).
- **Stable paging (review fix):** as in the feed (D22, D24), page 1 resolves `asOf` with `getCutoff` and returns it; later
  pages send it back. Only notes published by the cutoff match, and likes, comments and Super Likes count only up to it,
  so a like or a new, stronger note between pages cannot make a note skip or repeat (SRCH-TC17). Limit: removals are not
  time-bound, so an unlike, a withdrawn Super Like, a content edit that voids a Super Like (D46), or a note hidden or
  deleted between pages can still shift the remaining order by a place or two, and a note that became invisible is
  dropped from its page.
- **Candidate cap (review fix):** the query keeps the best `RANKING.searchCandidateLimit` (500) matches by text rank, then
  newest, then id, and computes counts, Super Likes and lecturer authorship for those only; the best T comes from the
  capped set. Trade-off: a broad query returns at most 500 notes, and a weak text match with high E or V outside the first
  500 by text rank is never shown. The filters (lecturer, term, dates, module) apply before the cap, so narrowing the
  search reaches such notes. Same kind of shortcut as the feed's 500 candidates (D24).
- **Other tabs order** by text match (exact, then prefix, then contains), then id, keyset on (match, id).
- **Filters:** `lecturer=any` keeps notes by a counting lecturer (approved, active or restricted) or with a valid Super
  Like (D24, D46); `lecturer=<id>` keeps that lecturer's own notes and the ones they validly Super Liked, and is empty for
  a non-lecturer. `term` resolves to its dates. Dates are inclusive Malaysian calendar days (`Asia/Kuala_Lumpur`), since
  every user is at APU and the database clock is UTC.
- **Terms:** `"TERM_T"` (name unique, start before end, overlaps allowed because intakes differ per programme), empty until
  an admin adds terms; public `GET /api/terms`; admin `GET/POST /api/admin/terms`, `PUT/DELETE /api/admin/terms/:id` (PUT
  replaces all three fields so start before end is checked in one place). Lives in the modules (catalogue) feature.
- **Performance (SRCH-TC10):** 10,000 notes, 50 mixed queries: median 134 ms, maximum 897 ms after the review fixes
  (`docs/sprints/search_performance.md`), so the blend stays and the text-only fallback was not used. EXPLAIN showed no
  need for new indexes; trigram indexes for people and hashtags are deferred until the user table is large.
- **Tests:** SRCH-TC1 to SRCH-TC17 (TC3, TC8, TC9 and TC13 rows updated for `lecturer=any|<id>` and campus days), ADM-TC31 to
  ADM-TC34, RANK-TC8 (search weights sum to 1).
- **Reversibility:** Easy. Weights are config; text-only order is `searchWeights` {1, 0, 0}.

## D49 - User blocking on the server (Sprint 4, 16 Oct 2026)
- **Context:** Sprint 4 spec (D47), "Blocking". Backend only; the UI follows wireframe 34.
- **Schema:** `"BLOCK_T"` (blk_blocker_id, blk_blocked_id, blk_created_at), primary key on the pair, `block_blocked_idx`
  on the blocked side, and a check that nobody blocks themself.
- **Endpoints:** `POST /api/users/:id/block` (201, or 200 when already blocked) and `DELETE /api/users/:id/block` (idempotent)
  need only a login: a restricted user may still block, since blocking protects them and adds no content (review fix), `GET /api/users/me/blocks` (keyset, 20 per page, newest first, D40).
  Blocking deletes follows in both directions, pending collaboration requests either user made on the other's notes, and
  edit locks either holds on the other's notes, in one transaction that first locks both USER_T rows in id order. Follow
  share-locks its target in a separate statement before checking, so a follow racing a block is either refused or
  deleted by it (review fix).
- **One rule:** `blockedWith(v, other)` in `users/repository.ts` is the only SQL for "a block in either direction". It is
  written as `other IN (v's blocked list UNION ALL v's blockers)`, so with the viewer as `v` Postgres hashes the list once
  per query instead of probing per row. It is joined into `VISIBLE` (feed, following feed, ranking candidates, search,
  hashtag and module counts, bookmarks, profile notes, note detail, engagement targets), `COLLAB_ROLE`, the comment `GONE`
  rule, people search and follow. `isBlocked(a, b)` is its TypeScript form, exported for messaging. A guest (id 0) has
  no blocks, so guests are unaffected.
- **What a block stops, both ways:** seeing the other's notes (404 on detail), profile (404 for the blocked side; the
  blocker gets `{id, displayName, blockedByMe: true}` so the UI can offer Unblock, also when the block is mutual), profile notes and follow lists (404
  both ways), following, likes, comments, comment lists, replies, comment likes, Super Likes, bookmarks, appearing in
  people search, collaboration invites, share-link opening and joining, collaboration requests and approvals (`decideRequest` answers 404 when the requester
  cannot be added), and the shared-notes list. The other's comments
  on a third user's note follow the suspended-author path: hidden, or "[comment unavailable]" with no author while they
  have visible replies.
- **Choices made (safe option, logged for review):**
  - Reporting ignores blocks (`VISIBLE_IGNORING_BLOCKS`), so a user can still report someone they blocked.
  - Admins cannot be blocked (403): a moderator must stay able to see and act on content. An admin may block a user;
    admin routes never read `"BLOCK_T"`, and note detail keeps the admin path (D47), so moderation is unaffected.
  - Existing collaborator rows are kept but give no access while a block stands (`COLLAB_ROLE`), so an unblock restores
    them and no co-author credit is lost. The collaborator can still leave (self-removal skips the access check), and the
    owner can still remove them, but the owner cannot change their role until the block is lifted.
  - The admin bootstrap (`upsertAdmin`) deletes blocks against the account it promotes, so no admin is ever blocked.
  - Shown like and comment counts are not adjusted per viewer, so a count can include the other side's comment.
  - A block does not hide either user from third parties' follower lists; only the pair's own follows are removed.
  - On a third user's note, the other side's name can still appear as "Verified by" (`VERIFIED_BY`) or as a co-author.
- **Performance:** SRCH-TC10 now seeds 1,000 blocks plus 20 on the measured user. EXPLAIN ANALYZE on that dataset (10,000
  notes) showed the block check as one hashed subplan per query (loops=1) using the primary key and `block_blocked_idx`;
  ranking candidates took 83 ms and the 50-query search median was 152 ms (max 1,053 ms), against 134 ms before (D48).
  No further index was needed.
- **Tests:** BLK-TC1 to BLK-TC14.
- **Reversibility:** Easy; dropping the fragment from `VISIBLE` and the routes restores the old behaviour.

## D50 - Messaging and Socket.io on the server (Sprint 4, 16 Oct 2026)
- **Context:** Sprint 4 spec (D47), "Messaging": FR6, FR7, FR13, FR16, UC15-UC18. Backend only; the UI waits for the wireframes.
- **Versions:** socket.io 4.8.4 (server) and socket.io-client 4.8.4 (dev, tests only), both released 25 Sep 2026; their
  transitive packages (engine.io 6.6.11, ws 8.21.3, socket.io-parser 4.2.7 and others) are all older than two weeks.
- **Schema:** migration `20261016000003_messaging.sql` reuses the initial tables. `"CONVERSATION_T".cnv_pair`
  ("<lower id>_<higher id>", unique, set only for direct chats) gives one direct conversation per pair, so two first messages
  racing cannot open two chats. `"CONV_MEMBER_T".cmb_last_read_msg_id` replaces `cmb_last_read_at`, and `cmb_left_at` is
  dropped because leaving deletes the member row. `"MESSAGE_T"` gains `msg_reply_to_id` and `msg_deleted_at`, and its index
  becomes (conversation, id) for history paging, plus a partial index on `msg_reply_to_id` for the reply foreign key. The
  pending-request index now covers the pair in either direction. No
  attachment column: chat images come with R22's upload pipeline, which will add its own column.
- **Split of work:** every write goes over REST (so it gets the CSRF header check, the shared Postgres write limiter of
  D40 and `requireActive`), and Socket.io only delivers. The one client event is `typing`. MSG-TC2 and MSG-TC3 therefore
  expect a 400 response rather than a socket error acknowledgement; the rest of MSG-TC1-10 keep their meaning.
- **Handshake (D35):** `allowRequest` refuses every engine request whose `Origin` is not `CLIENT_ORIGIN`, a missing
  Origin included, because WebSockets bypass CORS and the CSRF header. Then an `io.use` middleware runs
  `passport.authenticate('jwt')` on the handshake request, so the cookie is read and verified, and the user reloaded, by the
  same rules as `requireAuth`. Suspended and deleted users are refused. A socket is disconnected when its token expires
  (at most one hour, so a logout on another tab holds within the token lifetime), and an admin suspension or deletion
  disconnects the user's sockets at once. Shutdown calls `io.close()`, which disconnects sockets and then closes the HTTP
  server (D41). `maxHttpBufferSize` is 1,000 bytes, since clients send only typing events.
- **Deployment:** the app runs on a single Fly machine until the Socket.io Postgres adapter lands (R27): rooms, typing
  throttles and the kicks done through them (suspension, removal from a group) are in-memory and per process.
- **Rooms and events:** on connect each socket joins `user:<id>`, then `conv:<id>` for every conversation it belongs to
  (joins happen after connect, not in the handshake middleware, because before connect the socket is not in the namespace
  and `socketsJoin`, `socketsLeave` and `disconnectSockets` would miss it). After that, REST changes reach open sockets
  through `socketsJoin`/`socketsLeave` on the user room. Server events: `message:new`, `message:deleted`,
  `request:new` (recipient only), `request:accepted` (sender only; a decline notifies nobody), `conversation:read`,
  `conversation:updated` (group created, renamed, member added or removed), `conversation:removed` (to the removed or
  leaving member) and `typing`. When a message carries a note card it is sent once per member, each with the card checked
  for that reader; otherwise one payload goes to the room.
- **Endpoints (all under /api, login required):** `POST /messages` `{toUserId, body, noteId?}` answers 201
  `{conversationId, message}` when it goes into a conversation and 202 `{request}` when it becomes a request;
  `GET /conversations` (keyset, 20, newest activity first, with members and their read receipts, last message and unread
  count), `GET /conversations/:id`, `GET /conversations/:id/messages` (keyset on message id, 50, newest first),
  `POST /conversations/:id/messages` `{body, noteId?, replyToId?}`, `DELETE /messages/:id`, `POST /conversations/:id/read`
  `{messageId?}`, `GET /message-requests` (keyset, 20), `POST /message-requests/:id/accept|decline`, `POST /conversations`
  `{name, memberIds}` (group), `PATCH /conversations/:id` `{name}`, `POST /conversations/:id/members` `{userId}`,
  `DELETE /conversations/:id/members/:userId`.
- **Rules:**
  - Friends (D38), or a pair that already has a conversation, message directly. Otherwise the first message is a pending
    request holding the text and note card, one per pair. Accepting opens the conversation with the held message (its
    original time and note, inserted through the same block-checked INSERT, rolled back if refused), marks it read for the
    recipient and creates no follow. Whenever a direct conversation opens or takes a message, a pending request between the
    pair is accepted in the same transaction and its held message inserted first, so a pair who became friends meanwhile
    keeps its history in order. Declining only sets the status, so the sender may ask again later.
  - Blocks (D49): the recipient check and the message INSERT ... SELECT both embed `blockedWith`, so a committed block
    always stops a message. A direct chat across a block disappears from both lists, and its history and sends answer 404
    until an unblock restores it. Requests from a blocked sender leave the inbox and cannot be accepted. The typing relay
    checks `isBlocked`. Suspended or deleted users cannot be messaged (404); an existing chat with one stays readable,
    but sends there answer 403.
  - Text is 1-2,000 characters of plain text: control characters other than tab and newline are dropped and the rest is
    trimmed, then stored as typed; the client renders it as text, the same as comments.
  - A note card must be VISIBLE to the sender when sent and is re-checked against VISIBLE for every reader, in history,
    the inbox and live events. A reader who cannot see it gets `note: null, noteUnavailable: true`.
  - A reply must point at an undeleted message in the same conversation. Soft delete is by the sender only; it clears the
    body and note in the row, so history shows `deleted: true` with a null body.
  - Read receipts store the last-read message id per member and only move forward. Unread counts leave out the reader's
    own and deleted messages.
  - Typing is relayed to the room except the sender, never stored, at most once per conversation per socket every 2 s
    (`messaging/config.ts`), and only for rooms the socket is in.
  - Restricted users (requireActive) cannot send, start chats, create groups, add members or rename. They can read, mark
    read, delete their own messages, answer requests and leave.
- **Groups (FR13):** the creator plus 2-29 friends, 30 at most. Any member may add one of their own friends; the new
  member starts with all earlier history marked read. Membership changes lock the group row first and only then read its
  size and the actor's membership, in a separate statement, so a change committed while waiting for the lock is counted
  and the cap holds under concurrent adds (MSG-TC26). Anyone may leave; the owner renames and removes members.
- **Choices made (safe option, logged for review):**
  - When the owner leaves, the earliest-joined remaining member (ties by user id) becomes owner; the group is deleted
    with its messages when its last member leaves.
  - Adding or creating a group is refused (400 "These users cannot be in the same group") when any two members are in a
    block. The message does not say who blocked whom, but it does tell the adder that some block exists. Blocks made
    after joining remove nobody, so both stay and see each other's group messages.
  - New members see the group's full history (marked read for them); there is no per-member history cut-off.
  - A deleted account's member rows and messages stay, shown as "Deleted user"; if it owned a group, ownership does not
    move automatically.
  - Logout does not disconnect sockets on other tabs; the token expiry timer closes them within the hour.
  - Accepted, not fixed: a `message:deleted` event (two ids, no content) still reaches both sides of a direct chat hidden
    by a block, since they share its room; the socket handshake has no rate limit of its own; and a group removal that
    commits while a connecting socket reads its conversation ids can be missed, leaving that socket in the room until it
    reconnects (a `shortcut:` in `socket.ts`).
  - A held message accepted on the friends path is not pushed live; it appears in history.
- **Rate limit:** REST writes count against the shared write limiter (120 per minute per user, D40); the typing throttle
  covers the only socket event.
- **Shortcuts:** message ids are read as INT and keyset cursors cap ids at the INT maximum; both move to BIGINT past
  2^31 messages. The conversation list builds every conversation of the user before its keyset filter and LIMIT.
- **Live note cards:** a message is read once for its sender and reused for the response and the room; with a note card,
  one query computes the card for every member and each gets their own copy.
- **Tests:** MSG-TC1 to MSG-TC27 (REST in `tests/messaging/messaging.test.ts`; real socket.io-client connections on an
  ephemeral port in `socket.test.ts`). The shutdown path and the rate limit (skipped under test, as elsewhere) are not
  unit tested.
- **Reversibility:** Medium: one migration with a down step (rolling back loses read receipts, replies and soft-delete
  flags); routes and the gateway are self-contained in `features/messaging/`.

## D51 - Notifications on the server (R8, Sprint 4, 16 Oct 2026)
- **Context:** Sprint 4 spec (D47), "Notifications", and PLAN R8. Backend only; the drawer UI waits for the wireframes.
- **Schema:** migration `20261016000004_notifications.sql` adds `"NOTIFICATION_T"`: recipient (`ntf_usr_id`), nullable actor,
  type (CHECK list of 11), optional note, comment, collaboration-request and message-request ids (all foreign keys with
  ON DELETE CASCADE, so a request removed by a block takes its notification with it), `ntf_read_at` and `ntf_created_at`;
  a check that the actor is never the recipient. Indexes: `notification_recipient_idx` on (recipient, created_at DESC,
  id DESC) for the inbox and its keyset, the partial `notification_unread_idx` on recipient WHERE unread, and the partial
  `notification_collab_request_idx` on `ntf_crq_id` so the cascade from a deleted collaboration request is indexed. No JSON
  payload: the decision outcomes are separate types (`lecturer_approved`/`lecturer_rejected`, `collab_approved`/`collab_declined`).
- **Types:** mention, super_like, follow, lecturer_approved, lecturer_rejected, note_hidden, message_request,
  collab_request, collab_approved, collab_declined, edited_since_verification. Moderation outcomes have no actor, so the
  admin is not named.
- **Mentions:** `"USER_T"` has no username column and display names are neither unique nor free of spaces, so `@name`
  text cannot be resolved reliably. The comment body takes an optional `mentions` list of user ids (at most 10) from the
  client's mention picker; a named user is notified only when the text contains "@" plus their display name followed by a
  character that is not a letter, digit or underscore (so "@Annabel" does not name Ann; the name's punctuation is escaped
  for the regex), they are the
  note's author, have commented in the same thread (the root comment or its replies) or are the commenter's friend
  (PLAN R8), and they can see the note (`canSee` in the service, built on `getTarget`, so contacts-only notes and blocks
  are respected). Ids outside that set
  are dropped silently, so the response does not reveal who is a friend or participant.
- **Delivery rules:** one `INSERT ... SELECT` skips the actor, recipients who are not active or restricted (suspended and
  deleted accounts get nothing), anyone in a block with the actor (`blockedWith`, D49), and an identical notification
  (same type, actor and targets) within the type's window in `notifications/config.ts`: 60 minutes for follow (unfollow and
  re-follow) and Super Like (withdraw and give again), 1 minute for edited_since_verification (two saves racing past the
  lookup). Other types point at a new comment or request each time, so they have no window. A block deletes the follow
  notifications between the pair in the same transaction, since the follows themselves are deleted. Listing and the unread count also hide notifications whose actor is now suspended, deleted or in a
  block with the recipient, so blocking someone hides what they caused earlier; an unblock shows it again. The note in an
  item is `{id, title}` only while the recipient can still read it (`READABLE`, now exported from the notes repository).
- **When it is written:** every notification is inserted after the triggering write has committed, by `notify()` in
  `notifications/service.ts`, which catches and logs every error, so a failed notification never fails the action. The
  spec preferred the same transaction where cheap; none of the triggers is a transaction that returns enough to build
  and push the notification (most are single statements through `pool`), and the live push must follow the commit
  anyway, so one post-commit path was simpler. Trade-off: a crash between the commit and the insert loses that
  notification.
- **Edited since verification:** after every successful note save, `voidedVerifiers` selects lecturers whose Super Like
  predates `pst_content_edited_at` and who have no `edited_since_verification` notification newer than their Super Like.
  So each lecturer is told once per voiding, a hashtag-only save tells nobody, and a lecturer who re-confirms is told
  again after the next content edit (unless that edit falls inside the 1-minute window). Only lecturers who can still
  see the note are told (`canSee`), so a lecturer the owner blocked, or one outside a now contacts-only audience, gets
  nothing. `replaceNote` is unchanged. Known limit: once the earlier notification is purged
  (30 days), the next save of a still-unconfirmed note tells the lecturer again.
- **Collaboration decision:** `decideRequest` now returns the requester's id instead of `'ok'`, so the route can notify them.
- **Hidden note:** `resolveReports` returns `{resolved, hiddenAuthorId}`; the hide UPDATE returns the author, so only the call
  that actually hid a published note notifies.
- **Comment response order:** the review asked to send the comment response before the mention insert if trivial. It
  was not: the insert then races the client's (and the tests') next read of the inbox, so the order is kept.
- **Endpoints (login required, restricted users included):** `GET /api/notifications?type=&cursor=&limit=` (keyset on
  created_at and id, 20 per page, D40; `type` is one type or a comma list so the drawer can group), `GET
  /api/notifications/unread-count` (`{unreadCount: {total, byType}}`), `POST /api/notifications/read` (`{ids?}`, 1-100 ids; without ids
  marks all; another user's ids are ignored).
- **Live:** `notify()` emits `notification:new {notification, unreadCount}` to `user:<id>` with the messaging gateway's
  `emit` (D50); marking read emits `notification:count {unreadCount}` so other tabs update.
- **Retention:** `purgeOldNotifications` deletes rows older than 30 days, read or not, as part of `purgeAll` (the daily
  job and `npm run db:purge-interactions`, D34). No index on `ntf_created_at`: one daily scan of a 30-day table is cheap.
- **Not done:** the request-message notification is stored in addition to the existing `request:new` event, which is
  unchanged. A new comment on your note is not a notification type (not in the spec). The live push has the same
  single-machine limit as messaging (R27).
- **Tests:** NTF-TC1 to NTF-TC18 (`tests/notifications/`).
- **Reversibility:** Easy: one migration with a down step; remove the `notify` calls from the trigger routes.

## D52 - Sprint D spec (17 Oct 2026, user interview)
- **Context:** wireframes v3 approved (gate lifted); Sprint D builds the R19 redesign, the R21 editor with R22 images and
  R29 video, and the UI for R30, R31, search, blocking, messaging and R8. Full spec: `docs/specs/SprintD_spec.md`.
- **Theme:** light default plus dark (system setting and a toggle), TikTok layout (left rail on desktop, bottom tabs on
  mobile, full-height card feed). Every colour is a CSS variable in one token file, so the palette can be replaced later
  (the user may choose one with a tool such as Google Stitch).
- **Order:** design system, then shell, feed, note detail, welcome/auth, then all remaining v3 screens. R21 follows its
  spec order: R21a, R21b, R21c (R22 server alongside), R21d, R22 client, R29.
- **Split:** `frontend-designer` sets the system (shadcn/ui via its CLI, `client/DESIGN.md`), the key screens and the
  editor UI; `frontend` does the SlideBoard rollout, search, profiles and blocking, collaboration, messaging,
  notifications and admin; `implementer` the server halves. At most three parallel worktrees.
- **Storage:** a storage interface with a local-disk driver for development and tests; the Cloudflare R2 driver is
  added when the user provides keys. The Unsplash panel stays disabled until `UNSPLASH_ACCESS_KEY` is set.
- **Accepted proposals:** local backup for published notes (cleared on logout and after Update; restore offered only
  when the backup's base version equals the server's `updatedAt`); ffmpeg installed with `winget install Gyan.FFmpeg`
  locally and apt-get in CI and Docker.
- **Merging:** as on 16 Oct, a PR merges when CI is green and the reviewer reports no blockers; PRs touching uploads
  also get `/security-review`.

## D53 - Slide element schema and notes API (R21a, 17 Oct 2026)
- **Built:** `shared/` workspace (`@parp/shared`) with the zod deck schema, element types (text, shape, line, image, code, video and
  the table/text-grid from D43), board and limit constants; migration `20261017000001_slide_elements` (POST_T aspect and music
  columns, SLIDE_T `sld_doc` JSONB and `sld_notes`, down step rebuilds `sld_content`); notes API takes `theme`, `aspect`,
  `music` and element slides, sanitises text (adds `u` and a `color: #hex` span), enforces the per-slide limits, builds the
  search document from text, code, table and alt text, and has a 2 MB body limit on `/api/notes`.
- **Choices the spec left open:** `Shadow` is `{x, y, blur, color}`; `CodeLang` is a 13-language list; the table element is
  `{cells: string[][] (1-20 rows, 1-8 columns, 200 characters a cell, equal row length), font, size, color, borderColor, headerRow}`
  and its text counts towards the 20,000-character slide limit and the search document. A slide is empty (dropped on
  publish) when it has no element other than blank text boxes. Page notes are returned to the author and to edit
  collaborators, not only the author, because a co-author's full-replace save would otherwise wipe them.
- **Deferred:** asset-existence and ownership checks and the `assets` URL map (R22; the map is empty), Deezer title, artist
  and cover (R9; stored NULL), geometry rounding to 0.1 (editor's job). The old editor and viewer go through
  `client/src/lib/slides.ts`, which keeps only text elements until R21b/R21c replace them.
- **Test IDs:** the spec's NOTE-TC26 and NOTE-TC27 clashed with the drafts and guest tests, so those two are NOTE-TC45 and
  NOTE-TC46, and the client adapter tests are NOTE-TC47 and NOTE-TC48 (rows in `docs/chapter4/4.5_test_cases.md`).
- **Review fixes:** migrated and resaved text elements get position-based ids (`text-001`), so an unchanged resave is not a
  content edit; page notes are read in the same SELECT as the slides; `textHtml` is 20,000 (a migrated slide can be that
  long); Unsplash image URLs are limited to URL-safe characters; an aspect change counts as a content edit; a slide with an
  image or gradient background is not empty.
- **Reversibility:** Moderate: the down migration drops non-text elements, page notes and music.


## D54 - Image uploads on the server (R22, 17 Oct 2026)
- **Built:** migration `20261017000002_assets` (`"ASSET_T"`, `"POST_ASSET_T"` as in R21 spec 2.2; `ast_kind` already allows `video` for R29);
  `lib/storage.ts` with a `Storage` interface (`put`, `read`, `remove`, `signedUrl`) and a local-disk driver under `STORAGE_DIR`
  (default `<repo>/uploads`, gitignored; tests use a temp folder). An R2 driver returns presigned GET URLs from `signedUrl` and
  the asset route then redirects to them; the AWS SDK is not added yet.
- **Upload:** `POST /api/assets/images` (requireAuth, requireActive, CSRF, write limiter, 30 uploads an hour per user), multipart
  field `file`, at most 5 MB (413). `sharp` decodes the bytes, so the type comes from content, not name or header (only
  JPEG, PNG, WebP, GIF); input over 50 megapixels is refused; the image is auto-rotated, scaled so the longest edge is at most 2560
  and re-encoded as WebP quality 80. EXIF, GPS and ICC data are dropped and a GIF becomes its first frame (D43). 500 MB quota per
  user counted on stored bytes, checked under a per-user advisory lock (413). Reusable across notes.
- **Dependencies:** `sharp` 0.35.5 (27 Sep 2026), `multer` 2.4.0 (14 Sep 2026) and `@types/multer` 2.3.0 (28 Sep 2026), all
  pinned and over two weeks old. multer rather than hand-written busboy handling: it already caps size and file count, and its memory storage is fine at 5 MB.
- **Notes:** saving checks every upload id (image element, video element, image background) is `ready`, the right kind and owned by
  the saver or already linked to that note in `POST_ASSET_T`, so a co-author keeps the owner's images and the owner keeps a co-author's, but neither can pull in the other's unrelated uploads (400 "Slide 1, element 2: Image not found"). `POST_ASSET_T` is rebuilt on every save. Note
  detail and feed carry `assets: {id: "/api/assets/:id/file"}`.
- **Access:** `GET /api/assets/:id/file` (optionalAuth) serves a ready asset to its owner, or to anyone who may read a note that
  references it (READABLE or VISIBLE_OR_ADMIN, the note detail's own rule: blocks, friends-only, hidden, deleted, collaborators).
  Everything else is 404. `Cache-Control: private, max-age=300`, so a hide takes effect within five minutes in a browser cache.
- **Share links:** `GET /api/share/:token/assets/:assetId` (same limits as the link's note route) serves only assets that the link's note references; the link's `assets` map points there, because a link holder may not pass the asset route's note checks.
  The link and upload inserts re-check `ready` under `FOR SHARE`, so a purge cannot slip between check and link (400 "Image not found").
- **Unsplash:** `GET /api/unsplash/search?q=&page=` and `POST /api/unsplash/:photoId/download` (signed-in), 503 "Unsplash is not configured"
  while `UNSPLASH_ACCESS_KEY` is unset. Results are checked against the deck's image-source schema (images.unsplash.com image, unsplash.com credit),
  the credit link gets `utm_source=notalah&utm_medium=referral`, pages are cached for an hour (200 entries); searches are limited to 20 an hour per user. The download route reads
  `download_location` from Unsplash's own photo response and only calls it when it starts with `https://api.unsplash.com/`.
- **Cleanup:** the daily purge marks assets older than 24 h that no non-deleted note references as `deleted` and removes their files.
  shortcut: age is measured from upload, not from when the asset was unlinked, so an image removed from a note long after upload is purged at the next run.
- **Known limits:** a guest loading a public note's images counts against the 120 reads a minute guest limit, one request per image; R2 presigned URLs
  would remove that. Video (R29) adds its own routes and the poster key.
- **Test IDs:** NOTE-TC33, 34, 37, 38, 40 as in the R21 spec (TC34 stays R21a's URL spoofing; the proxy is NOTE-TC51), plus NOTE-TC49 (quota), TC50 (file access incl. share links), TC52 (purge), TC53 (request checks), TC54 (asset links) and TC55 (co-author assets). The quota lock is `pg_advisory_xact_lock(hashtext('asset_quota'), user)`.
- **Reversibility:** Easy: the down step drops both tables; uploaded files stay on disk.

## D55 - Search screen navigation (Sprint 4, 17 Oct 2026)
- **Context:** the search UI (wireframes 07, 37 to 39, D48) needs an entry on phones, where the tab bar has five slots.
- **Decision:** Search replaces Saved in the phone tab bar (Home, Search, Create, Drafts, Profile); Saved moves to the
  phone More menu and stays in the desktop rail. Guests get a search icon in the phone header. Hashtag and module results
  have no page yet, so they open a notes search for that tag (`#tag`) or module (`module=<id>`). A lecturer filter set
  from a person result reads "One lecturer", because the search API returns no lecturer name for the chip.
- **Reversibility:** Easy. Discover and Inbox (wireframe 13) replace Search and Drafts later.

## D56 - Slide editor core, first slice (R21c, 17 Oct 2026)
- **Built:** `client/src/features/editor/`: zustand 5.0.15 store (13 Aug 2026, over two weeks old) with `{deck, selection,
  activeSlide, past, future, dirty, saveState}` plus `meta` (title, module, hashtags, status, visibility, noteId,
  baseUpdatedAt) and a `rev` counter; snapshot undo capped at 100. `shared/src/geometry.ts`: move, 8-handle resize in the
  box's rotated frame (opposite corner or edge midpoint fixed, Shift keeps the ratio, minimum 8 units), rotation from the
  pointer with 15-degree snap, centre/edge guides against the board and the other elements. Canvas on `SlideBoard
  mode="edit"`, slide strip (add, duplicate with new element ids, delete, drag or menu reorder), aspect picker, text boxes
  (TipTap only in the box being edited) and shapes/lines, contextual element bar, Text/Elements/Background/Details panels,
  save with `baseUpdatedAt`, draft autosave, 409 Reload / Keep mine, local backup for published notes.
- **Choices the spec left open:** a drag, a resize, a rotation and a whole text-editing session are each one undo step
  (`preview` while moving, `commitFrom(base)` on release); title, module and hashtags are not in undo. Rotation snaps by
  default and Alt turns snapping off (Shift is taken by keep-ratio); Alt also turns off move guides. A first tap selects
  a text box, a second tap (or Enter) opens it for typing; Escape closes it. "Keep mine" refetches the note's current
  `updatedAt` and saves over it. The editor route sits outside `AppShell` (paths unchanged) so it fills the window; when the
  first autosave moves `/notes/new` to `/notes/:id/edit`, the page remounts but keeps the store, so typing in flight and
  undo history survive. Backups are cleared on Update and on logout. Arrow keys nudge (Shift: 10 units) and a Position
  popover sets x, y, size, angle and opacity exactly, as the single-pointer alternative to dragging (WCAG 2.5.7); a Layers
  panel lists elements top first with move up/down buttons. Ctrl+C/V/D copy, paste and duplicate (an in-editor clipboard).
- **Review fixes (17 Oct):** an untitled draft autosaves as "Untitled note" (the author renames it later) instead of
  waiting for a title. The Back links ask "Leave without saving?" only when the edits cannot be kept: a 409 conflict, a
  423 lock, a failed save, or a published edit whose local backup could not be written; drafts are saved on the way out from a
  snapshot of the moment of leaving. Each save carries the store's `session` (bumped on every load), so a late reply
  never writes into another note; the id and `updatedAt` of the last successful save are handed to a save of the same
  session queued behind it even after that note was closed, so it PUTs instead of creating a duplicate. A 423 is a `locked` state with a "Try again" banner, stops autosave, and backs the
  draft up locally. Backups record their owner and another user's are cleared when someone signs in (an expired session keeps them, so
  the same user can still restore after signing back in);
  a restored backup must pass `deckSchema` and its text is reduced to the server's allow-list with `DOMParser` (no new
  dependency). Live edits keep their base in the store (`previewBase`), so undo, redo and any discrete change first
  record them as their own step; the header Undo/Redo wait while a text box is open (TipTap owns Ctrl+Z there).
- **Removed:** the old TipTap `NoteEditor`, its `Toolbar`, and the `lib/slides.ts` HTML adapter, which nothing else used,
  so NOTE-TC47 and NOTE-TC48 are retired; the `.slide-content` CSS went with them.
- **Test IDs:** NOTE-TC44 (geometry), NOTE-TC58 (undo/redo), NOTE-TC59 (slide strip and aspect), NOTE-TC60 (save state),
  NOTE-TC61 (autosave timing, create then PUT with baseUpdatedAt, 409), NOTE-TC62 (keyboard selection, nudge, delete; layers), NOTE-TC63 to TC66 (backup restore and clearing, late reply, untitled and locked saves).
- **Reversibility:** Easy: client only; the API is unchanged.

## D57 - Free-tier cost guard (R34, 18 Oct 2026)
- **Context:** the user will not pay for any service (18 Oct), so the app must stop before a provider's free allowance runs out. Cloudflare R2 has no hard spend cap that refuses requests at the free limit (verify against Cloudflare docs; research pending), so the app enforces it.
- **Decision:** `server/src/features/usage/`: one config module. Stored bytes 8 GB across all users (80% of 10 GB, decimal GB, the smaller reading of 10 GB-month). Monthly R2 caps are 50%, not 80%: Class A 500,000 (of 1M) and Class B 5,000,000 (of 10M), because the billing period is unconfirmed and a cycle spanning two calendar months must still stay under the allowance. They can rise to 80% (800,000 and 8,000,000) once the R2 billing period is confirmed as the UTC calendar month (verify against Cloudflare docs). Unsplash 25 an hour app-wide (50%, of 50). Env `USAGE_CAP_*` can lower a cap for the demo; a value above the safe default, or an unusable one, falls back to the default (logged).
- **Counter:** `"USAGE_COUNTER_T"` (metric, period key, count); `consume(metric, n, cap)` is one `INSERT ... ON CONFLICT DO UPDATE ... WHERE count + n <= cap`, so concurrent calls on any number of instances cannot overshoot. Periods are UTC (`2026-10`, `2026-10-18T14`; a `day` period is ready for the AI caps, R28, whose Groq limits are still to be set).
- **Counted:** every `storage.put` is Class A and every `storage.read` Class B, both in the `metered` wrapper in `lib/storage.ts`, so R29 video is covered. Deletes are not counted: R2 lists DeleteObject as free. Every outbound Unsplash call is one unit, reserved before the call (a photo download reserves 2: lookup and tracking); cache hits are free. Stored bytes are the sum of live assets, not a counter.
- **R2 driver rules:** it streams every file through the server (no `signedUrl`, so no presigned GET or PUT and no browser-direct uploads), which makes each GetObject countable. An upload is one PutObject, never multipart; if multipart is ever needed it must reserve ceil(bytes / partSize) + 2 Class A operations up front.
- **Refusals:** upload that would pass the storage cap, 507; Class A exhausted, 503 "Monthly image limit reached"; Class B exhausted, file requests 503; Unsplash cap, 503; `UPLOADS_DISABLED=true` (checked inside `metered.put`), 503 "Uploads are turned off". The rest of the app is unaffected. If the counter table cannot be reached, uploads and file serving fail with 500 (closed, not open) and deletes still work. Both file routes also have a per-user (or IP) limit of 300 a minute, and the Unsplash download route shares the search limiter.
- **Overcount trade-off:** Class B counts a read even when the file turns out missing, and a failed upload still counts its write. Overcounting stops us early, never late. The storage check is read-then-write, so simultaneous uploads can overshoot by a few 5 MB files; the 2 GB headroom covers it (`shortcut:` note in the code).
- **Admin:** `GET /api/admin/usage` (admin only) returns used, cap and period for each metric and nothing else exposes it. Tests USE-TC1 to TC9.
- **Reversibility:** Easy: the down step drops the table; the wrapper and checks are small call-site changes.


## D58 - Slide editor, second slice (R21c, 18 Oct 2026)
- **Built:** multi-select (Shift or Ctrl click, marquee drag from the slide or the grey canvas, Ctrl+A) with group move,
  scale from the frame's corners and rotation about its centre, and an Arrange popover (align six ways; space evenly
  across or down for three or more); whole-box text styling while a box is closed; selection frames and handles drawn
  outside the clipped board; a Slide size confirm (wireframe 23); the locked editor (wireframes 28 and 29); code and
  table editing; Uploads and Photos panels with crop, flip, corner and alt text for images.
- **Choices the spec left open:** the store's `selection` is a list (the first id drives single-element tools); group
  scaling always keeps the ratio, because a rotated member cannot be stretched along the board's axes without skewing;
  align with one element selected aligns it to the slide; locked elements stay put but count towards the frame. Grouping
  (a saved group id) was left out: it needs a schema field, and multi-select covers moving things together.
  Bold on a closed box is its weight (700 or 400; turning it off also removes bold runs inside); italic, underline,
  strike and lists go through a detached TipTap editor over the whole HTML, so the result matches what typing makes;
  the toolbar shows "Whole box" or "Selected text". Crop trims each side up to 45 % and resizes the frame's height so
  the photo is never stretched. Code is plain text in a monospace textarea (no highlighting; the language is a label).
- **Lock (D46):** the editor takes the note's lock on open, renews it every 45 s and releases it on leave (keepalive
  DELETE on `pagehide`). A 423 makes the editor read-only (view-mode board, no panels, strip without add or reorder,
  "View only" in the header) and retries every 20 s, so an expired lock is taken over without asking; winning it after
  a wait reloads the note. Co-authors (`myRole: edit`) can now open the editor: they edit content, cannot change the
  module, and see a disabled Publish ("Only the owner can publish"). The wireframe's "Notify me" and "On this note now"
  list need presence and notification APIs that do not exist, so the notice offers "Try again" instead.
- **Server additions:** `POST /api/notes/:id/publish {visibility}` lets the owner publish the last saved version of a
  draft while a co-author holds the lock (wireframe 29). It re-validates the stored note as PUT does and saves only if
  nothing was saved since it was read (409), so the co-author's next save gets the usual 409 rather than overwriting
  the publish; `replaceNote` takes `ignoreLock` for this route only. `GET /api/assets/images` lists the caller's ready
  images newest first (keyset, 30 a page) for "Your uploads", which had no list route.
- **Review fixes (18 Oct):** a co-author's PUT whose status, visibility or module differ from the server's is now a
  409 (was 403), because after the owner publishes those fields differ through no fault of the co-author; "Keep mine"
  adopts the server's status and visibility (and module for a co-author) before saving. Winning the lock after a wait
  reloads only when nothing is unsaved, else it raises the conflict banner. Lock runs are counted per note, so only the
  last to close releases (StrictMode, retry, remount). Pastes stop at the image and video caps; group scaling is clamped
  so no member goes under the 8-unit box or past font 400 or 4000 units. A drag in progress is cancelled (its live
  changes dropped) when the editor turns read-only. Shift+Space toggles the focused element. Each Unsplash photo is
  reported once a session; late search replies are dropped. If the locked publish fails on module or hashtags, the
  error says to add them once the note is free (Details stays closed while locked).
- **Drafts and publish preview:** the drafts list now returns `aspect`, `slideCount`, the first slide as `cover` (no page
  notes) and `assets`, as the profile notes query does (`ASSETS_COL`); the Drafts page shows tiles with that slide in a
  `SlideBoard` (wireframe 30, Edit and Delete only: the wireframe's Publish, Share and Duplicate wait for their flows).
  The publish dialog shows the first slide, title, slide count and size (wireframe 26).
- **Not built:** video stays a disabled tile in Elements until the R29 client lands (a video element needs a real video
  asset to save).
- **Test IDs:** NOTE-TC78 to TC90, COL-TC25; COL-TC4 now expects 409.
- **Reversibility:** Easy: client changes plus two additive routes.

## D59 - Video upload on the server (R29, 18 Oct 2026)
- **Context:** R29 adds video elements (D32: one per slide). D57 forbids presigned URLs and browser-direct uploads, so the spec's presign step (R21 spec 2.4) is replaced by a server upload. This is the server half; the client player and upload UI come later.
- **Upload:** `POST /api/assets/videos`, multipart field `file`, streamed by multer to a temp file in a per-request directory under the OS temp dir, never held in memory. Over 50 MB is 413 (same status as images). The directory is removed when the response closes, so success, rejection, abort and timeout all clean up.
- **Validation:** `ffprobe` reads container, streams, dimensions and duration from the bytes; the filename and MIME header are ignored. Only MP4 and WebM containers are accepted; Matroska shares the WebM demuxer name and leaves as WebM. Over 90 s is 400, a longer edge above 4096 px is 400 ("absurd"), anything else not a video is 400.
- **Processing:** first video and first audio stream only, `-map_metadata -1 -map_chapters -1` and bitexact muxing (no encoder tag). MP4 with H.264 yuv420p and AAC, or WebM with VP8/VP9 and Opus, within 1920x1080, is remuxed with `-c copy`; anything else is transcoded to H.264/AAC (`libx264 veryfast`) or VP9/Opus (`libvpx-vp9` realtime) and scaled to fit 1080p. The result is re-probed, and over 50 MB after processing is refused. Every ffprobe and ffmpeg call is `execFile` with an argument array, a 60 s timeout and kill on timeout. At most 2 videos process at once; a third gets 503.
- **Poster:** one frame at 1 s (0 s for clips under 2 s, which may hold a single frame) as PNG, then the existing `reencodeImage` (sharp) makes it WebP. Served at the file URL plus `?poster=1` on both file routes (owner/note route and share-link route), so the client derives it from the `assets` map.
- **Storage:** one `ASSET_T` row, kind `video`, `ast_key` `v/<uuid>.mp4|webm`, `ast_poster_key` `p/<uuid>.webp`, status `ready` only after both puts and the quota check. Two metered puts (Class A), no multipart. `ast_bytes` is video plus poster and counts against the 500 MB quota (D43) and the 8 GB cap (D57). The unlinked-asset purge now also removes a video's poster. No migration needed: the columns existed from R22.
- **Range:** `sendAsset` answers a single `Range: bytes=` with 206, 416 when unsatisfiable, and sends `Accept-Ranges: bytes`; multi-range is served whole. `Storage.read(key, range?)` takes the header and returns a stream of just that part (local driver: `createReadStream({start, end})`), so no whole-file buffer. Same access rules as before. Each request, ranged or not, is one Class B read, so a player that seeks a lot spends more of the 5M monthly cap (50% of the free 10M); the existing `fileLimiter` (300 per minute per user) bounds it and no separate range limiter was added. The R2 driver must map the range to a GetObject `Range`.
- **Rate limit:** video uploads are 6 per user per hour (images 30), because each runs ffmpeg and up to 50 MB of storage. Adjustable in `ASSETS.videoUploadsPerHour`.
- **Deploy and CI:** the server needs `ffmpeg` and `ffprobe` on PATH (CI installs it with apt-get). The production image/host must provide it too.
- **Tests:** NOTE-TC39 and NOTE-TC68 to TC77 (playlist, early refusal, orientation and 1080p, 50 MB, metadata, range, temp cleanup, timeout, note use, poster access), in `server/tests/assets/video.test.ts`; fixtures are generated with ffmpeg `lavfi`, no binaries committed.
- **Reversibility:** Easy: one route and one module; no schema change.

## D60 - R2 storage driver (18 Oct 2026)
- **Context:** D54 left an S3-compatible driver behind the `Storage` interface; D57 and D59 fix its rules (server-streamed, no presigned URLs, single PutObject, every call through `metered`).
- **Library:** `aws4fetch` 1.0.20 (published 28 Aug 2024, over 2 years old), exact-pinned. It is a small SigV4 signer on `fetch` with no dependencies, and covers PutObject, GetObject with `Range`, and DeleteObject, which is all the interface needs. The AWS SDK v3 would add a large dependency tree and its own retry and multipart behaviour, which D57 wants off. Only `sign()` is used; the request is sent with the injected `fetch`, so aws4fetch's own retry loop (which lives in its `fetch()` method) never runs, and tests mock the fetch.
- **Selection:** `STORAGE_DRIVER=local|r2`, default `local`. `r2` requires `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `R2_BUCKET`; a missing one fails the env parse at startup with "<NAME> is required when STORAGE_DRIVER=r2" (names only, never values). Endpoint `https://<account>.r2.cloudflarestorage.com/<bucket>/<key>`, region `auto`, path-style.
- **Behaviour:** `put` is one PutObject of the buffer. `read` forwards a single valid `bytes=` range as `Range` and maps 200 (size from content-length), 206 (from content-range), 404 (null) and 416 (`{ unsatisfiable: size }`); the response body is handed on as a stream (`Readable.fromWeb`), never buffered. `remove` is DeleteObject and a 404 is success. Other statuses throw an error holding only the operation and status. The driver re-checks the server-generated key pattern before any request, like the local driver.
- **Retries:** none. `metered` counts one operation per `put` or `read` call; a hidden retry inside the driver would send a second billable request the counter never saw, undercounting against the free tier. A 5xx therefore surfaces as a 500 and the caller can retry, which is counted. Failing closed on usage beats a small gain in resilience.
- **Timeouts:** 60 s to response headers for put, 30 s for read, 15 s for delete (abort via `AbortController`). The read timer stops once headers arrive, so a long video stream is not cut off; a stalled body is bounded by the client connection and the existing server limits. A put that times out may still have stored the object, so the image and video routes record the key before the put and remove it (best effort) when the put fails.
- **Tests:** STO-TC1 to TC11 with a mocked fetch (signing shape, Range, status mapping, no retry, key check, timeout, env errors) and STO-TC12, an opt-in live smoke (`R2_LIVE_TEST=1`) of put, ranged read and delete under the `t/` prefix (the key pattern allows a single-letter prefix, so `test/` is not used).
- **Reversibility:** Easy: `STORAGE_DRIVER=local` restores the previous behaviour; no schema change.

## D61 - Vite+-native toolchain (20 Oct 2026)
- **Context:** D47 added Vite+ 1.3.0 on top of npm workspaces, `tsc` builds, `concurrently` and npm pre-hooks, with
  type-aware lint off because the CommonJS server tsconfig was rejected by tsgolint. The user approved finishing the move
  on 20 Oct. No app behaviour changes.
- **What changed:** pnpm 12.14.0 workspaces with a catalog for `vite`/`vitest`/`vite-plus`; the server is ESM and built by
  `vp pack` (tsdown); `shared` is built by `vp pack` (ESM plus `.d.ts`); `vp check` runs format, lint, type-aware lint and
  the type check; tests import from `vite-plus/test` and Vitest comes only through Vite+ (pinned 5.0.5); `run.tasks`
  replace npm scripts, `concurrently` and the pre-hooks; git hooks run `vp check --fix` on staged JS/TS; CI uses
  `setup-vp` and the Vite Task cache. Details and fixes in `docs/sprints/vite_plus_migration.md` ("Native migration, 20 Oct").
- **Why:** one toolchain and one config file per package instead of npm, tsc, concurrently and lint/format scripts;
  cached tasks, so an unchanged check, build or client test replays in under a second and `shared` builds once for every
  consumer; type-aware lint, which caught 140 real warnings (unbound callbacks, floating `navigate` promises, unsafe
  stringification, comparator-less sorts); pnpm, which installs about 9x faster here and keeps dependencies strict.
- **Vite+ features used:** `vp migrate --full` (catalog, overrides, import rewrite, hooks); `vp check` with `typeAware`
  and `typeCheck`; Vite Task cache locally (`run.tasks`, `dependsOn`, `cache.env`, `untrackedEnv`, `cache: false` for the
  DB-backed server tests) and in CI (`actions/cache` restore/save of `node_modules/.vite/task-cache`); `vp hooks` with a
  `staged` block; `vp pack` for `shared` and the server; `vp env pin` (`.node-version` 24.22.0, `packageManager`
  pnpm@12.14.0); VS Code settings for the Vite+ extension pack with Oxc as formatter and fixer; Vite 8
  `resolve.tsconfigPaths` in the client.
- **Timings (median of 3, seconds, same machine):**

  | Task | Before | After (uncached) | After (cached rerun) |
  |---|---|---|---|
  | Install | 94.57 (`npm ci`) | 10.54 (`vp install`) | - |
  | Static checks | 17.67 (typecheck + lint + format) | 5.08 (`vp run check`) | 0.73 |
  | Client tests | 14.70 | 15.67 | 0.85 |
  | Server tests | 93.16 | 85.04 (never cached) | - |
  | Build | 13.35 (included `tsc --noEmit`) | 3.35 (types moved to check) | 0.94 |
  | Dev cold start to ready | 3.35 | 2.31 | - |

- **Version policy (user, 20 Oct):** newest releases, exact pins, pnpm `minimumReleaseAge` 3 days (4320 minutes) for npm
  packages, Vite+ toolchain excluded (`vite-plus`, `vite`, `vitest`, `@voidzero-dev/*`, oxlint, oxfmt, tsdown, rolldown);
  Node on the newest LTS (24.22.0). Patch and minor updates from `vp outdated -r` were applied; majors left for a
  decision: `@sentry/node` 10.75.3 → 11.8.0, `typescript` 5.9.3 → 7.0.2, `@types/node` 24.19.2 → 26.6.5 (tracks Node 26).
- **CI check uncached:** CI runs `vp run --no-cache check`, because it is not proven that the task fingerprint covers every file tsgolint reads; build and client tests stay cached.
- **IR stack:** unchanged. Vite (8.3.4 inside Vite+) is still the bundler and dev server for the React + TypeScript +
  Tailwind client, Vitest still runs the tests, and the server is still Node.js + Express + PostgreSQL + Socket.io with
  dbmate migrations. Vite+ is the command line that drives those tools, plus Oxlint, Oxfmt and tsdown, which replace the
  `tsc` emit step. pnpm replaces npm as the package manager, which the IR does not fix.
- **Reversibility:** Medium: revert the branch; the app code changes are type-only or lint fixes and survive a revert of
  the tooling.

## D62 - Rename to NotaLah (20 Oct 2026)

- **Decision (user, 20 Oct: "Everything"):** the code repository now says NotaLah instead of PARP. No feature change.
- **What changed:** packages `parp` to `notalah` and `@parp/shared` to `@notalah/shared`; auth cookie `parp_token` to
  `notalah_token`; CSRF header value `X-Requested-With: parp` to `notalah`; Docker role, database and test database
  `parp`, `parp_test` to `notalah`, `notalah_test`; volume `parp_pgdata` to `notalah_pgdata`; `.env.example`, CI
  service and `CREATE DATABASE`, test temp directories (`notalah-uploads-test`, `notalah-video-`), test e-mail
  domains (`@notalah.test`), README, CLAUDE.md, ARCHITECTURE and the Chapter 4 test-case rows that quote the cookie and
  header. Host port 5433 is unchanged.
- **Forced re-login:** the server now reads only `notalah_token`, so every existing session cookie is ignored and every
  user is logged out once. Tokens are not migrated: the app is pre-launch and a second cookie name would linger in
  the code.
- **Dev data:** to keep an existing dev database, follow `docker/rename-from-parp.md` (rename role and databases, copy
  the volume, update `.env`). A fresh clone needs nothing.
- **Left as history:** D1-D61, sprint reviews, specs, dated walkthroughs, the Chapter 4 prose, figures and wireframes
  that say PARP, the comment in the applied initial migration, and the GitHub repository URL, which keeps its old name.
- **Alternatives:** keep accepting `parp_token` for a release (rejected, extra code for no users); leave the database
  names as they were (rejected by the user).
- **Reversibility:** Medium: the old volume is never modified, so before it is deleted, `git checkout main` with the old compose file and `.env` values restores the old setup; after that, revert the branch and rename the role and databases back.

## D63 - TypeScript 7 (20 Oct 2026)

- **Decision (user, 20 Oct):** upgrade `typescript` from 5.9.3 to 7.0.2, the Go-native compiler. No behaviour change.
- **What changed:** `typescript` is now one exact pin, `7.0.2`, in the pnpm catalog (`pnpm-workspace.yaml`), and
  `shared`, `client` and `server` reference it with `catalog:`. No source, tsconfig or tool-config change was needed.
- **Compatibility checked on 7.0.2:** `tsc --noEmit` is clean in all three packages (no new type errors); `vp pack`
  builds `@notalah/shared` and emits its `.d.ts` through TypeScript 7 (tsdown prints a warning that the 7.0 API is
  experimental), so `isolatedDeclarations` was not needed; `vp check` type checking runs on tsgolint, which bundles its
  own compiler and does not read the `typescript` package; `tsx` and Vitest transpile with esbuild and are unaffected;
  the VS Code setup uses the Oxc extension, not the TypeScript server. Server tests 367 passed and 2 skipped, client
  113 passed, `vp run -r build`, the built server's `/api/health`, and `vp run dev` all pass. The generated `.d.ts`
  differs from the 5.9.3 output only in member order and quote style.
- **Install guard:** 7.0.2 was published on 8 Jul 2026, so it clears the 3-day `minimumReleaseAge`; no exclusion added.
- **Speed (`vp run --no-cache check`, median of 3):** 5.35 s before (5.35, 5.41, 4.77), 4.63 s after (4.49, 4.86,
  4.63). The check's own type step is tsgolint in both, so the difference is mostly the shared `.d.ts` emit and noise.
- **Alternatives:** stay on 5.9.3 (rejected by the user); `isolatedDeclarations` for shared (not needed).
- **Reversibility:** High: revert the catalog entry and the three `catalog:` references, then `vp install`.

## D64 - Sentry SDK 11 (20 Oct 2026)

- **Decision (user, 20 Oct):** upgrade `@sentry/node` from 10.75.3 to 11.8.0. No behaviour change: D41 still holds
  (Sentry is imported only when `SENTRY_DSN` is set, only 5xx errors are reported, tagged with the request id, with the
  request URL, headers, cookies and body stripped).
- **What changed:** `server/src/lib/errorReporting.ts` replaces `sendDefaultPii: false` with an explicit
  `dataCollection` block. v11 removed `sendDefaultPii` and now collects everything unless told otherwise (user info,
  cookies, headers, HTTP bodies, query params, database query data, queue arguments, local variables), so every
  category is switched off (`userInfo`, `cookies`, `httpHeaders`, `urlQueryParams`, `databaseQueryData`, `queues`,
  `stackFrameVariables` false; `httpBodies: []`). `beforeSend` still deletes `event.request`. `init`, `withScope`,
  `setTag` and `captureException` are unchanged in v11.
- **Checked:** tracing stays off because no `tracesSampleRate` or `tracesSampler` is set, so v11's span streaming and
  new HTTP attributes never run. Source context lines now default to 5 (was 7), which sends less. Node 20.19 minimum is
  met. New test `OPS-TC6` asserts the `dataCollection` options, the `request` stripping and the request-id tag.
  Not verified against a real DSN (none available).
- **Alternatives:** keep `sendDefaultPii: false` (silently ignored in v11, so everything would be collected); stay on v10.
- **Reversibility:** High: pin 10.75.3 and restore `sendDefaultPii: false`.

## D65 - Hosting on Render free tier (supersedes D29's Fly.io choice) (R37, 20 Oct 2026)

- **Decision (user, 18 and 20 Oct):** the API runs as one Render free web service at `api.<domain>`; the client stays on
  Cloudflare Pages at `app.<domain>`, the database on Neon and uploads on R2 (D60). D29's Fly.io backend is dropped.
- **Why:** Fly.io no longer has a free tier and cannot cap spending, and the project must never exceed a free tier.
  Render's free web service costs nothing and stops rather than bills.
- **Constraints of the free instance, and how R37 answers each:**
  - *Sleeps after 15 idle minutes, about a minute to wake:* the in-process daily purge timer can miss its slot, so
    `.github/workflows/purge.yml` runs `vp run server#db:purge` daily (and on demand) against `PROD_DATABASE_URL`; it skips
    with a notice when the secret is absent. The timer stays as a best-effort fallback. The Neon pool timeout (D34) already
    tolerates a cold database.
  - *Behind Render's proxy (one hop):* `trust proxy` now comes from `TRUST_PROXY`, a hop count or `loopback` (dev default),
    never `true`, which would let a client forge `X-Forwarded-For`. Production sets `1`, so `req.ip` is the client and each
    guest gets its own rate-limit bucket (the D35 and D44 pre-deploy item). `1` holds only while `api.<domain>` is
    DNS-only (grey cloud) in Cloudflare; proxied through Cloudflare (orange cloud) it is two hops, so `2`. The guards
    refuse `loopback` and `0` but cannot tell 1 from 2, so the first deploy is checked by hand: with `DEBUG_PROXY=1`
    each `GET /api/health` logs `req.ip` beside the raw `X-Forwarded-For`, and the logged ip must be the caller's own
    public address. The flag is unset afterwards.
  - *Ephemeral disk:* production refuses `STORAGE_DRIVER=local` at startup.
  - *One instance, 512 MB:* Socket.io rooms and the guest ranking cache stay in process (D50, D44); comments now name
    Render. Video transcoding (ffmpeg) is the heaviest memory user and moves off the API under R40.
  - *Campus lab behind one IP:* the per-IP login and register cap rises from 10 to 60 per minute, and a second limiter
    counts failed logins per IP and normalised email (10 per minute; a successful login takes its hit back), so one
    account's guesses do not lock out a lab. Asset file GETs are counted only by the file limiter, not also by the guest
    read limiter. Accepted trade-off: the per-IP cap is still shared, so one person in a lab sending 60 attempts in a
    minute blocks logins for everyone on that IP for the rest of the minute; a per-account limit alone would let one
    IP guess across many accounts.
  - *Purge accuracy:* each rate-limit key prefix is purged after its own window, so the hourly upload, video and Unsplash
    counters are no longer wiped by the one-minute window. An asset row is still marked deleted before its files are
    removed (so a note cannot link a file being removed); a file that fails to go is logged with its key as orphaned,
    and `db:purge` then exits 1 so the workflow run shows red.
- **Startup guards:** with `NODE_ENV=production`, or `RENDER=true` (set by Render on its services), the server refuses
  to start when `STORAGE_DRIVER` is `local`, `CLIENT_ORIGIN` is not `https://`, `COOKIE_SECURE` is not true or
  `TRUST_PROXY` is `loopback` or `0`. Each message names the variable, never its value. The `COOKIE_SECURE` default
  follows that parsed production flag rather than reading `process.env` separately.
- **Sliding session:** the JWT still lasts one hour, but a request whose token has under 15 minutes left gets a fresh
  cookie (same flags, new hour), so an active user is not logged out mid-session. Tokens carry an `auth_time` claim (the
  login time), copied into each renewal; past `MAX_SESSION_HOURS` (default 12) since login the cookie is no longer
  renewed, so a session left open on a shared lab PC ends within 13 hours. Tokens issued before R37 have no `auth_time`
  and simply expire. The server still cuts a socket when its token expires; the client reconnects after a server-side
  disconnect, after a random 1-3 s delay so tabs do not reconnect at once, and the handshake reads the renewed cookie,
  so socket expiry follows the new token.
- **Domain requirement:** both `pages.dev` and `onrender.com` are on the Public Suffix List, so `*.pages.dev` and
  `*.onrender.com` are different sites: the SameSite=Lax login cookie set by the API would not be sent from the client's
  requests. The app therefore needs its own domain with `app.` and `api.` subdomains before the live deploy.
- **Under R27:** a keep-awake ping (to hide the cold start during UAT and the demo) and a k6 load test of the free instance.
- **Supply chain:** `actions/checkout` is pinned by commit SHA with `persist-credentials: false` in both workflows, and
  the purge workflow gives its secrets only to the gate and purge steps.
- **Tests:** DEP-TC1 to DEP-TC11.
- **Alternatives:** Fly.io (rejected: no free tier or spending cap); a paid always-on instance (rejected: never exceed a
  free tier).
- **Reversibility:** Medium: the app is a plain Node process, so another host needs only its env values (`TRUST_PROXY`
  set to that host's hop count) and a start command.

## D66 - Architecture review decisions (20 Oct 2026)
- **Context:** a read-only whole-codebase audit and a review of the planned deployment scored the code 59/100 and the
  planned system design 55/100 across eleven quality attributes. The user decided each design question on 20 Oct.
- **Domain:** claim the GitHub Student Pack `.me` domain before R11. The client (`app.`) and API (`api.`) must share
  one registrable domain, because `pages.dev` and `onrender.com` are on the Public Suffix List and the SameSite=Lax
  login cookie would never reach the API.
- **Video (R40):** uploads return at once with status `processing`; a Postgres job table and worker loop transcode
  (inside the API on the free tier, a separate worker later with no code change). `VIDEO_PROFILE=free` stream-copies
  compatible MP4 and otherwise re-encodes at most 720p, one job at a time; `standard` allows 1080p and several jobs.
  The editor shows the limits as a disclaimer, and Chapter 6 records the scale-up path.
- **Public media:** media of public notes is served from a CDN-cached public R2 custom domain; friends-only and draft
  media stay behind the API's visibility checks.
- **AI vendors:** keep Groq (R28), Gemini Flash-Lite (R35) and Workers AI Whisper (R36); users are told that
  Gemini's free tier may use uploads.
- **R27** becomes live-site evidence: a k6 load test for NFR1, a keep-awake ping within Render's 750 free hours
  (after checking Render's terms) and one Neon restore drill. Two-instance scale-out is future work.
- **Follow-ups logged in PLAN:** R37 deploy readiness, R38 clean-up, R39 feed payload, R40 video pipeline.
- **Housekeeping:** wireframes v3 (generator, SVG, PNG) moved to the report repo (`FYP_Submissions/wireframes/`);
  placeholder feature READMEs, `docs/PROGRESS.md` and `docs/system-design-review.html` deleted; `docs/README.md`
  indexes the docs; nested `client/CLAUDE.md` and `server/CLAUDE.md` added.
- **Alternatives:** proxy `/api` through Cloudflare without a domain; keep 1080p synchronous transcoding; stream all
  media through the API; drop R27.
- **Reversibility:** High for all items; none changes an FR or the fixed stack.

## D67 - Async video pipeline (R40, 20 Oct 2026)
- **Context:** R29 (D59) transcoded each video inside the upload request with up to two ffmpeg runs at once. On the Render
  free instance (D65: 0.1 CPU, 512 MB, sleeps when idle) a 90 s re-encode can take minutes, holds the request open past
  proxy timeouts and competes with every other request for the one CPU. The user approved moving it off the request on
  20 Oct (review finding 3, R40).
- **Decision:** `POST /api/assets/videos` streams the body to a temp file as before, checks it with ffprobe only (size,
  length, container, edges), stores the original under an `o/` key (one metered put) and answers 202 with
  `status: processing`. The asset row and a `VIDEO_JOB_T` row are written in one transaction. A worker claims the oldest
  open job with `FOR UPDATE SKIP LOCKED`, holds a two-minute lease renewed every 30 s, downloads the original, runs ffmpeg,
  stores the MP4 and a WebP poster, marks the asset `ready` and deletes the original. Only a bad-file result fails at
  once (ffmpeg or ffprobe exits with an error, or runs past its timeout); anything else, including ffmpeg killed from
  outside (for example by the OOM killer), storage or database errors, is retried after 30 s times the attempt, and the
  third failure marks the asset `failed` with a reason the uploader sees. The free-tier usage cap (D57) puts the job back
  for an hour and gives the attempt back, so a capped month never fails or deletes an upload. When a lease renewal finds
  the claim lost, the worker aborts its ffmpeg through an `AbortSignal`; `stop()` aborts in-flight jobs the same way and
  requeues them at once without using up the attempt. A lapsed lease (the process died or slept) makes the job
  claimable again; the attempt count doubles as the claim token, so a late worker cannot overwrite a newer claim.
- **Profiles:** `VIDEO_PROFILE=free|standard` (zod, default `free`) in `assets/config.ts`. `free`: stream-copy an H.264
  yuv420p MP4 (or MOV) that already fits 1280x720, otherwise re-encode with libx264 veryfast into that box; one job at a
  time with one ffmpeg thread. `standard`: the same rule with a 1920x1080 box, two threads and `VIDEO_CONCURRENCY` jobs
  (default 2). Size (50 MB) and length
  (90 s) limits are unchanged. Output is always H.264/AAC MP4, so WebM input is re-encoded rather than kept as WebM: one
  format plays everywhere (Safari included) and x264 is far cheaper than VP9 on a shared CPU.
- **Where it runs:** `startVideoWorker()` runs inside the API process (started in `server.ts`, stopped on shutdown) unless
  `VIDEO_WORKER_IN_PROCESS=false`; `server/src/scripts/videoWorker.ts` (`vp run server#worker`) runs the same loop as its
  own service with no code change. An upload in the API process wakes its own worker at once; a separate worker polls
  every 30 s, which keeps an idle worker to two small queries a minute.
- **Serving:** the file and share routes answer 409 `{ status: 'processing' }` or 404 `{ status: 'failed' }` instead of a
  broken file; notes carry `videoStatus` (asset id to status) beside `assets`; a processing or failed video stays
  linkable so saving a note never drops it. The owner polls `GET /api/assets/:id`; the editor shows the limits from
  `GET /api/assets/videos/limits` ("Demo server: videos up to 90 s, 50 MB, 720p.") and a processing or failed tile on the
  slide. Quota counts a processing original; purge leaves processing videos to the worker.
- **Scale-up path:** (1) a paid Render instance with `VIDEO_PROFILE=standard`; (2) a separate background worker running
  `server#worker` with `VIDEO_WORKER_IN_PROCESS=false` on the API, scaled by instances and `VIDEO_CONCURRENCY`, since
  SKIP LOCKED lets any number of workers share the table; (3) a managed video service (for example Cloudflare Stream or
  Mux) behind the same job table and statuses, so the client and note payloads do not change.
- **Alternatives:** keep the synchronous transcode (rejected: blocks the request and the CPU); a Redis or BullMQ queue
  (rejected: another service to host, while Postgres is already there and SKIP LOCKED is enough at this volume); a
  managed video service now (rejected: paid, and the free tier is a requirement).
- **Known limits:** a re-encode that grows can overshoot the 500 MB quota by under 50 MB, because the quota is checked
  against the original's size; finished job rows are kept (a few bytes each) rather than purged; the editor polls every
  4 s rather than listening on the socket. A process that dies after storing the `v/` file and poster but before the job
  completes leaves those two objects orphaned (the retry stores new ones), and one that dies after the commit but before
  removing the `o/` original leaves the original; neither is referenced by any row, so the asset purge never sees them.
  The down migration marks processing and failed assets `rejected` but leaves their `o/` originals in storage.
- **Tests:** VID-TC1 to VID-TC15; NOTE-TC39, NOTE-TC70 and STO-TC15 updated for the 202 flow and the profile box.
- **Reversibility:** Medium: the migration has a down step (processing and failed assets become rejected); reverting
  the code restores the synchronous route.

## D68 - Code clean-up (R38, 20 Oct 2026)
- **Context:** the 20 Oct architecture review (D66) found copy-paste, hand-written permission checks and cache gaps. No
  behaviour changes except the caching and metering items below.
- **Lockfile:** the server pinned `@types/node` 24 while the rest resolved 26, so `vite-plus` and `vitest` each resolved
  twice (one copy with Sentry's `@opentelemetry` peer) and local runs sometimes failed with "Vitest failed to find the
  runner". One `@types/node` override in `pnpm-workspace.yaml` leaves a single copy (`pnpm why vitest`).
- **Rate limiters:** `createLimiter` in `auth/rateLimit.ts` holds the shared headers, `PgStore` prefix and test switch;
  each feature builds its own limiter (assets: upload, video, file; unsplash; auth: login, register, write, guest).
  `PgStore.windows` still records each prefix's window, so the R37 purge is unchanged. The file cap moved to `ASSETS`.
- **Note access:** `notes/access.ts` `noteAccess(req, res, roles, { editable, forbidden })` replaces the helper in
  collaboration and the hand-written checks in the note routes (404 unreadable, 403 wrong role, and with `editable`
  403 hidden or restricted author). Same statuses and messages.
- **Publish:** `POST /api/notes/:id/publish` is one conditional UPDATE (`publishNote`: status, visibility, published_at,
  only for the owner's draft whose `pst_updated_at` still equals the value read, compared at millisecond precision).
  Completeness rules moved to `publishErrors` (hashtag, non-blank slide, module). `replaceNote` lost `ignoreLock`.
  The same transaction deletes the blank slides and renumbers the rest (as a save of a published note does), so a later
  save does not read the difference as a content edit and void Super Likes.
- **Guest feed:** a guest's first page rounds "now" down to 60 s, so guests share one cached ranking per minute; a note
  published in the last minute reaches guests a little later. An explicit `asOf` is untouched.
- **Media:** asset files are `Cache-Control: private, max-age=31536000, immutable` with `Vary: Cookie`, and logout
  sends `Clear-Site-Data: "cache"`, so a shared browser drops its copies when the user signs out. Trade-off: a hidden or deleted
  note's image can stay in a browser that already holds it (it was five minutes before); the URL still checks
  visibility for everyone else.
- **Served bytes:** new monthly metric `served_bytes` in `"USAGE_COUNTER_T"` (no migration), counted by a Transform as the
  bytes stream, so an aborted download counts what was sent. `USAGE_CAP_SERVED_BYTES` can lower the 50 GB default (half of Render's free 100 GB); at the cap video
  requests answer 503 and images and posters keep serving. It appears in the admin usage report.
- **Other:** 57 file-local exports and four shared deck schemas are no longer exported; a read past the Class B cap says
  "Media is temporarily unavailable"; the image upload route checks `UPLOADS_DISABLED` before reading and re-encoding.
- **Alternatives:** a per-limiter class (more code for the same result); counting served bytes up front (simpler, but an aborted download counts in full); stopping all media at the bandwidth cap (rejected: images are small).
- **Purge:** `lib/purge.ts` imports every limiter module, so the daily purge knows each hourly window even when it runs
  without the app (the unsplash limiter moved to `unsplash/rateLimit.ts`). `@types/node` comes from the pnpm catalog.
- **Tests:** CLN-TC1 to CLN-TC4, DEP-TC12; USE-TC4 and USE-TC7 updated.
- **Reversibility:** High: no schema change; each item is its own commit.

## D69 - Deck themes, slide layouts and fonts (R21d, 20 Oct 2026)
- **What:** `shared/src/design.ts` holds the design data the editor and the future AI assistant (R28) share:
  `FONT_NAMES` for the six curated fonts, six deck themes (`THEMES`: the four old templates `plain`, `lecture`,
  `revision`, `howto` plus `journal` and `midnight`; each a background, heading, text, accent and muted colour, a heading
  and a body font and a code-block style), five layouts (`title`, `title-body`, `two-column`, `code`, `image-caption`)
  built by `layoutSlide(layout, theme, aspect, newId)` for any aspect, and `applyTheme(deck, id)`.
- **Applying a theme** writes concrete values into every element (R21 spec 2.3), so a later edit to `THEMES` never
  changes a saved note: text at size 40 or more takes the heading font and colour, smaller text the body ones
  (a JetBrains Mono box keeps its font; inline span colours are kept); tables take the body font, text colour and muted
  borders; shapes and lines take the accent, except a shape filled with the previous theme's muted colour (the image
  placeholder), which stays muted; code blocks take the theme's code style; every slide without a photo background gets
  the theme background. One undo step. A text box with a fill keeps its text colour, so the pair stays readable (light
  Midnight text on a white box would vanish). Hand-coloured inline words (span colours) are kept on purpose; undo
  restores the rest. New text, shapes, lines, tables, code and blank slides are created in the current
  theme. Old decks (`lecture`, `revision`, `howto`, saved before R21d with plain styling) get the theme only for new
  content; clicking the theme card makes the whole deck match. `pst_template` stores the theme id (no migration: the column has no CHECK and the schema already rejects
  unknown ids).
- **UI:** a Design panel first in the editor rail and phone tray (theme cards, live layout previews). A layout fills the
  active slide when it has no elements (keeping its page notes), else becomes a new slide after it. The Template select
  left the Details panel. The font select lists only the curated fonts, each in its own face.
- **Fonts:** self-hosted woff2 from `@fontsource` (`source-sans-3` 5.3.1, `lora`, `merriweather`, `montserrat`,
  `jetbrains-mono` variable 5.3.0; `atkinson-hyperlegible` 5.3.0 static 400/700), upright and italic, imported in
  `index.css`. `@font-face` files download only when a slide uses them, so the app's own first paint is unchanged.
- **Alternatives:** storing only the theme id and resolving styles at render time (rejected by the spec: a palette edit
  would restyle published notes); a role field on elements to mark headings (rejected: the strict schema and the AI
  output would both need it; the size rule is enough); Google Fonts CDN (rejected: third-party requests and text
  measurement drift); an image placeholder element type (rejected for now: a muted rectangle the author replaces is
  enough and needs no schema change).
- **Tests:** NOTE-TC91 to NOTE-TC94.
- **Reversibility:** High: no schema change; themes and layouts are constants, and saved notes carry their own values.

## D70 - Notifications inbox UI (R8, 20 Oct 2026)
- **Context:** the backend landed in D51. This is the client half, matched to wireframes 43 and 44.
- **Decision:** `features/notifications/`. `NotificationsProvider` (in `main.tsx`, inside `MessagingProvider`) reuses the
  messaging socket: it loads `/notifications/unread-count` on every (re)connection, applies `notification:new` and
  `notification:count`, and keeps the live items for the page. `/notifications` shows filter chips (All, Mentions,
  Follows, Super Likes, Requests, System, each a `type` filter), rows grouped Today / This week / Earlier, Mark all read,
  Show more through `usePaged`, and the R30 `CollabRequestActions` inline on pending collaboration requests. Opening a
  row marks it read. `usePaged` now joins its cursor with `&` when the path already has a query.
- **Navigation:** Notifications in the desktop rail with a count pill. On phones the bell sits in the top bar and in the
  More menu, both with the notification count. The bottom tab bar's Inbox tab (chats and notifications meet there,
  wireframe 45) shows one badge, unread messages plus unread notifications, labelled "Inbox, N messages and M
  notifications" (user decision, 20 Oct). The bar keeps its five fixed slots (wireframe 13).
- **Mentions:** the comment and reply boxes suggest people while typing `@name` (keyboard and pointer) and send the ids
  whose `@Name` is still in the text, which is what the server checks. Suggestions match the server's rule: a new
  comment offers the note's author and friends, a reply also the thread's commenters. Friends are fetched once per
  comment panel, when the first `@` is typed. The panel gets `noteAuthor` from NoteDetail and Feed.
- **Counts:** while the socket is connected the badge changes only on `notification:new` / `notification:count`; HTTP
  replies could land after a newer push. A fetch that started before a push is dropped. Without a socket the reply is used.
- **Not built:** wireframe 43's "Message requests" summary row, "Follow back" and "Re-confirm" buttons, and the
  note thumbnails; rows link to the target instead.
- **Tests:** NTF-TC19 to NTF-TC25 (client).
- **Reversibility:** High: client only, no schema or API change.

## D71 - Feed payload: first slides only (R39, 20 Oct 2026)
- **Context:** review finding #9: the ranked, Following and guest feeds returned every slide of every note, though a card
  shows one slide at a time.
- **Decision (user):** the three feeds return the first 2 slides (the visible one and the hidden neighbour the carousel
  preloads), `slideCount`, and the `assets` and `videoStatus` entries those slides use. Constant `CARD_SLIDES` in
  `feed/repository.ts`; `noteCols(slideLimit)` in `notes/repository.ts` builds the columns (`NOTE_COLS` is unchanged, all
  slides) and every note now carries `slideCount`.
- **Rest of the slides:** `SlideCarousel` takes `slideCount` and `onNeedMore`; on the last loaded slide the card calls
  `GET /api/notes/:id` once and keeps the full slides, assets and video status in its own state. No new route, so the
  detail endpoint's checks (friends-only, hidden, suspended author) apply unchanged. The carousel never moves past the
  loaded slides: a tap or swipe toward an unloaded slide asks again (the card ignores it while a request is in flight), so
  after a failed fetch the next Next tap retries. The card also copies `slideCount` from the fetched note, so a note
  shortened since the feed page shows the right dots.
- **Payload (page 1, 10 notes of 8 slides, three text elements each, test DB; the project has no seed script):**
  228,544 B before, 62,676 B after (-72.6%). Notes with images save more.
- **Unchanged:** ranking, snapshots and paging. Cost: a swipe past slide 2 shows the slide after one request; the viewer's
  counts and flags still come from the feed.
- **Tests:** FEED-TC1 to FEED-TC4, CLI-TC70. The server suite now makes one temp directory per run
  (`server/vite.config.ts`: `STORAGE_DIR` under it, `TMPDIR`/`TMP`/`TEMP` pointing at it), so parallel runs no longer
  see each other's `notalah-video-*` files, which had made `tests/assets/video*.test.ts` flaky.
- **Reversibility:** High: no schema change; raise `CARD_SLIDES` or drop the limit to restore the old payload.

## D72 - Feed video player (R29, 20 Oct 2026)
- **Context:** the server half (D59, D67) is done; boards drew a bare `<video controls>`. The feed needs TikTok-style
  muted autoplay with tap for sound, and R9 background audio will need to share the "one sound at a time" rule.
- **Decision:** `components/board/VideoPlayer.tsx` replaces the bare element. Muted, `playsInline`, `preload="metadata"`,
  poster shown until playback. It plays while an IntersectionObserver reports at least 50 % visible and its slide is the
  carousel's current one, and pauses otherwise. A tap on the video or the sound button (top right, `aria-pressed`) turns
  sound on; sound goes off when the video pauses or leaves view. Processing and failed tiles are unchanged (`VideoTile`).
  Note view, shared note and feed share the player; the note view also starts muted, so nothing autoplays with sound.
- **Reduced motion:** no autoplay; poster plus a centred Play button (Pause at top left once started). The same Play
  button appears when the browser refuses to play (low-power or data-saver mode) or a non-looping video ends. Controls
  show only while the video is on screen on the current slide; leaving view resets them. The sound button is labelled
  "Video sound" with `aria-pressed`. `preload="none"`: the feed never unmounts cards, so metadata fetches would add up.
- **Sound rule:** `hooks/useActiveSound.ts` keeps the id that currently holds sound (module store,
  `useSyncExternalStore`). `useActiveSound(id)` returns `{ active, claim, release }`; claiming mutes the previous holder.
  R9 reuses it with its own id for background audio.
- **SlideCarousel change:** each slide is wrapped in `SlideActive` (a context: true for the current slide). Outside a
  carousel the context is undefined and a board shows the poster only, so profile and search tiles never autoplay.
  `SlideBoard` also publishes its scale (`BoardScale`) so the buttons keep a 44 px size inside the scaled board.
- **Editor picker:** already enabled (`VideoPicker` in Elements, D59 upload flow, VID-TC15); D58's "disabled tile" note
  is out of date. No change.
- **Chrome quirk:** an observer created in the same commit as the board's scale transform could report an empty box
  once and never update (seen with reduced motion), so observation starts two frames after mount.
- **Gap for design:** the sound and play icons are `media` with `media-shadow`; over very bright footage they are faint.
- **Tests:** CLI-TC71 to CLI-TC76; VID-TC10 now wraps its board in `SlideActive`.
- **Reversibility:** High: presentation only, no schema or API change.

## D73 - Background music from Jamendo (R9, FR17, 20 Oct 2026)
- **Context:** FR17 was restored on 14 Oct with Deezer, then switched to Jamendo (D43) because Deezer's terms limit use to
  private use. R21 stored the music reference with the title, artist and cover left empty. Spec: `docs/specs/R9_background_audio.md`.
- **Decision (user, agreed 20 Oct):** a note has at most one Jamendo track. The reader plays it by tapping (never
  autoplay); the viewer chip (below) is built on R29's `useActiveSound`. A deck with a video cannot have music
  (`MUSIC_VIDEO_CONFLICT`, "Remove videos to add music"), enforced by `deckSchema` and by the note save. In the editor the
  Music panel is disabled with that reason, and the video picker asks to remove the music first.
- **Schema:** migration `20261020000002_music_jamendo`: `pst_music_provider` CHECK now allows only `jamendo` (no row used
  `deezer`; the up step clears any such row first, the down step clears `jamendo` rows before restoring the Deezer check); new
  `pst_music_license VARCHAR(200)`. The data dictionary and ERD source list all seven music columns.
- **Save path:** `resolveMusic` in the notes routes looks the track up (`lookupTrack`) when it differs from the stored one, or
  when the stored title is still NULL, and stores title, artist, cover and licence URL. A track stored with details is not
  looked up again, so autosave does not spend the allowance. Unknown track: 400 `errors.music`. **Jamendo down, monthly cap
  reached or the user's daily budget spent: the save still succeeds** with the track id and volume and NULL details (a changed
  track clears the old details), and the next save retries, so autosave never fails because of music. A track found by
  search is remembered (500 ids) and reused by the save without a second call. A track whose details are still NULL and
  that Jamendo now reports as unknown is a 400 only when the track id changed; the same id saves as is (details stay NULL),
  so an unrelated edit never fails because of an old outage.
- **Viewer chip:** `components/MusicChip.tsx` in the feed card, `NoteDetail` and `SharedNote`: cover, "Title — Artist" and a
  "CC licence" link (new tab, `rel="noopener noreferrer"`), with the stream from `jamendoStreamUrl(trackId)`. One button,
  label "Background music", `aria-pressed`; it never autoplays, loops, uses the note's volume and `preload="none"`. It claims
  `useActiveSound` with its own id, so music and feed videos silence each other, and it pauses when under half on screen or
  unmounted. With NULL details the chip stays (so the track can still be heard) and reads "Music from Jamendo" with no licence
  link. A deck with music has no video, so the two never share a slide.
- **Search:** `GET /api/music/search?q=&instrumental=1&page=` proxies `/v3.0/tracks` (20 results, `vocalinstrumental=instrumental`
  when ticked, on by default). Results keep only tracks with a Creative Commons licence page and a Jamendo cover; the
  title is HTML-entity decoded (Jamendo sends `&quot;`). The stream URL is built from the id
  (`jamendoStreamUrl`, `https://prod-1.storage.jamendo.com/?trackid=ID&format=mp31`) and never read from Jamendo's reply or the
  request. Per-user limits: 20 a minute (`music`) and **300 Jamendo calls a day** (`musicday`, searches and save lookups together,
  so one account cannot drain the shared 28,000); identical searches cached 10 minutes; an empty answer is not cached.
- **Allowance:** Jamendo's free non-commercial plan allows up to **35,000 API requests a month**
  (https://developer.jamendo.com/v3.0, read 20 Oct 2026; the Jamendo licensing help centre quotes the same figure but
  answered 403 to a fetch). New R34 metric `jamendo` (monthly) capped at 80%, **28,000** (`USAGE_CAP_JAMENDO` can only lower
  it). Search and track lookups both count. At the cap: 503 "Music search is paused". The plan is non-commercial only; the
  demo is academic.
- **CSP:** there is none to change. The client has no CSP (no `_headers` or meta tag); helmet's default policy only covers API
  responses, which do not embed Jamendo media. Add `media-src https://prod-1.storage.jamendo.com` and
  `img-src https://usercontent.jamendo.com` to the host's policy if R11 introduces one.
- **Alternatives:** an own-upload music library (storage and copyright moderation); storing the stream URL (Jamendo's `audio`
  URLs carry a signed `from` token and expire); a `MUSIC_T` table (one track per note makes columns enough).
- **Tests:** MUS-TC1 to MUS-TC21; USE-TC7 and DEP-TC12 updated.
- **Reversibility:** High: one migration (down restores the Deezer check and drops the licence column), one feature folder.

## D74 - One free origin through a Cloudflare Pages proxy (supersedes the domain part of D65 and D66) (20 Oct 2026)
- **Context:** D65/D66 needed a registrable domain (`app.` + `api.`) so the SameSite=Lax login cookie reaches the API.
  The GitHub Student Pack `.me` domain is not available to the user (Malaysia), and the user wants no paid domain.
- **Decision (user, 20 Oct: option 1):** the client stays on Cloudflare Pages at its free `*.pages.dev` hostname. A Pages
  Function forwards `/api/*` and `/socket.io/*` (WebSocket upgrades included) to the Render free web service, so the
  browser only ever talks to one origin and the cookie is first-party. `_routes.json` limits the Function to those two
  paths, so static assets never invoke it (static requests are free and unlimited).
  - The Function overwrites `X-Forwarded-For` with `CF-Connecting-IP` (never appends a client-sent value); production
    sets `TRUST_PROXY=2` (Function + Render), checked once with `DEBUG_PROXY=1` as in D65.
  - Credentialed CORS is no longer needed in production; the startup guards stay.
  - Public-note media keep streaming through the API (no R2 custom domain, which needs an owned zone); `r2.dev` public
    URLs are not used (rate-limited, not for production).
- **Free-tier caps (the user must never pay; Cloudflare items):**
  - **Workers/Pages Functions:** stay on the Workers **Free** plan; never subscribe to Workers Paid. Free allows 100,000
    Function + Worker requests a day (reset 00:00 UTC); past it Cloudflare returns error 1027 instead of billing. The
    Pages project is set to **fail closed** so the proxy never silently bypasses to static pages. The k6 test (R27) stays
    well under the daily quota.
  - **R2:** the only Cloudflare product that bills past its free tier. Already guarded app-side by R34 (D57): storage,
    Class A/B ops and served bytes capped at 80% (monthly R2 caps 50% until the billing period is confirmed), kill switch.
  - **Workers AI (R36):** Free plan, 10,000 neurons a day, fails instead of billing; R36 adds an app-side daily cap at 80%.
  - **Account:** a Cloudflare billing notification (usage-based, lowest threshold) set by the user as a second line.
- **Limitation and future work:** a free-tier cap, not a design preference. Every API call takes one extra hop through
  the Function, the daily Function quota bounds total traffic, and the app lives on a platform subdomain. With a paid
  stack the upgrade is an owned domain with `app.`/`api.` subdomains (D65's layout), an R2 custom domain with CDN caching
  for public media, and an always-on API instance; no app code change beyond `TRUST_PROXY` and CORS origin. Recorded for
  Chapter 6 (limitations and future work).
- **Alternatives:** Vercel rewrites (no WebSocket, Socket.io falls back to polling; Hobby plan non-commercial); Express
  serving the client on Render (no CDN, cold start on page load); free subdomain services such as is-a.dev (volunteer-run,
  no zone for R2); a paid domain (rejected by the user: no cost).
- **Reversibility:** High: delete the Function and point `VITE_API_URL`/CORS at an owned `api.` domain.

## D75 - Text-anchored annotations (R10, 20 Oct 2026)
- **Context:** FR18 was settled on 14 Oct as text-anchored annotations, "reportable like comments". That assumed comments can be reported. They cannot: `"REPORT_T"` is note-level only and no comment report exists. The report part therefore had to be designed, not mirrored.
- **Decision:**
  - `"ANNOTATION_T"` (D75 migration `20261020000010`) holds a public annotation anchored to the selected text of one text element: slide position (`ant_slide_id`, as slides have no id of their own), element id, quote (300), offset and body (500). It is read by anyone who can see the published note (the comment access rules: friends-only, hidden, blocks, suspended and deleted authors; guests read public notes). `"POST_T".pst_annotations_on` lets the owner switch annotations off; the list is then empty and posting is 403.
  - Routes live in `features/annotations`. The off switch is a small owner-only `PATCH /api/notes/:id/annotations` instead of a field on the note PUT, which replaces the whole deck, takes the edit lock and is open to co-authors. A new annotation notifies the note author (R8 type `annotation`, never self, repeats by the same annotator within an hour collapse). A note holds at most 500 live annotations (409 beyond), so the unpaged list stays bounded. An edit never deletes annotations; the client shows unresolved anchors as "Text changed".
  - Reports reuse the queue: `"REPORT_T".rpt_ant_id` (nullable FK) with `rpt_pst_id` still the note. The note's open-report index now covers note reports only; a second index allows one open report per reporter and annotation. A block does not stop a report (D49); you cannot report your own annotation. The queue stays grouped per note and each report carries an `annotation` object. `POST /api/admin/reports/annotations/:annId/resolve` (`dismiss` or `hide`) resolves one annotation; `hide` sets `ant_hidden_at`, a timestamp apart from a user's `ant_deleted_at`, and the annotator gets an `annotation_hidden` notification. The note-level resolve leaves annotation reports open (404 when a note has only those). Annotation reports do not count in the note author's upheld total.
  - Not built: replies, editing after posting, pins on non-text elements, and a server check that the quote sits at the offset (the client resolves anchors).
  - Client (`client/src/features/annotations/`): selecting text inside one slide text element (`data-anchor`, the only `SlideBoard` change) on the note page shows a floating "Annotate" button; the anchor is the element id, the trimmed quote and its offset in the element's `textContent`. Highlights use the CSS Custom Highlight API (`::highlight(annotation)`, new `--annotation` tokens), so the slide DOM is never rewritten and a note with no annotations renders as before. An annotation belongs to the slide that now holds its element, so it follows the element when slides are moved or inserted (the saved `slideId` is used only once the element is gone). It resolves at its offset, else at the quote's occurrence nearest that offset; otherwise the panel lists it as "Text changed" with no highlight, and one whose saved slide no longer exists is listed on the last slide. A 403 on posting turns the panel off only for "Annotations are turned off for this note"; any other 403 (a restricted account) is shown as an error. A delete that answers 404 counts as already removed. The panel is a non-modal right sheet on desktop (text stays selectable) and a bottom sheet on phones; clicking a quote scrolls to and flashes its highlight. The note page's action bar shows the count; the owner's More menu holds "Turn annotations off / on". `ReportDialog` takes an `annotationId`; the admin review lists reported annotations (quote, body, author, deleted or hidden) with their own Dismiss and Hide annotation, and the note-level form covers note reports only. `annotation` notifications sit under All; `annotation_hidden` also under System. Client tests ANN-TC12 to ANN-TC16.
  - Known gaps: the shared-link page (`SharedNote`) shows no annotations, as a link viewer may fail the note's visibility check the list uses; feed cards show no annotation count, which would need a new note field; Shift+arrow selection in rendered (non-editable) text makes no selection in Chrome without caret browsing (F7), so annotating needs a pointer or touch selection (also noted for Chapter 6). The 500 cap is a count then insert, not atomic, so concurrent posts may pass it by a few (a `shortcut:` comment in the route).
- **Alternatives:** a separate annotation report table (no queue reuse); marking a moderator hide with a boolean or reusing `ant_deleted_at` (loses who removed it).
- **Reversibility:** Medium: the migration has a full down; removing the feature drops one table and three columns.

## D76 - Diagrams in Mermaid (22 Oct 2026)
- **Decision (user):** every diagram source is Mermaid text, not PlantUML. The 14 Chapter 4 sources in
  `docs/chapter4/diagrams/src/` are now `.md` files with a `mermaid` block; `00_architecture.md` adds the current
  architecture, deployment (D74) and async video (D67) diagrams. The user renders and styles them on mermaid.live.
- **Mapping:** class, sequence and ER diagrams map one to one (the ERD's `NOT NULL` comments mark PlantUML's mandatory
  columns). Mermaid has no use case or swimlane activity type, so those are flowcharts: use cases as stadiums with
  dotted «include»/«extend» edges, swimlanes as subgraphs, fork/join as thin bar nodes.
- **Why:** no Java toolchain; the user styles diagrams by hand.
- **Check:** all 17 blocks render with Mermaid 12.1.0.
- **Reversibility:** High: the `.puml` files stay in git history.
