# server feature: feed

Vertical feed ranked by the heuristic score from `features/ranking` (D24).

Serves: FR11, FR14 (and FR2 indicator display). Test table: `ENG-TC11` and `RANK-TC9/10` in
`docs/chapter4/4.5_test_cases.md`; tests in `server/tests/feed/`. Decisions: D20, D22, D24.

- `service.ts`: `getFeedPage` scores candidates, sorts, slices one page.
- `repository.ts`: all SQL (cutoff from the database clock, notes by id). Reuses `VISIBLE`, `NOTE_COLS`/`NOTE_FROM`
  from `notes/repository.ts`.
- `routes.ts`: `feedRouter` at `/api/feed`.

| Method and path | Result |
| --- | --- |
| `GET /api/feed?page=N` | `{items, nextPage, asOf}`; 10 per page, later pages send `?asOf=` from page 1; item = note + `counts`, `liked`, `bookmarked`, `verified`, `verifiedBy`, `verifiedByMe`, `score`, `components {E,R,V,M}`; ordered by score; bad page 400 |
