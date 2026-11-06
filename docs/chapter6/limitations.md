# Known limitations

Source notes for the Chapter 6 limitations section. Each item is a known shortcut that is fine at UAT scale. Line
numbers are as of 6 Nov (main at `fab9b1a`). Source: issue #85, which quotes the audit `run-logs/audit_2026-10-29/server.md` §7 and §10 (outside this repo).

## View collaborator cannot see annotations on a contacts-only note

- What: a view collaborator who is not the author's friend can read a published contacts-only note, because note reads
  accept a collaborator role. Annotations, likes and comments check plain visibility instead, which needs a friend.
  So `GET /notes/:noteId/annotations` answers 404 for that user, and like or comment is refused.
- Code: `server/src/features/notes/repository.ts:37` (`READABLE` includes the collaborator role),
  `server/src/features/engagement/repository.ts:40` (`getTarget` uses `VISIBLE`),
  `server/src/features/annotations/routes.ts:17` (the annotations route, via `getTarget`).
  `server/src/features/engagement/routes.ts:17-22` (`target()`, used by like at :33 and comment at :80).
- Impact at UAT scale: small. It only hits a view collaborator on a contacts-only note who is not a mutual follower (friend) of the author (D38).
  They can still read every slide.
- Upgrade path: decide whether collaborators should engage. If yes, let `getTarget` accept a collaborator role. If no,
  keep it and add a test that pins it.

## D75 annotation cap can overshoot

- What: the 500-annotation cap per note counts live annotations, then inserts. The two steps are not atomic, so
  concurrent posts can pass 500 by a few.
- Code: `server/src/features/annotations/routes.ts:64-67` (`shortcut:` comment and check),
  `server/src/features/annotations/repository.ts:5` (`ANNOTATION_LIMIT = 500`).
- Impact at UAT scale: none seen. It needs several people posting to one full note in the same moment.
- Upgrade path: lock the note row (`SELECT ... FOR UPDATE`) around the count and insert.

## View log race

- What: logging a view checks, then inserts. Two simultaneous views by one user can both log.
- Code: `server/src/features/engagement/repository.ts:46` (`shortcut:` comment on `logView`).
- Impact at UAT scale: a rare extra view row. The client logs once per mount (D22), so it needs two requests at once.
- Upgrade path: a unique key on the view row, or an insert that ignores conflicts.

## Storage cap check is read-then-write

- What: `storageFits` reads the stored total, then the upload is written. Concurrent uploads can each pass and
  overshoot the cap by their combined size (up to a few 50 MB videos).
- Code: `server/src/features/usage/service.ts:50-56` (`shortcut:` comment on `storageFits`).
- Impact at UAT scale: none. The 2 GB headroom under the 10 GB allowance absorbs it.
- Upgrade path: an atomic reserve of the bytes before the upload.

## Feed ranks a 500-candidate window

- What: the feed ranks the newest 500 published notes plus notes with a valid Super Like. An unverified note older than
  the newest 500 is never ranked, however popular.
- Code: `server/src/features/ranking/repository.ts:18` (`shortcut:` comment on `getCandidates`),
  `server/src/features/ranking/config.ts:21` (`candidateLimit: 500`).
- Impact at UAT scale: none. The UAT data set is small enough that most notes fall in the window.
- Upgrade path: widen the window, or add a second pass for older notes with high engagement.

## Search latency at 10x seed

- What: at 10x seed (20,000 notes), keyword and Top search p95 is about 740 ms. That is above the 300 ms target but
  within NFR1's 3 s. No index helps: the cost is `ts_rank_cd` ranking when a common word matches most notes.
- Evidence: PR #103, ADR 0090 (`docs/adr/0090-no-index-for-search-ranking.md`),
  `docs/testing/load/2026-10-29_latency.md`, SRCH-TC23. The user accepted it on 29 Oct, with no fix.
- Impact at UAT scale: none. UAT runs on the normal seed.
- Upgrade path: future work. A fix such as ranking a capped set of newest matches would change which notes search
  returns.
