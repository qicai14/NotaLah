# server feature: verification

Lecturer Super Like (verify) of a note and its withdrawal (UC19).

Serves: FR1, FR2 (and FR3 through the V component of ranking). Test table: `VER-TC*` in
`docs/chapter4/4.5_test_cases.md`; tests in `server/tests/verification/`. Decisions: D6, D24, D26.

- `routes.ts`: `verificationRouter` mounted at `/api` before the notes router. Every route needs a lecturer role
  (`requireRole('lecturer')`) and an approved lecturer status, both read from the database; never the admin router.
- `repository.ts`: `"VERIFICATION_T"` insert/delete. The "counts as verified" rule and the verifier name live in
  `VERIFIED` / `VERIFIED_BY` in `notes/repository.ts`, shared by the feed, note detail, bookmarks and ranking.

| Method and path | Result |
| --- | --- |
| `POST /api/notes/:id/verify` | `{remark?}` (max 300, blank = none); 201 `{verifiedBy, verifiedAt, remark}`, 200 with the existing one on repeat; 403 not an approved lecturer or account not active; 404 unknown, draft or not visible; 409 "Cannot verify own note" |
| `DELETE /api/notes/:id/verify` | removes the caller's own Super Like; 200 `{verified, verifiedBy}` for the note afterwards (another lecturer may still verify it); allowed for a restricted lecturer |

Notes expose `verified`, `verifiedBy` (earliest valid verifier, null if none) and `verifiedByMe`.
