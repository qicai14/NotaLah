# server feature: engagement

Post engagement: views, likes, comments and replies, reports, bookmarks.

Serves: FR14, FR16. Test table: `ENG-TC*` in `docs/chapter4/4.5_test_cases.md`; tests in `server/tests/engagement/`.
Decisions: D20, D22.

- `repository.ts`: all SQL. Reuses `VISIBLE` and `SUMMARY_COLS` from `notes/repository.ts`.
- `routes.ts`: `engagementRouter` mounted at `/api` (auth applied per route).

Endpoints (all need a bearer token; writes also need an active account):

| Method and path | Result |
| --- | --- |
| `POST /api/notes/:id/view` | 204; logged once per user/note per 30 min |
| `POST` / `DELETE /api/notes/:id/like` | `{liked, likes}`; POST 201 when new, else 200 |
| `GET /api/notes/:id/comments` | pinned lecturer comments, then likes desc, then oldest; `replies[]` oldest first |
| `POST /api/notes/:id/comments` | `{body, slideNo?, parentId?}`; 201; reply to a reply 400 |
| `DELETE /api/comments/:id` | author only, soft delete (204) |
| `POST` / `DELETE /api/comments/:id/like` | `{liked, likes}` |
| `POST /api/notes/:id/report` | `{reason, details?}`; 201; 403 lecturer-only reason, 400 own note, 409 duplicate open report |
| `POST` / `DELETE /api/notes/:id/bookmark` | `{bookmarked}` |
| `GET /api/bookmarks` | visible saved notes, newest saved first, with `savedAt` |
