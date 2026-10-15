# R30 collaboration — backend spec (D44)

Scope now: data model, access control and API. UI waits for wireframe sign-off (screens 16-18, 27-29, 41-42 in v3).
Real-time co-editing (Yjs) is out of scope (December stretch). R8 notifications do not exist yet, so requests and
"edited since verification" are exposed through list endpoints; R8 will hook into them later.

## Data model (one migration, `"..._T"` names quoted, columns prefixed)
- `"COLLABORATOR_T"` (`clb_pst_id`, `clb_usr_id`, `clb_role` `'view'|'edit'`, `clb_added_by`, `clb_created_at`;
  PK (`clb_pst_id`, `clb_usr_id`); index on `clb_usr_id`). The owner is never a row here.
- `"SHARE_LINK_T"` (`shl_id`, `shl_pst_id`, `shl_role` `'view'|'edit'`, `shl_token_hash` CHAR(64) UNIQUE,
  `shl_created_at`, `shl_revoked_at`). Store only the SHA-256 of a 32-byte random token; the raw token is returned once.
  At most one active link per (note, role): regenerating revokes the old one.
- `"COLLAB_REQUEST_T"` (`crq_id`, `crq_pst_id`, `crq_usr_id`, `crq_message` VARCHAR(300), `crq_status`
  `'pending'|'approved'|'declined'`, `crq_created_at`, `crq_decided_at`); one pending request per (note, user).
- `"POST_T"` gains `pst_content_edited_at` (content edit after publish) and the soft lock `pst_lock_usr_id`,
  `pst_lock_expires_at`.

## Rules
- **Owner only:** publish, delete, visibility, module, manage collaborators, links and requests.
- **Editors** (`edit` collaborators): update title, slides, hashtags and music through the existing `PUT /api/notes/:id`
  path, but cannot change status, visibility or module (403 on those fields if they differ). Optimistic check:
  `baseUpdatedAt` must equal `pst_updated_at`, else 409.
- **Viewers** (`view` collaborators or a valid view token): can read the note even if draft or friends-only; nothing else
  is unlocked (likes/comments still follow normal visibility; a draft cannot be liked or commented).
- Edit link: only a logged-in, active user can redeem it; redeeming adds them as an `edit` collaborator.
  View link: works for guests too (R31), read-only, does not create a row.
- Suspended, hidden or deleted notes: no access via links or collaboration.
- **Soft lock:** `POST /api/notes/:id/lock` takes or renews the lock for 2 minutes (owner or editor) if free or already
  theirs; `DELETE` releases it. PUT by an editor/owner while another user holds a live lock → 423. Lock TTL in config.
- **Ranking/verification:** an edit never changes `pst_published_at`. A change to title or slides of a published note
  sets `pst_content_edited_at = NOW()`; hashtag/music-only edits do not. A verification only counts (V, badge,
  "Verified by") if `ver_created_at >= pst_content_edited_at` (or the column is NULL). Notes with older verifications
  report `editedSinceVerification: true`. A lecturer re-confirms with the existing `POST /notes/:id/verify`, which
  refreshes `ver_created_at` when a row exists.
- **Credit and feed:** note payloads include `coauthors` (edit collaborators: id, username, display name). The Following
  feed also includes notes where a followed user is an edit collaborator.

## Endpoints
| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/api/notes/:id/access` | owner | collaborators, active links (role, created; never the token), pending requests |
| PUT | `/api/notes/:id/collaborators/:userId` | owner | add or change role `{ role }` |
| DELETE | `/api/notes/:id/collaborators/:userId` | owner, or the collaborator themself | remove / leave |
| POST | `/api/notes/:id/links` | owner | create or regenerate `{ role }` → `{ token, url }` |
| DELETE | `/api/notes/:id/links/:role` | owner | revoke |
| GET | `/api/share/:token` | anyone (optional auth) | resolve token → note (view) or join as editor (edit, login required) |
| POST | `/api/notes/:id/requests` | logged-in non-collaborator who can see the note | request to collaborate `{ message? }` |
| POST | `/api/notes/:id/requests/:requestId` | owner | `{ decision: 'approve'|'decline', role? }` (role default `edit`) |
| GET | `/api/notes/shared` | logged-in | notes the user collaborates on (for Drafts "Shared with me") |
| POST/DELETE | `/api/notes/:id/lock` | owner, editor | soft lock |

All writes keep CSRF and the shared write rate limit; token resolution is rate-limited by IP (reuse the R31 limiter).

## Tests
Access matrix (owner / editor / viewer / stranger / guest) for each endpoint; editor cannot change status/visibility/
module; token hash stored not raw; revoked and regenerated links stop working; lock conflict 423 and expiry; V drops
after a slide edit and returns after re-confirm; hashtag-only edit keeps V; `pst_published_at` unchanged by edits;
Following feed includes co-authored notes; co-authors in payload. Add rows to `docs/chapter4/4.5_test_cases.md`.
