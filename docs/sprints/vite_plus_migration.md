# Vite+ migration (D47)

Branch `chore/vite-plus`. Moves the workspace from Vite 8.3.1 + Vitest 5.0.2 to `vite-plus`, first at 1.0.0 (28 Sep, within the two-week rule), then bumped to 1.3.0 on 16 Oct (published that day) as a user-approved exception to the two-week rule.
`vp --version` (1.3.0) reports Vite 8.3.4, Rolldown 1.2.14, Vitest 5.0.5, Oxlint 1.88.0, Oxfmt 0.73.0, tsgolint 7.0.2004.

## What changed

- Root `package.json`: devDependencies `vite-plus` 1.3.0 and `vite` aliased to `npm:@voidzero-dev/vite-plus-core@1.3.0`;
  `overrides` alias `vite` the same way and pin `vitest` to 5.0.5 (the version vite-plus 1.3.0 bundles). New scripts:
  `lint` (`vp lint`), `format:check` (`vp fmt --check`), `check` (`vp check --no-fmt && npm run typecheck`).
- `client/package.json`: `vite` removed, `vite-plus` 1.3.0 added, `vitest` 5.0.5; scripts `dev`/`build`/`preview`/`test` run through `vp`.
- `server/package.json`: `vite-plus` 1.3.0, `vitest` 5.0.5, `test` runs `vp test run`.
- `client/vite.config.ts` and `server/vitest.config.ts` import `defineConfig` from `vite-plus`.
- New root `vite.config.ts`: Oxlint and Oxfmt settings (single quotes, print width 120).
- `.github/workflows/ci.yml`: added a Lint step before Typecheck. `npm run typecheck`, `npm test`, `npm run build` keep their names.
- `package-lock.json` regenerated; `npm ci` from a clean checkout works and `npm ls` reports no invalid or missing packages.

## Decisions and caveats

- `vp migrate` was not run: the sandbox blocked `npx -p vite-plus@1.3.0 vp migrate`, so the migration was done by hand from the docs.
- The `vite` alias is also a root devDependency. With only the override, npm nests the alias under `vite-plus` and
  `@tailwindcss/vite` could not resolve `vite` (`ERR_MODULE_NOT_FOUND`); the top-level edge hoists it.
- Test files still import from `vitest`, not `vite-plus/test`: `server/tsconfig.json` uses `moduleResolution: node`, which cannot
  resolve the `vite-plus/test` subpath. The pin keeps `vitest` and `vp test` on one copy. Switching later needs a server tsconfig change.
- Type-aware lint is off: Oxlint's tsgolint rejects `server/tsconfig.json` (`moduleResolution=node10` removed). `tsc` still runs in `typecheck`.
- Formatting: the code base was hand-written with long JSX lines, so Oxfmt (single quotes, width 120) still wants to change 107 of 163 files
  (46 ts, 24 tsx, 28 md and others). Nothing was reformatted and `format:check` is not in CI. A dedicated formatting PR should run
  `vp fmt` once, then add `npm run format:check` to CI.
- Lint: 0 errors, 5 warnings, none fixed: `no-unused-expressions` in `client/src/components/Dialog.tsx` (2) and
  `client/src/components/NoteActions.tsx` (1); `no-unused-vars` in `server/tests/ranking/ranking.test.ts` (unused `_`) and
  `server/tests/auth/auth.test.ts` (unused `requireAuth` import).
- `npm audit` reports 1 moderate production vulnerability both before and after; the CI gate (`--audit-level=high --omit=dev`) passes.
- `npm run dev` verified: server health `{"status":"ok","db":"up"}` on :4000, client 200 on :5173, `/api` proxy 200; then stopped.

## Verification

After the 1.3.0 bump and merge of main: typecheck clean, server 243 passed (1 skipped), client 21/21, build passes, lint 0 errors and 5 warnings. The 1.3.0 re-check found type-aware lint (tsgolint 7.0.2004) and `vite-plus/test` under `moduleResolution: node` still fail, so both stay off.

## Timings (re-measured on 1.3.0, 16 Oct)

Plain Vite is origin/main (Vite 8.3.1, Vitest 5.0.2) in a second worktree; Vite+ is this branch (1.3.0). Runs were interleaved (plain, Vite+, plain, Vite+, ...), three each, wall clock in seconds. The machine was busy with other agents, so the numbers are noisy.

| Task | Plain Vite runs | Vite+ 1.3.0 runs | Median plain | Median Vite+ |
|---|---|---|---|---|
| `npm run build` | 12.47, 8.81, 6.68 | 13.77, 8.41, 6.88 | 8.81 | 8.41 |
| Client tests | 8.58, 3.98, 3.50 | 23.18, 4.13, 4.40 | 3.98 | 4.40 |
| Server tests | 63.32, 55.90, 48.74 | 65.52, 50.56, 54.93 | 55.90 | 54.93 |

Verdict: the same speed within noise. The 10 percent slowdown seen with 1.0.0 (measured non-interleaved) does not reproduce: build and server tests are level, and the client suite is about 0.4 s slower in the median, which is the `vp` start-up wrapper, with one 23 s outlier that was machine load. Vite+ is not faster; its benefit stays fewer tools and configs (lint, format, one CLI), as D47 states.

Earlier 1.0.0 figures, non-interleaved on a quieter machine (plain 5.94 s build, 3.00 s client, 32.5 s server; Vite+ 6.54 s, 3.30 s, 35.8 s), are kept for history only.
