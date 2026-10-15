# server feature: search

Subject, module code, programme, hashtag, keyword, full-text and people search with lecturer, academic term, date range
and module filters (FR4, FR5/NFR1, FR12, FR15; D2, D47, D48).

Test table: `SRCH-TC1-16` in `docs/chapter4/4.5_test_cases.md`; tests in `server/tests/search/` (`perf.test.ts` is
SRCH-TC10, run with `SEARCH_PERF=1`; results in `docs/sprints/search_performance.md`).

- `routes.ts`: `searchRouter` at `/api/search`, `optionalAuth` (guests search public notes, IP limit, D44); zod validation.
- `service.ts`: `searchNotes` scores every match with `RANKING.searchWeights` (text rank, E, V) and slices a keyset page.
- `repository.ts`: all SQL. Reuses `VISIBLE`, `VERIFIED`, `VALID_VERIFICATIONS` and `countsCol` from `notes/repository.ts`
  and the `pst_search_doc` GIN index.
- Terms live in `features/modules` (catalogue): `GET /api/terms` and admin CRUD under `/api/admin/terms`.

| Method and path | Result |
| --- | --- |
| `GET /api/search?q=&tab=top` | `{items, nextCursor, people, hashtags, modules}`: a notes page (20 by default, `limit` 1-100) plus up to 3 of each other kind on page 1; later pages (`cursor`) return `{items, nextCursor}` |
| `GET /api/search?q=&tab=notes` | `{items, nextCursor}`; item = feed note shape (counts, liked, verified, ...); order S = 0.5·T + 0.25·E + 0.25·V, then newest. `#tag` = exact hashtag |
| `GET /api/search?q=&tab=people` | `{items: [{id, displayName, role, programme, avatarUrl, isVerifiedLecturer}], nextCursor}`; active and restricted accounts only |
| `GET /api/search?q=&tab=hashtags` | `{items: [{id, name, noteCount}], nextCursor}`; tags on at least one note the viewer can see |
| `GET /api/search?q=&tab=modules` | `{items: [{id, code, name, programme, noteCount}], nextCursor}` |
| Note filters | `lecturer=any` or a lecturer id; `term=<id>` or `from`/`to` (YYYY-MM-DD, inclusive Malaysian days, not both); `module=<id>`. 400 for a blank or 101+ character query, from after to, unknown term, bad tab, filter or cursor |
