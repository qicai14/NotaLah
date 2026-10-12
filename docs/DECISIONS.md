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
