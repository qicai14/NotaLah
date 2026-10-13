# server feature: feed

Vertical feed and post engagement: likes, comments and replies, reports, bookmarks.

Serves: FR11, FR14, FR16 (and FR2 indicator display). Test table: `ENG-TC*` and `RANK-TC9/10` in
`docs/chapter4/4.5_test_cases.md`; tests in `server/tests/feed/`. Decisions: D20, D22.

- `repository.ts`: all SQL. Reuses `VISIBLE`, `NOTE_COLS`/`NOTE_FROM`, `SUMMARY_COLS` from `notes/repository.ts`.
  Feed ordering is the single `FEED_ORDER` constant (newest first until Sprint 3 swaps in the score).
- `routes.ts`: `feedRouter` at `/api/feed`; `engagementRouter` mounted at `/api` (auth applied per route).

Endpoints (all need a bearer token; writes also need an active account):

| Method and path | Result |
| --- | --- |
| `GET /api/feed?page=N` | `{items, nextPage, asOf}`; 10 per page, later pages send `?asOf=` from page 1; item = note + `counts`, `liked`, `bookmarked`, `verified`; bad page 400 |
| `POST /api/notes/:id/view` | 204; logged once per user/note per 30 min |
| `POST` / `DELETE /api/notes/:id/like` | `{liked, likes}`; POST 201 when new, else 200 |
| `GET /api/notes/:id/comments` | pinned lecturer comments, then likes desc, then oldest; `replies[]` oldest first |
| `POST /api/notes/:id/comments` | `{body, slideNo?, parentId?}`; 201; reply to a reply 400 |
| `DELETE /api/comments/:id` | author only, soft delete (204) |
| `POST` / `DELETE /api/comments/:id/like` | `{liked, likes}` |
| `POST /api/notes/:id/report` | `{reason, details?}`; 201; 403 lecturer-only reason, 400 own note, 409 duplicate open report |
| `POST` / `DELETE /api/notes/:id/bookmark` | `{bookmarked}` |
| `GET /api/bookmarks` | visible saved notes, newest saved first, with `savedAt` |
