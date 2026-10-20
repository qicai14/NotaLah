# Handover — 20 Oct 2026, 10:30 (session FYP-6 ends; Sprint D UI and Sprint 5 next)

NotaLah. Read with `../PLAN.md` (backlog R0-R40), `docs/DECISIONS.md` (D61-D68 are new), `docs/README.md` (doc index)
and `../run-logs/AUTOPILOT_2026-10-20.md` (overnight log, choices made without the user).

## State of `main`
- Merged this session: #37 Vite+-native toolchain + pnpm (D61), #38 rename to NotaLah (D62), #39 TypeScript 7 (D63),
  #40 Sentry 11 (D64), #41 docs index + nested CLAUDE.md + wireframes moved to `FYP_Submissions/wireframes/` (D66),
  #42 R37 deploy readiness (D65), #43 R40 async video pipeline (D67), R38 clean-up (D68, see below).
- Tests: server ~395 + 2 skipped, client ~117; `vp run check`, build and CI green.
- Commands are `vp` only (see `CLAUDE.md`); version policy: newest releases, exact pins, pnpm 3-day release-age guard,
  Node 24 LTS (D61).

## User steps (exact)
1. Keep your dev data after the rename: follow `docker/rename-from-parp.md` (copies the volume first; rollback is
   `git checkout` of an older main). Then `vp install`. Until then agents create test DBs with role `parp`.
2. Claim the GitHub Student Pack `.me` domain (needed for the login cookie, D65/D66) before R11.
3. `.env`: fix `R2_BUCKET` (73 chars; bucket names max 63), add `GEMINI_API_KEY`, `CF_ACCOUNT_ID`, `CF_AI_TOKEN`.
   Consider rotating keys: a `.env` was printed into an agent transcript on 20 Oct (not committed or sent anywhere).
4. Re-render `docs/chapter4/diagrams/src/10_erd.puml` with PlantUML (needs Java) after R38's schema notes.
5. When R11 deploys: GitHub secrets `PROD_DATABASE_URL` + `R2_*` for `purge.yml`; Render build/start commands and env
   in README "Deploy notes"; `api.<domain>` DNS-only on Cloudflare (or `TRUST_PROXY=2`); check hops once with `DEBUG_PROXY=1`.
6. Review the R13 report drafts in `FYP_Submissions/drafts/` before the writer applies them to the .docx.

## Not verified overnight
- R40: a real upload through the built server and a browser pass of the video picker after the review fixes.
- R38: browser behaviour of the year-long media cache with `Vary: Cookie` on a shared PC.

## Next work, in order
1. Sprint D UI: R21d templates, themes, fonts; R29 feed player (muted autoplay, tap for sound); R8 notifications
   inbox UI; admin and Drafts restyle; R39 feed payload (first slides only).
2. IR features still undelivered (marks): R9 FR17 Jamendo background audio; R10 FR18 text-anchored annotations.
3. Sprint 5: R11 deploy (domain first), R27 k6 load test + keep-awake + Neon restore drill, R28/R35/R36 AI aids,
   R20 pre-UAT audit.
4. Report: apply approved R13 drafts (writer), R14 length cut plan for meeting #2, diagrams from the review page
   into §2.3.9 and Chapter 5.

## Known limits
- Render free: ~1 min cold start, one instance, 512 MB; video re-encodes capped at 720p, one job (D67).
- `/security-review` runs only from a git checkout (use a worktree).
- Finished `"VIDEO_JOB_T"` rows are not purged yet (D67).
