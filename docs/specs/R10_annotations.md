# R10 annotations (FR18): server and API spec

*Agreed with the user 20 Oct 2026; the report decisions were added the same day. Logged as D75. The server half is built first, the client later in the same worktree.*

## Scope
- Annotations are anchored to selected text only, are public to everyone who can view the note, and the note's author can turn them off for the note.
- Not doing: replies, editing after posting, pins on non-text elements.
- An annotation is never deleted when the author edits the note. The client marks an annotation whose quote no longer matches as "Text changed".

## Schema (migration `20261020000010_annotations.sql`)
- `"ANNOTATION_T"`: `ant_id`, `ant_pst_id` (FK, cascade), `ant_usr_id` (FK), `ant_slide_id`, `ant_element_id`, `ant_quote` (1 to 300), `ant_offset` (int >= 0), `ant_body` (1 to 500), `ant_created_at`, `ant_deleted_at`, `ant_hidden_at`.
  - `ant_slide_id` is the 1-based position of the slide (slides carry no id of their own); `ant_element_id` is the deck's text element id.
  - `ant_deleted_at` is a user delete; `ant_hidden_at` is a moderator removal. Both exclude the row from every list.
  - Partial index `(ant_pst_id, ant_created_at, ant_id) WHERE ant_deleted_at IS NULL AND ant_hidden_at IS NULL`.
- `"POST_T".pst_annotations_on BOOLEAN NOT NULL DEFAULT TRUE`.
- `"REPORT_T".rpt_ant_id` (nullable FK, cascade); `rpt_pst_id` stays set to the note. `report_one_open_idx` now covers note reports only (`rpt_ant_id IS NULL`); the new `report_one_open_annotation_idx` on `(rpt_ant_id, rpt_reporter_id)` covers open annotation reports.
- `"NOTIFICATION_T"` types `annotation` and `annotation_hidden` added to the check.

## API
All under `/api`. Errors are `{ error }`; validation errors are `{ error: 'Validation failed', errors: { field: message } }`.

| Endpoint | Behaviour |
|---|---|
| `GET /notes/:id/annotations` | Optional login (guests read public notes). 404 when the viewer cannot see the published note (friends-only, hidden, blocks; an admin also reads a suspended author's note). `200 { annotationsOn, annotations }`; when off, `{ annotationsOn: false, annotations: [] }`. Oldest first, capped at 500. Annotations by a deleted author, a suspended author (admins still see them) or a user in a block with the viewer are left out. |
| `POST /notes/:id/annotations` | Login, active account, write limiter. Body `{ slideId, elementId, quote, offset, body }`. 404 note not visible; 403 when off; 409 when the note already has 500 live annotations; 400 on validation. `201 { annotation }`. Notifies the note author (`annotation`, one per annotator per hour), never yourself. |
| `DELETE /notes/:id/annotations/:annId` | Login. The annotator or the note author; soft delete. 204; 404 unknown, already deleted or hidden, or the caller cannot see the note; 403 anyone else. |
| `PATCH /notes/:id/annotations` | Owner only. Body `{ enabled: boolean }`. `200 { annotationsOn }`; 403 for anyone else. Chosen over the note PUT, which replaces the whole deck and takes the edit lock. |
| `POST /notes/:id/annotations/:annId/report` | Login, active. Body as the note report (`reason`, `details`). 201 `{ reported: true }`; 400 own annotation; 403 lecturer-only reason; 409 duplicate open report; a block does not stop it (D49). |
| `POST /admin/reports/annotations/:annId/resolve` | Admin. Body `{ outcome: 'dismiss' or 'hide', remark }`. `hide` sets `ant_hidden_at` and sends `annotation_hidden` to the annotator. 404 when no open report. |

### Annotation shape
`{ id, slideId, elementId, quote, offset, body, createdAt, author: { id, displayName, avatarUrl, isVerifiedLecturer }, canDelete }`; `canDelete` is true for the annotator and the note author.

### Validation
- `slideId` int 1 to 32767; `elementId` matches the deck id pattern; `quote` 1 to 300 characters; `offset` int 0 to 1,000,000; `body` plain text, trimmed, 1 to 500.
- The element must exist on that slide of the note's current deck and be a `text` element.
- shortcut: the server does not re-check that `quote` appears at `offset`; the client resolves anchors and marks mismatches.

### Moderation
- `GET /admin/reports` groups by note as before; each report carries `annotation: { id, quote, body, author, gone } | null`.
- The note-level resolve (`/admin/reports/:noteId/resolve`) resolves note reports only and leaves annotation reports open; a note with only annotation reports answers 404 there. Annotation reports are resolved one annotation at a time.
- Annotation reports do not count towards the note author's upheld-report total.

## Tests
`server/tests/annotations/annotations.test.ts`, rows in `docs/chapter4/4.5_test_cases.md`: ANN-TC1 to ANN-TC11 cover create and read, access rules, blocks and account status, the off switch, delete permissions, validation, notification, report, admin hide, and edits keeping annotations, and the 500 limit.
