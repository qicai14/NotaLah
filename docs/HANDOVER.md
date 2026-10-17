# Handover — 17 Oct 2026, late morning (Sprint D under way)

NotaLah (formerly PARP). Read with `../PLAN.md` (backlog R0-R33), `docs/DECISIONS.md` (D1-D56),
`docs/specs/SprintD_spec.md` (agreed 17 Oct, D52), `docs/specs/R21_editor_data_model.md` and
`../AUTOPILOT_2026-10-17.md` (this run's log, with decisions to confirm). Older run logs: `../run-logs/`.

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

## Next work, in order
1. **R21c slice 2:** multi-select, inline styling outside an open box, handles clipped at board edge, aspect-change
   confirm (wireframe 23), locked-editor screens (28/29), code/table/image/video editing UI, draft thumbnails and the
   publish preview with `SlideBoard`. Then **R21d** templates, themes, self-hosted fonts.
2. **R22 client** (upload panel, my uploads, Unsplash panel once `UNSPLASH_ACCESS_KEY` is set) and **R29 video** (needs
   `winget install Gyan.FFmpeg` first). R2 driver when the user gives Cloudflare R2 keys.
3. Lane C (`frontend`): R30 share/collaboration UI, messaging (Vite proxy has `/socket.io` ws), R8 notifications,
   admin pages restyle, Saved/Drafts restyle (`usePaged` exists), then `/code-review high` at sprint end.
4. Sprint 5: R9 Jamendo (`JAMENDO_CLIENT_ID`), R10 annotations (after R21), R11 deploy, R20 audit, R27 scale-out.
5. Before the first deploy (R11): `trust proxy` hop count `1` (never `true`, D45), `COOKIE_SECURE=true`,
   `kill_timeout = 15`, one Fly machine until the Socket.io Postgres adapter (R27); a page CSP in Cloudflare Pages
   `_headers` must allow `https://images.unsplash.com` and the API origin for images.

## Known limits
- Agents stopped twice on usage limits; resume them with SendMessage, not new agents.
- `/security-review` runs only from a session whose working directory is a git checkout (it worked from a worktree).
- Guests' image loads count against the guest read limit (one request per image) until R2 presigned URLs.
- `erd.png` still needs Java + PlantUML to re-render.
