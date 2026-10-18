# Handover — 18 Oct 2026, early morning (Sprint D under way)

NotaLah (formerly PARP). Read with `../PLAN.md` (backlog R0-R33), `docs/DECISIONS.md` (D1-D56),
`docs/specs/SprintD_spec.md` (agreed 17 Oct, D52), `docs/specs/R21_editor_data_model.md` and
`../AUTOPILOT_2026-10-18.md` (current run log; 17 Oct log alongside). Older run logs: `../run-logs/`.

## State
- `main` holds PRs #1-#25 (plus #26 R21c slice 1 if merged), all CI green. Sprint D so far:
  - #19 Sprint D spec (D52). #20 R21a slides as element documents, `@parp/shared` (D53).
  - #21 R19 design system: light/dark tokens in `client/src/index.css` (swappable palette), shadcn/ui, `client/DESIGN.md`,
    shell, feed, note detail, welcome/auth, guest sheet; `X-Viewer: user` fix (AUTH-TC22); feed returns `weights`.
  - #22 R22 server: uploads (sharp → WebP, EXIF stripped, 5 MB, 500 MB quota), local-disk storage, asset access by note
    visibility, share-link asset route, Unsplash proxy (503 until key), purge (D54). `/security-review`: no findings.
  - #23 R21b `SlideBoard`/`SlideCarousel` replace SlideViewer. #24 Search UI (D55). #25 Profiles + blocking UI.
  - #26 R21c slice 1: new editor (store/undo, geometry, canvas, strip, text/shapes, autosave, backup) (D56).
- Tests: server 329, client 68; typecheck, lint (0 errors), format, build clean.
- Dev DB `parp` needs the two new migrations: run `npm run db:migrate -w server` in `FYP_Project`.
- Blast Radius plugin is off (it held every `db:migrate*` command and failed in the desktop app).
- Private test DBs `parp_test_<branch>` exist for live worktrees; drop them when the worktree goes.

## 18 Oct additions
- #28 R34 free-tier cost guard (D57): caps at 80% storage / 50% monthly R2 ops / Unsplash 25 per hour, Postgres counters, kill switch, admin `GET /api/admin/usage`; files always stream through the server (no presigned URLs).
- #29 feed polish (overlay rail, slide dots, dark backdrop, Saved tab on Profile). #30 R29 video server (D59) — merge if CI green.
- Open branch `feat/r21c-editor-2` (worktree r21c2): R21c slice 2 steps 1-6, unreviewed; renumber its NOTE-TC68-74 to NOTE-TC78-84 (clash with R29); then step 7 (draft thumbnails, publish preview).
- User decisions 18 Oct: host on **Render free web service** (Fly.io dropped: no free tier, no cap); R35 photo import on Gemini Flash-Lite free tier; R36 dictation on Cloudflare Workers AI Whisper; never exceed a free tier. R2 credentials are in `.env`; Gemini and Workers AI keys coming.

## Next work, in order
0. **R2 storage driver** (S3 API, stream through the server, single PutObject, ranged reads; D57).
1. **R21c slice 2 (rest):** multi-select, inline styling outside an open box, handles clipped at board edge, aspect-change
   confirm (wireframe 23), locked-editor screens (28/29), code/table/image/video editing UI, draft thumbnails and the
   publish preview with `SlideBoard`. Then **R21d** templates, themes, self-hosted fonts.
2. **R22 client** (upload panel, my uploads, Unsplash panel once `UNSPLASH_ACCESS_KEY` is set) and **R29 video** (needs
   `winget install Gyan.FFmpeg` first). R2 driver when the user gives Cloudflare R2 keys.
3. Lane C (`frontend`): R30 share/collaboration UI, messaging (Vite proxy has `/socket.io` ws), R8 notifications,
   admin pages restyle, Saved/Drafts restyle (`usePaged` exists), then `/code-review high` at sprint end.
4. Sprint 5: R9 Jamendo (`JAMENDO_CLIENT_ID`), R10 annotations (after R21), R11 deploy, R20 audit, R27 scale-out.
5. Before the first deploy (R11): `trust proxy` hop count `1` (never `true`, D45), `COOKIE_SECURE=true`,
   one Render instance (750 free hours) until the Socket.io Postgres adapter (R27); never add a card to Render; a page CSP in Cloudflare Pages
   `_headers` must allow `https://images.unsplash.com` and the API origin for images.

## Known limits
- Agents stopped twice on usage limits; resume them with SendMessage, not new agents.
- `/security-review` runs only from a session whose working directory is a git checkout (it worked from a worktree).
- Guests' image loads count against the guest read limit (one request per image) until R2 presigned URLs.
- `erd.png` still needs Java + PlantUML to re-render.
