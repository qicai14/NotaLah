# E2E notes (specs run green against the real UI, #81)

## Product bugs found by axe
None open. #144 (`label-content-name-mismatch` on the avatar link, Notifications link and Super Like toggle) is fixed and the allowlist in `helpers/axe.ts` is empty.

## Running
- See `docs/conventions/testing.md` (E2E): `vp run test:e2e` migrates and reseeds `notalah_test_81` and starts its own
  dev server and AI stub (`e2e/stub-ai`, port 4010, outline replies only).
- The seed has three reports on two notes (queue rows are per note); A2 runs last because it suspends student1.
- The `Text` editor panel is the default, so its rail button toggles it closed: do not click it first.
