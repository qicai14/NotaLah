# Test cage baseline (#151)

Method: `vp run server#test --coverage` (v8, `server/vite.config.ts`), then every function scored with `scripts/crap.mjs`
(CRAP = CC^2 x (1 - coverage)^3 + CC; CC = 1 + branch paths minus one per branch inside the function; coverage = share of
its statements hit). Run on main at commit f8c4897 (25 Nov 2026), local machine, 491 tests passed.

- Functions scored: 759 (server/src). Above the cap of 30: 1 (`server/src/scripts/load/run.ts` `call`, CRAP 110,
  load-test script with no unit tests; only counted if a PR touches it).
- Highest others: `notes/service.ts` `parseNoteBody` 27 (CC 27, 94%), `search/routes.ts` handler 24, `notes/routes.ts`
  handler 21.
- The gate only fails functions a PR touches, so existing debt does not block unrelated work.
