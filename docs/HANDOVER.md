# Handover — 25 Oct 2026 (workflow restructure done; next: mattpocock setup, then R28)

Read with `PLAN.md` (milestones), `adr/` (0084 on) and `DECISIONS.md` (D76-D83 since the 22 Oct handover).

## State of `main`
- Merged since 22 Oct: #61 restricted accounts cannot edit their profile, 25 Oct decisions (D83) · #62 lean root
  `AGENTS.md` with `docs/conventions/` (reference pattern), every `CLAUDE.md` exactly `@AGENTS.md`, sync check in
  `vp run check` · #63 agent config versioned in `.claude/`, new roster (ADR 0084) · #64 Playwright, Vercel React and
  Postgres skills · #65 `docs/adr/`, `docs/PLAN.md`, archived R0-R41 backlog · #66 multer and body-parser advisories,
  CI ffmpeg retry.
- `main` is protected by the `protect-main` ruleset: PR and the `verify` check required, no force-push or deletion
  (repo admins can bypass).
- Tests: server 438 + 2 skipped, client 168; check, build and CI green.

## User steps (exact)
1. Open new sessions in `C:\Users\reymy\Code Projects\FYP\FYP_Project` (not `FYP/`). Memory was copied there.
2. Run, in order: `/setup-matt-pocock-skills` (GitHub Issues, default triage labels, single-context glossary),
   `/grill-with-docs` (builds `GLOSSARY.md`), `/to-spec` then `/to-tickets` on `docs/specs/R28_ai_assistant.md`,
   `/improve-codebase-architecture`. These are user-invoked only.
3. After 25 Oct 11:40 UTC: remove `multer` and `body-parser` from `minimumReleaseAgeExclude` in `pnpm-workspace.yaml`
   (a one-line chore PR; Claude can do it when asked).
4. Migrate the dev DB if not done: `vp run server#db:migrate`. Re-render Chapter 4 PNGs from the Mermaid sources.
5. Optional: prune unused global plugins (every installed skill's name and description is sent with each request).

## Next work, in order (become GitHub issues at step 2)
1. R28 AI writing assistant (spec approved, D83), then R35, R36, R41 (spec interviews first).
2. R5 admin Modules page (API exists, no UI); R26 Playwright E2E smoke suite in CI.
3. Flaky client test CLI-TC40 (profile unblock focus) failed once in CI on 25 Oct and passed on rerun.
4. Meeting #2 (28 Oct): R14 Plan A with B as fallback, supervisor questions in `OPEN_QUESTIONS.md`; Ch 5-6 drafts.

## Known limits
- The 500-annotation cap is count-then-insert (D75); the reports queue shows the first 20 groups (D78).
- Live deploy is optional and off (D82); Render free limits apply only if it goes live (D81).
