# Handover — 15 Oct 2026, after the overnight run and the user's morning decisions

Read with `../PLAN.md` (backlog R0-R33), `docs/DECISIONS.md` (D1-D43; D43 = this morning's decisions),
`../MORNING_REVIEW_2026-10-15.md` and `../OVERNIGHT_2026-10-15.md`.

## State
- **All overnight work is on branch `integration/final`** (pushed; 85 commits ahead of `main`): R0, R1, R2 (backend),
  R4/R5 (backend), R12, R17, R18, R23, R24, R25, R26 part 1, CI, stack follow-ups. 172 server + 16 client tests pass;
  typecheck and build clean; every item reviewed; 19-step browser regression passed.
- **Not merged:** waiting for the user to run `gh auth login`; then open ONE PR `integration/final` → `main`.
  After merge the user runs `npm run db:migrate -w server` on the dev DB (the command guard blocks the agent).
- **Wireframes v2** are on `docs/wireframes-v2` (not in integration/final); accepted in direction, to be redone as v3 (R32).
- Worktrees live in `FYP/worktrees/` (one per branch) with private test DBs `parp_test_<name>`; remove after merge.
- Report .docx: only the four references changed (FYP_Submissions commit `5ba41ef`). Length question waits for meeting #2.
- `.claude/skills/{typescript-best-practices,unslop,thermo-nuclear-code-quality-review,no-comments}` now allow model
  invocation (flag flipped 15 Oct at the user's request; `npx skills update` would reset it).

## Next work, in order
1. **R33 (XS, default yes):** functional programme dropdown on Register and Edit Profile (unstyled). Why: since R4 the
   server only accepts a programme from the module catalogue (3 values), but the current form is a free-text box, so a
   student typing "Software Engineering" instead of "BSc (Hons) Software Engineering" gets an error and cannot register.
2. **Spec interviews (plan mode, ask the user)** for R30 collaboration and R31 guest browsing — proposals below.
3. **R32 wireframes v3:** start from `docs/wireframes-v2` `docs/chapter4/wireframes/build.mjs`; lower fidelity (main
   labels only, descriptions as lorem ipsum), "Feed" instead of "For You", "Friends only", add R30/R31 screens,
   export every screen as SVG (Playwright can save the page as SVG via an SVG-native template, or render HTML→SVG) so the
   user can drag them into a Figma project (Figma imports SVG as editable layers; a Figma MCP is optional — its official
   server reads designs rather than drawing them). Then user sign-off, then Chapter 4.4 text and .docx.
4. After sign-off: Sprint D (R19 design system/redesign, R21 editor, R22 images, R29 video) in parallel with Sprint 4
   (search incl. R7, messaging, R8 notifications) — Sprint 4 needs its own spec interview.
5. Before the first deploy (R11): `trust proxy` → `1`, `COOKIE_SECURE=true`, `kill_timeout = 15` (D35, D41).

## Proposals to put to the user

**R30 collaboration — drafts only vs any note**
| | Drafts only | Any note (recommended) |
|---|---|---|
| Ranking impact | none (drafts are not ranked) | needs rules below |
| Matches "edit any time" (D43) | partly | yes |
| Complexity | lower | moderate |
Ranking rules if any note: an edit never resets `pst_published_at` (no recency gaming); engagement stays with the note;
a substantive content edit after a Super Like marks it "edited since verification" and removes V until the lecturer
re-confirms (keeps FR1's trust signal honest; notify the lecturer); co-authors are credited on the card and the note
appears in the Following feed of each co-author's followers; hashtag edits change M immediately (hashtags are read live).
Access: share links carry a random token with role view or edit; owner chooses "anyone with the link" or "invited users";
a view link to a draft bypasses visibility only for that token; requests to collaborate go to the owner's notifications
(R8). Editing: one editor at a time with a soft lock plus the `baseUpdatedAt` 409 check (R21 spec); real-time co-editing
(Yjs/CRDT) is a later option, L-XL.

**R31 guest browsing:** the For You feed becomes public read-only; guests get M = 0 (no interest history) and a snapshot
keyed by IP+asOf (or no snapshot, recompute); contacts-only/friends-only notes never shown; every action (like, save,
comment, report, follow, search, message, create) opens a "Log in or register" sheet; rate limits by IP.

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
