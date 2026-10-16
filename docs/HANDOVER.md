# Handover — 17 Oct 2026, early morning (Sprint 4 backend done, wireframes v3 approved)

NotaLah (formerly PARP). Read with `../PLAN.md` (backlog R0-R33), `docs/DECISIONS.md` (D1-D51),
`../AUTOPILOT_2026-10-16.md` (16-17 Oct run log) and `docs/specs/Sprint4_spec.md`. Older run logs: `../run-logs/`.

## State
- `main` holds PRs #1-#17, all CI green: Sprint R hardening, R30 collaboration, R31 guests, R33 dropdown, D47
  (self-likes not ranked; suspended users hidden from all but admins, who can also read their comments), Vite+ 1.3.0,
  Sprint 4 backend (search + terms D48, blocking D49, messaging over Socket.io D50, notifications R8 D51),
  Chapter 4.3 for the new tables, **wireframes v3 approved and merged** (57 screens, SVG + PNG, Chapter 4.4 with 3-5
  lines per screen), the NotaLah name in visible strings, and a one-off Oxfmt format pass (CI now checks format).
- Tests: server 288 (+1 perf test on demand), client 21; `vp check`, typecheck, lint (0 errors), build clean.
- Dev DB is fully migrated (12 migrations; every down step verified on a throwaway DB, 16 Oct).
- Global `vp` lives in `%LOCALAPPDATA%ite-plusin` (add it to PATH in agent shells); the repo itself uses the
  pinned npm package, so `npm run ...` scripts work without it.
- No live worktrees. `FYP/worktrees/` holds only leftover `node_modules` folders the guard won't let agents delete.
- `erd.png` still shows 24 entities: rendering needs Java + PlantUML (not installed). The `.puml` source is current.

## Next work, in order
1. **Sprint D (gate lifted 17 Oct):** short spec interview first, then R19 design system and redesign
   (`frontend-designer` sets the system; `frontend` applies it), R21 editor (spec `docs/specs/R21_editor_data_model.md`),
   R22 images, R29 video, and the UI for R30, R31, search, blocking, messaging (Vite proxy needs `/socket.io` with
   `ws: true`) and R8 notifications, following the v3 wireframes.
2. Sprint 5: R9 Jamendo (needs `JAMENDO_CLIENT_ID`), R10 annotations (after R21), R11 deploy, R20 audit
   (incl. a full security pass), R27 scale-out.
3. Report: Chapters 1-3 edits (R13), length plan (R14), Chapter 5/6 from `docs/` once UI exists.
4. Before the first deploy (R11): `trust proxy` = hop count `1` (never `true`, D45), `COOKIE_SECURE=true`,
   `kill_timeout = 15` (D35, D41), **one Fly machine** until the Socket.io Postgres adapter lands (D50, R27).
5. Run `/security-review` on every PR that touches auth, uploads or messaging (it reviews a branch diff).

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
