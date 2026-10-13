# server feature: verification

Will hold: lecturer Super Like (verify) of a note and its withdrawal (UC19).

Contents: `POST /api/posts/:id/verify` and its removal, `"VERIFICATION_T"` repository, mounted under
`requireAuth, requireRole('lecturer')` (approved lecturers only; not the admin-only moderation router).

Serves: FR1, FR2 (and FR3 through the V component of ranking). Test table: `VER-TC*` in
`docs/chapter4/4.5_test_cases.md`.

Filled in: Sprint 3. See `docs/ARCHITECTURE.md` for the layering rules.
