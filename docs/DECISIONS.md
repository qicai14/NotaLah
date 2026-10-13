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
