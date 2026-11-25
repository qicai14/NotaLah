# Test cage baseline (#151)

Method: `vp run server#test --coverage` (v8, `server/vite.config.ts`), then every function scored with `scripts/crap.mjs`
(CRAP = CC^2 x (1 - coverage)^3 + CC; CC = 1 + branch paths minus one per branch inside the function; coverage = share of
its statements hit). Run on main at commit f8c4897 (25 Nov 2026), local machine, 491 tests passed.

- Functions scored: 759 (server/src). Above the cap of 30: 1 (`server/src/scripts/load/run.ts` `call`, CRAP 110,
  load-test script with no unit tests; only counted if a PR touches it).
- Highest others: `notes/service.ts` `parseNoteBody` 27 (CC 27, 94%), `search/routes.ts` handler 24, `notes/routes.ts`
  handler 21.
- The gate only fails functions a PR touches, so existing debt does not block unrelated work.

## Mutation (Stryker)

Method: `cd server && vp exec stryker run --mutate src/lib/keyset.ts` (StrykerJS 10.1.1, vitest runner, perTest coverage,
string-literal mutants excluded, one runner because the tests share one database), local machine, 25 Nov 2026.

- `src/lib/keyset.ts`: 44 mutants, 32 killed, 12 survived, score 72.73 % (break threshold 50).
- Cost: 27 min 33 s for those 44 mutants, about 110 tests run per mutant (keyset is used by most tests). Hence the PR job
  `mutation` is advisory (`continue-on-error`, 60 min cap) and the full run is a nightly report
  (`.github/workflows/mutation-nightly.yml`). Make `mutation` required only after a few runs show its real duration.
- TypeScript 7 has no JS API, which Stryker's tsconfig rewrite needs, so the config runs `inPlace: true`.
- Scope: `server/src` only (`shared/src` has no database-free mutation run yet). The nightly run restores and saves
  `reports/stryker-incremental.json` through the Actions cache, so after one complete run later nights only re-run changed code. Stryker writes that file only at the end, so a run that hits the 350 min cap saves nothing; if that happens, split the nightly run per directory.
- The first nightly run on main is the full baseline; add its score here when it exists.
