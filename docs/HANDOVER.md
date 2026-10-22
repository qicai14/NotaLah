# Handover — 22 Oct 2026, evening (session FYP-8 autopilot ends; Sprint 5 code done, report and AI next)

NotaLah. Read with `../PLAN.md`, `docs/DECISIONS.md` (D76-D82 are new), `docs/README.md` and
`../run-logs/AUTOPILOT_2026-10-22.md` (decisions taken while the user was away, with alternatives).

## State of `main`
- Merged this session: #54 Chapter 4 diagrams in Mermaid (D76) · #55 admin pages restyled (D78) · #56 R11 deploy code:
  Pages Function proxy with `PROXY_SECRET`, Docker image with ffmpeg, `render.yaml`, deploy workflow that skips each
  step without its secret, plus R18 client Sentry (D77) · #57 R10 gaps (share-link annotations, feed count, keyboard
  picker) and the NOTE-TC39 flake (D79) · #58 R20 local audit fixes: bcrypt/auth burst env, liveness without DB, read
  limiter, Pages `_headers` CSP, sharp memory caps, lazy socket client (D81) · #59 R27 local load evidence (D80).
- Tests: server 437 + 2 skipped, client 168; check, build and CI green. Audit report: `docs/testing/R20_audit_2026-10-22.md`.
- NFR1 evidence: `docs/testing/load/2026-10-22_local.md` (10k notes: pass up to 25 VUs, every search < 3 s; fails at 50).
- Live deploy is optional (D82): nothing is live; the local stack is what the demo and submission use.

## User steps (exact)
1. Migrate the dev DB (R9, R10 migrations): in `FYP_Project/`, `vp run server#db:migrate`.
2. Answer the 22 Oct block in `docs/OPEN_QUESTIONS.md` (R28 spec, S5, share-link privacy, R14 plan, auth burst).
3. Commit the report drafts left uncommitted in `FYP_Submissions/` after checking them: `drafts/1.5_scope.md`,
   `drafts/2.3.9_web_server_and_hosting.md`, `drafts/6_limitations_notes.md`.
4. Re-render the Chapter 4 PNGs from the Mermaid sources (D76) on mermaid.live.
5. Optional go-live: README "Deploy notes" (Neon, Render Blueprint with `PROXY_SECRET`, Pages project + `API_ORIGIN` +
   `PROXY_SECRET` + fail closed, Workers Free, billing notification, GitHub secrets), then the `DEBUG_PROXY` check,
   UptimeRobot, `winget install k6.k6` and `docs/testing/load/README.md` live run, Neon restore drill.
6. Workers AI token for R36 (`CF_AI_TOKEN`, `CF_ACCOUNT_ID`) when R36 starts.
7. Leftover empty folders under `../worktrees/` can be deleted; test DB `notalah_test_r27_load` holds the 10k load seed
   (drop it with `docker exec fyp_project-db-1 dropdb -U notalah notalah_test_r27_load` when no longer needed).

## Next work, in order
1. R28 AI writing assistant once its spec (`docs/specs/R28_ai_assistant.md`) is approved; then R35, R36 (spec interviews).
2. Report for meeting #2 (28 Oct): R14 cut plan `../FYP_Submissions/drafts/R14_cut_plan.md`, supervisor questions.
3. Chapter 5/6 drafting (Markdown): architecture (Mermaid `00_architecture.md`), load evidence, limitations.
4. Live-only checks after any go-live: Lighthouse, CSP console, k6 run, WebSocket through the proxy, `TRUST_PROXY=2`.

## Known limits
- Render free (if deployed): ~1 min cold start, 0.1 CPU; logins at bcrypt 10 ≈ 0.8 s; 20 auth attempts/min per IP (D81).
- Local throughput flattens at ~17 req/s on 10k notes (Postgres on the same CPU; not profiled) (D80).
- R10: the 500-annotation cap is still count-then-insert (D75). Reports queue shows only the first 20 groups (D78).
