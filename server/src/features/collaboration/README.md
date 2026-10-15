# server feature: collaboration

Shared notes (R30, D44, D46): collaborators, share links, requests to collaborate and the soft edit lock.
`routes.ts` is mounted at `/api` before the engagement and notes routers; `repository.ts` holds the SQL; `config.ts`
holds the lock TTL and token size. The access rules that other features need (`SHAREABLE`, `COLLAB_ROLE`, the
collaborator read rule, `coauthors`, the edited-since-verification rule) live in `notes/repository.ts`.

| Route | Who | Notes |
|---|---|---|
| `GET /api/notes/:id/access` | owner | collaborators, active links (role and date, never the token), pending requests |
| `PUT /api/notes/:id/collaborators/:userId` | owner | `{role: 'view'|'edit'}`; 404 unknown, suspended or deleted user; 400 the owner |
| `DELETE /api/notes/:id/collaborators/:userId` | owner, or the collaborator themself | 204; frees their lock |
| `POST /api/notes/:id/links` | owner | `{role}`; 201 `{role, token, url}`; revokes the previous link of that role; only the SHA-256 is stored |
| `DELETE /api/notes/:id/links/:role` | owner | 204 |
| `GET /api/share/:token` | anyone, IP-limited | view link: `{role: 'view', note}` for guests too; edit link: 401 for guests, else `{role: 'edit', note}`; 404 bad, revoked, hidden or suspended |
| `POST /api/share/:token` | signed-in, active | joins an edit link as an edit collaborator; 400 for a view link; 403 while the author is not active |
| `POST /api/notes/:id/requests` | anyone who can read the note, not owner or editor | `{message?}` (max 300); 201; 409 duplicate pending or already an editor |
| `POST /api/notes/:id/requests/:requestId` | owner | `{decision: 'approve'|'decline', role?}` (role default edit); 409 already decided |
| `GET /api/notes/shared` | signed-in | keyset page of notes the user collaborates on, with role and owner |
| `POST` / `DELETE /api/notes/:id/lock` | owner, editor | take or renew for `lockTtlSeconds` (120 s), 423 with `lockedBy` when someone else holds it; release |

`PUT /api/notes/:id` accepts edit collaborators (content only, `baseUpdatedAt` required, 409 stale, 423 locked, 403 while
the author is not active). An editor's first save sets `clb_edited_at`; only then are they credited in `coauthors` and
reach their followers' Following feed. `GET /api/notes/:id` adds `myRole`. Co-authors count as authors for like and verify.
Test table: `COL-TC*` in `docs/chapter4/4.5_test_cases.md`.
