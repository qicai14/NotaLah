# server feature: engagement

Post engagement: views, likes, comments and replies, reports, bookmarks.

Serves: FR14, FR16 (UC10 like, UC11 comment, UC12 report, UC13 bookmark). Test table: `ENG-TC*` except ENG-TC11, which is in `tests/feed/`, in `docs/chapter4/4.5_test_cases.md`; tests in `server/tests/engagement/`.
Decisions: D20, D22.

- `repository.ts`: all SQL. Reuses `VISIBLE` and `SUMMARY_COLS` from `notes/repository.ts`.
- `routes.ts`: `engagementRouter` mounted at `/api` (auth applied per route).

Endpoints (all need a bearer token; writes also need an active account):

| Method and path | Result |
| --- | --- |
| `POST /api/notes/:id/view` | 204; logged once per user/note per 30 min |
| `POST` / `DELETE /api/notes/:id/like` | `{liked, likes}`; POST 201 when new, else 200 |
| `GET /api/notes/:id/comments` | readable by guests (D45); pinned lecturer comments, then likes desc, then oldest; `replies[]` oldest first |
| `POST /api/notes/:id/comments` | `{body, slideNo?, parentId?, mentions?}`; 201; reply to a reply 400; `mentions` (user ids, at most 10) notify the allowed users the text names (D51) |
| `DELETE /api/comments/:id` | author only, soft delete (204) |
| `POST` / `DELETE /api/comments/:id/like` | `{liked, likes}` |
| `POST /api/notes/:id/report` | `{reason, details?}`; 201; 403 lecturer-only reason, 400 own note, 409 duplicate open report |
| `POST` / `DELETE /api/notes/:id/bookmark` | `{bookmarked}` |
| `GET /api/bookmarks` | visible saved notes, newest saved first, with `savedAt` |
