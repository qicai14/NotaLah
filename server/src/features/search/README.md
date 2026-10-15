# server feature: search

Will hold: Subject, module code, hashtag, keyword and full-text search, with lecturer and published-date filters (FR15 reworked, see Sprint 0 review).

Contents: search queries (indexes added by migration) and routes.

Serves: FR4, FR5, FR12, FR15. Test table: `SRCH-TC*` in `docs/chapter4/4.5_test_cases.md`.

Guests must be able to search public notes (D44): use `optionalAuth` and `viewerId` from `auth/middleware.ts`, as the feed does.

Filled in: Sprint 4. See `docs/ARCHITECTURE.md` for the layering rules.
