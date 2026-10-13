# server feature: notes

Slide-note API (FR8, FR9, FR10). Routes in `routes.ts` (`/api/notes`, `/api/modules`), all behind `requireAuth`:
create, full-replace edit, soft delete, get one (visibility-checked, 404 when hidden), own drafts, module list.
`service.ts` validates the body (zod plus hashtag, slide and publish rules) and sanitises slides with `sanitize-html`;
`repository.ts` holds the SQL: one transaction writes the post, slides, hashtags and rebuilds `pst_search_doc`.
Rules and limits: D21 in `docs/DECISIONS.md`. Test table: `NOTE-TC*` in `docs/chapter4/4.5_test_cases.md`.
