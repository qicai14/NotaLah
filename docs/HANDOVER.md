# Handover — 16 Oct 2026, evening (Sprint 4 backend done)

Read with `../PLAN.md` (backlog R0-R33), `docs/DECISIONS.md` (D1-D51), `../AUTOPILOT_2026-10-16.md` (today's run log
and the decisions to confirm) and `docs/specs/Sprint4_spec.md`. Older run logs are in `../run-logs/`.

## State
- `main` holds everything merged so far (PRs #1-#11): Sprint R hardening, R30 collaboration, R31 guests, R33 dropdown,
  D47 (self-likes not ranked, suspended users hidden from all but admins), Vite+ 1.3.0 (D47), and the Sprint 4 backend:
  search + academic terms (D48), blocking (D49), messaging over Socket.io (D50), notifications R8 (D51).
  Server 288 tests (+1 perf test run on demand), client 21; typecheck, lint (0 errors) and build clean; CI green.
- **Dev DB is 10 migrations behind.** The user runs, in `FYP_Project`: `npm run db:migrate -w server` (the guard blocks
  the agent).
- **Wireframes v3** (R32) on `docs/wireframes-v3` (not merged): 57 screens, SVG per screen + `ALL_SCREENS.svg`, index in
  `docs/chapter4/wireframes/INDEX.md`. **Waiting for the user's review.** Gate: no frontend work (Sprint D, and the
  UI halves of R30/R31/Sprint 4), no .docx, no deployment until approved.
- Worktrees in `FYP/worktrees/`: only `wf3` (wireframes) and this handover's are live; old folders hold leftover
  `node_modules` the guard would not let the agent delete. Private test DBs `parp_test_<name>` can be dropped.

## Next work, in order
1. User: run the migrations; review wireframes v3; confirm the decisions in `../AUTOPILOT_2026-10-16.md`.
2. After wireframe sign-off: Chapter 4.4 text for v3, then Sprint D (R19 design system, R21 editor, R22 images, R29
   video) and the UI for R30, R31, search, blocking, messaging (Vite proxy needs `/socket.io` with `ws: true`) and R8.
3. Docs debt: `"TERM_T"`, `"BLOCK_T"`, `"NOTIFICATION_T"` and the messaging columns are not yet in Chapter 4.3's data
   dictionary/ERD; `erd.png` needs PlantUML. A one-off formatting PR (`vp fmt`, 107 files) before frontend work starts.
4. Sprint 5: R9 Jamendo (needs `JAMENDO_CLIENT_ID`), R10 annotations (after R21), R11 deploy, R20 audit, R27 scale-out.
5. Before the first deploy (R11): `trust proxy` = hop count `1` (never `true`, D45), `COOKIE_SECURE=true`,
   `kill_timeout = 15` (D35, D41), **one Fly machine** until the Socket.io Postgres adapter lands (D50, R27).

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
hand, or the user runs it from a session opened in `FYP_Project/`. Run logs:
see `../run-logs/`.
