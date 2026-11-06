# E2E notes (specs run green against the real UI, #81)

## Product bugs found by axe (allowlisted with a reason in `helpers/axe.ts`; fix, then delete the entries)
- `label-content-name-mismatch` (serious): the author avatar link has `aria-label="<Name>'s profile"` but its visible
  text is the initials (feed 10 nodes, note page 1). WCAG 2.5.3 Label in Name.
- Same rule on the sidebar Notifications link when unread: `aria-label="Notifications, 1 unread"` differs from its visible text.

## Running
- See `docs/conventions/testing.md` (E2E): `vp run test:e2e` migrates and reseeds `notalah_test_81` and starts its own
  dev server and AI stub (`e2e/stub-ai`, port 4010, outline replies only).
- The seed has three reports on two notes (queue rows are per note); A2 runs last because it suspends student1.
- The `Text` editor panel is the default, so its rail button toggles it closed: do not click it first.
