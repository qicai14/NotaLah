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
  `reports/stryker-incremental.json` through the Actions cache, later nights only re-run changed code. The nightly run is a matrix of one job per `server/src/features/*` directory plus `lib` (#158), so a job is small enough to finish; each job logs its own score (no overall figure is computed).

### First nightly run on main (#156)

Run [45737626211](https://github.com/qicai14/NotaLah/actions/runs/45737626211) (schedule, 26 Nov 2026, started 01:43 UTC,
all 20 jobs `success`). Method: the nightly matrix of one job per `server/src/features/*` directory plus `lib`, one runner
each, break threshold overridden to 0 (so no job could fail on score). Scores come from the `All files` row of each job's
Stryker clear-text report (`gh run view --job <id> --log`); "Job time" is the whole job (setup, Postgres, Stryker), and the
jobs shared a few runners, so wall time is not the sum. Every job reported a score; none timed out or was skipped. No
overall figure is computed: the per-area scores are not averaged.

| Area | Score % | Killed | Timeout | Survived | No coverage | Errors | Job time |
|---|---|---|---|---|---|---|---|
| features/auth | 88.89 | 296 | 0 | 30 | 7 | 4 | 33 min 26 s |
| features/moderation | 84.91 | 270 | 0 | 46 | 2 | 0 | 14 min 28 s |
| features/notifications | 87.13 | 88 | 0 | 13 | 0 | 0 | 11 min 09 s |
| features/ai | 82.67 | 167 | 0 | 33 | 2 | 1 | 12 min 31 s |
| features/notes | 86.70 | 547 | 7 | 74 | 11 | 0 | 27 min 50 s |
| features/annotations | 82.91 | 131 | 0 | 25 | 2 | 0 | 6 min 54 s |
| features/modules | 97.56 | 40 | 0 | 1 | 0 | 0 | 3 min 36 s |
| features/messaging | 84.33 | 436 | 0 | 64 | 17 | 1 | 27 min 29 s |
| features/collaboration | 85.71 | 252 | 0 | 42 | 0 | 0 | 19 min 02 s |
| features/feed | 94.38 | 168 | 0 | 9 | 1 | 0 | 15 min 17 s |
| features/assets | 74.91 | 418 | 21 | 94 | 53 | 38 | 54 min 32 s |
| features/engagement | 85.77 | 216 | 1 | 36 | 0 | 0 | 8 min 58 s |
| features/music | 73.89 | 133 | 0 | 45 | 2 | 0 | 11 min 49 s |
| features/ranking | 90.67 | 68 | 0 | 7 | 0 | 0 | 15 min 24 s |
| features/search | 94.44 | 187 | 0 | 8 | 3 | 1 | 14 min 32 s |
| features/users | 94.89 | 222 | 1 | 12 | 0 | 0 | 14 min 17 s |
| features/verification | 92.86 | 52 | 0 | 4 | 0 | 0 | 4 min 51 s |
| features/usage | 91.21 | 83 | 0 | 8 | 0 | 1 | 6 min 41 s |
| features/unsplash | 78.20 | 104 | 0 | 20 | 9 | 0 | 9 min 16 s |
| lib | 86.76 | 451 | 1 | 60 | 9 | 23 | 48 min 09 s |

Score is Stryker's total (killed + timeout over all mutants); "Errors" are mutants Stryker could not run (compile or runtime
errors in the mutant), left out of this count. Lowest areas: `features/music` 73.89, `features/assets` 74.91 (53 no-coverage
and 38 errored mutants, so its score is the least reliable), `features/unsplash` 78.20. Highest: `features/modules` 97.56,
`features/users` 94.89, `features/search` 94.44. The summed killed plus timeout is 4,360 against 749 survived or uncovered,
about 85 % across all areas (a rough figure, not a Stryker output). The earlier local keyset figure (72.73 %) is lower than
the `lib` job (86.76 %) because that run covered one file, not all of `lib`.

Run [45748610373](https://github.com/qicai14/NotaLah/actions/runs/45748610373) (workflow_dispatch, same night) failed: jobs
`features/annotations` and `features/ranking` stopped at the "install ffmpeg" step, where all three `apt-get install`
attempts failed (step exit code 1). It is a runner-setup failure, not a mutation result; the other 18 jobs passed.

Thresholds: every area is at or above 73 % while the config breaks at 50 and `low` is 60, so `thresholds.break` in
`server/stryker.config.mjs` could ratchet to about 70 first (music, the lowest, is 73.89), and later toward 80 once music,
assets and unsplash are improved. This is a suggestion only; the config is unchanged.

Required PR gate: the PR `mutation` job mutates only changed files, so its cost scales with the change. The slowest single area
here took 54 min (`assets`, `lib` 48 min) and the 60 min cap is close for a change touching those, while most areas finish in
5-30 min. So `mutation` looks fast enough to require for small PRs but not for ones touching `assets` or `lib` broadly; whether
to require it is Cai's call.
