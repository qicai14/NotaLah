# Handover — 15 Oct 2026, afternoon (after R30/R31 backends and wireframes v3)

Read with `../PLAN.md` (backlog R0-R33), `docs/DECISIONS.md` (D1-D46), `../AFTERNOON_2026-10-15.md` (this
afternoon's unattended run and the decisions to confirm) and `../MORNING_REVIEW_2026-10-15.md`.

## State
- **Open PRs, merge in this order** (each branched from the one before, so later PRs show earlier commits until merged):
  1. [#1](https://github.com/qicai14/Peer-to-Peer-Academic-Resource-Platform--PARP-/pull/1) `integration/final` → `main`:
     all overnight work (R0-R2, R4/R5, R12, R17, R18, R23-R26, CI). CI green.
  2. [#2](https://github.com/qicai14/Peer-to-Peer-Academic-Resource-Platform--PARP-/pull/2) R33 programme dropdown.
  3. [#3](https://github.com/qicai14/Peer-to-Peer-Academic-Resource-Platform--PARP-/pull/3) R31 guest browsing (backend).
  4. [#4](https://github.com/qicai14/Peer-to-Peer-Academic-Resource-Platform--PARP-/pull/4) R30 collaboration (backend),
     also carries D44, the R30 spec, the Sprint 4 interview prep and this handover.
  After merging, the user applies the new migrations on the dev DB with the server workspace's `db:migrate` script
  (the command guard blocks the agent). After #2 and #3 merge, move the CLI-TC19 row in `4.5_test_cases.md` after CLI-TC18.
- **Wireframes v3** (R32) are on `docs/wireframes-v3` (not in any PR yet): 51 screens, SVG for Figma + PNG, index in
  `docs/chapter4/wireframes/INDEX.md`. **Waiting for the user's page-by-page review.** Gate: no Sprint D frontend
  (R19, R21, R22, and the UI halves of R30/R31/R33), no .docx, no deployment until approved.
- Tests on #4's branch: server 205, client 17; typecheck and build clean.
- Worktrees in `FYP/worktrees/` (one per branch) with private test DBs `parp_test_<name>`; remove after merge.
- `erd.png` is stale (PlantUML/Java not installed); `10_erd.puml` is current.

## Next work, in order
1. User: merge #1-#4, review wireframes v3, answer the open questions in `../AFTERNOON_2026-10-15.md`.
2. **Sprint 4 spec interview** (plan mode) from `docs/specs/Sprint4_interview_prep.md` (12 questions, recommendations given).
3. After wireframe sign-off: Chapter 4.4 text for v3 (figure numbers changed), then Sprint D (R19 design system,
   R21 editor, R22 images, R29 video, UI halves of R30/R31) in parallel with Sprint 4 (search incl. R7, messaging, R8).
4. Before the first deploy (R11): `trust proxy` → hop count `1` (never `true`, D45), `COOKIE_SECURE=true`,
   `kill_timeout = 15` (D35, D41).

## Still-open proposals
**Local backup for published notes (R21 Q6):** pros — no lost edits when a tab crashes or closes (published notes do
not autosave), cheap (localStorage, a 30-slide deck is about 1.5 MB, under the ~5 MB quota). Cons — content stays in the
browser on shared lab PCs (clear on logout and after a successful Update), a stale backup could overwrite newer server
content (offer "Restore unsaved changes?" only when the backup's base version equals the server's `updatedAt`).
Recommendation: implement with those two guards.

**ffmpeg (R21 Q3):** production route = install `ffmpeg` from the OS package manager in the Fly Docker image and in CI
(`apt-get install ffmpeg`), and locally with `winget install Gyan.FFmpeg`; call `ffprobe`/`ffmpeg` by name. Avoid
`ffmpeg-static` (downloads binaries from GitHub at install time).

**AI model (D33):** `openai/gpt-oss-120b` on Groq is a sound choice for restructuring notes into slides (strong
instruction following; check Groq's console for current free limits, about 30 requests/min). Keep `openai/gpt-oss-20b`
as a faster fallback; validate output with the shared zod deck schema regardless.

**Jamendo (R9):** needs a free client id from devportal.jamendo.com (`JAMENDO_CLIENT_ID` in `.env`); full-length CC
tracks, so no 30 s preview limit; credit artist and licence on the note.

## Known limits
`/security-review` cannot run inside subagents here (session root is not a git repo) — reviewers check security by
hand, or the user runs it from a session opened in `FYP_Project/`. A leftover dev server (PID 12904, port 4100) from
the overnight smoke test may still be running if the user has not stopped it.
