<!-- Agreed with the user, 17 Oct 2026 (D52). -->
# Sprint D spec — UI system, editor, feature UIs (agreed 17 Oct 2026)

## Context
Sprint 4 backend (search, blocking, messaging, R8) plus R30/R31 backends are merged; wireframes v3 (57 screens) are
approved, so the frontend gate is lifted. Sprint D delivers the UI for all of it, the R19 redesign, and the R21 editor
with R22 images and R29 video, following `docs/specs/R21_editor_data_model.md` (its 7 open questions were answered in D43).

## Decisions (user interview, 17 Oct) — log as D52
- **Theme:** light default + dark (system setting and toggle). TikTok layout: left rail on desktop, bottom tabs on
  mobile, full-height card feed. All colours are CSS variables in one token file so the palette can be swapped later
  (user may pick one with Google Stitch); no hard-coded colours in components.
- **Order:** design system → shell, feed, note detail, welcome/auth → everything else; all 57 v3 screens by sprint end.
- **Split:** `frontend-designer` (Opus): tokens, shadcn/ui setup, `client/DESIGN.md`, shell, feed, note detail,
  welcome/auth + R31 guest sheet, then the R21 editor UI (R21c/R21d, R22/R29 panels). `frontend` (Sonnet): R21b board
  rollout, search, profiles + blocking, R30 share/collab, messaging, R8 notifications, admin pages, Saved/Drafts.
  `implementer`: server halves.
- **R21 order:** spec order — R21a → R21b → R21c (R22 server in parallel) → R21d → R22 client → R29.
- **Storage:** storage interface with a local-disk driver for dev/tests now; R2 driver plugged in when the user supplies
  keys. Unsplash panel built but disabled until `UNSPLASH_ACCESS_KEY` exists. Keys go in `server/.env` by the user, never chat.
- **Approved proposals:** local backup for published notes (cleared on logout and after Update; restore only when the
  backup's base version equals server `updatedAt`); ffmpeg via `winget install Gyan.FFmpeg` locally, apt-get in CI/Docker;
  shadcn/ui via its CLI (deps pinned ≥ 2 weeks old).
- **Process:** up to 3 parallel worktrees under `FYP/worktrees/`, each with a private test DB; implementer/frontend →
  reviewer → fixes → tester → PR → merge when CI green and no blockers; screenshots of key screens to the user as they land.

## Branches (three lanes)
| Lane | Branch | Agent | Depends on |
|---|---|---|---|
| A | `feat/r19-design-system` (tokens, shadcn, shell, feed, note detail, welcome/auth, guest sheet, lazy routes, `useAction`, memoised cards, Vite proxy `/socket.io` `ws: true`) | frontend-designer | — |
| B | `feat/r21a-slide-elements` (`shared/` workspace, zod deck schema, migration, notes API, search doc; NOTE-TC28-36, 41-42, 45-48) | implementer | — |
| B | `feat/r22-uploads-server` (storage interface + local driver, upload/re-encode/EXIF strip, quota, asset table, hidden-note rule, Unsplash proxy; NOTE-TC33/34/37/38/40) | implementer → `/security-review` | R21a |
| B | `feat/r29-video-server` (ffprobe validation, poster, limits; NOTE-TC39) | implementer → `/security-review` | R22 server |
| C | `feat/r21b-slideboard` (read-only `SlideBoard` in feed, note, thumbnails, publish preview, moderation) | frontend | R19, R21a |
| A | `feat/r21c-editor` (store, undo, transforms + geometry tests NOTE-TC44, element types, layers, strip, autosave, local backup, mobile) | frontend-designer | R21b |
| A | `feat/r21d-templates` then `feat/r22-r29-editor-panels` | frontend-designer | R21c, R22/R29 server |
| C | `feat/ui-search`, `feat/ui-profiles-blocking`, `feat/ui-collab` (R30), `feat/ui-messaging`, `feat/ui-notifications` (R8), `feat/ui-admin` | frontend | R19 |

Lane C starts once R19 merges; until then lane C is idle (lanes A and B run).

## Reuse
`client/src/lib/api.ts` (`api`, `ApiError`), `useFetch`, `components/Dialog`, `ConfirmButton`, `ReportDialog`,
`SlideViewer` (replaced by `SlideBoard` in R21b), server `lib/db.ts` (`inTransaction`), `idParam`, notes `VISIBLE`.

## Verification
Per branch: tester runs `npm test` (server + client), typecheck, `vp check`, lint, build; CI green before merge.
UI branches: run the dev server and check light/dark, desktop and 375 px, against the matching v3 wireframe.
Sprint end: `/code-review high`; log D52+ and update PLAN.md statuses and HANDOVER.

## Needs from the user (asked when the item starts)
`winget install Gyan.FFmpeg` before R29; R2 and Unsplash keys whenever available.
