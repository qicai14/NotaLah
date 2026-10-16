# server feature: notes

Slide-note API (FR8, FR9, FR10). Routes in `routes.ts` (`/api/notes`, `/api/modules`), behind `requireAuth` except get one, which guests may read (`optionalAuth`, D45):
create, full-replace edit, soft delete, get one (visibility-checked, 404 when hidden), own drafts, module list.
`service.ts` validates the body (the zod deck schema from `@parp/shared`, plus hashtag, per-slide size and publish rules) and sanitises each text element with `sanitize-html`;
`repository.ts` holds the SQL: one transaction writes the post, slides (`sld_doc` JSONB plus private `sld_notes`), hashtags and rebuilds `pst_search_doc`.
Edit collaborators may also PUT (content only, `baseUpdatedAt` required, 409 stale, 423 locked) and collaborators may GET
drafts and friends-only notes (R30, D46; routes in `features/collaboration`). Rules and limits: D21 in `docs/DECISIONS.md`. Test table: `NOTE-TC*` in `docs/chapter4/4.5_test_cases.md`.
