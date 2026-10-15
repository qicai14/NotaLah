# Vite+ migration (D47)

Branch `chore/vite-plus`. Moves the workspace from Vite 8.3.1 + Vitest 5.0.2 to `vite-plus` 1.0.0 (28 Sep, passes the two-week rule).
`vp --version` reports Vite 8.3.1, Rolldown 1.2.11, Vitest 5.0.1, Oxlint 1.85.0, Oxfmt 0.70.0.

## What changed

- Root `package.json`: devDependencies `vite-plus` 1.0.0 and `vite` aliased to `npm:@voidzero-dev/vite-plus-core@1.0.0`;
  `overrides` alias `vite` the same way and pin `vitest` to 5.0.1 (the version vite-plus 1.0.0 bundles). New scripts:
  `lint` (`vp lint`), `format:check` (`vp fmt --check`), `check` (`vp check --no-fmt && npm run typecheck`).
- `client/package.json`: `vite` removed, `vite-plus` 1.0.0 added, `vitest` 5.0.1; scripts `dev`/`build`/`preview`/`test` run through `vp`.
- `server/package.json`: `vite-plus` 1.0.0, `vitest` 5.0.1, `test` runs `vp test run`.
- `client/vite.config.ts` and `server/vitest.config.ts` import `defineConfig` from `vite-plus`.
- New root `vite.config.ts`: Oxlint and Oxfmt settings (single quotes, print width 120).
- `.github/workflows/ci.yml`: added a Lint step before Typecheck. `npm run typecheck`, `npm test`, `npm run build` keep their names.
- `package-lock.json` regenerated; `npm ci` from a clean checkout works and `npm ls` reports no invalid or missing packages.

## Decisions and caveats

- `vp migrate` was not run: the sandbox blocked `npx -p vite-plus@1.0.0 vp migrate`, so the migration was done by hand from the docs.
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

Typecheck clean, server 208/208, client 21/21, build passes.

## Timings (wall clock, same machine, three runs each)

| Task | Before (Vite 8.3.1 / Vitest 5.0.2) | After (Vite+ 1.0.0) |
|---|---|---|
| `npm run build` (tsc + vite build, both workspaces) | 5.86 s, 5.97 s, 5.98 s (mean 5.94 s) | 7.01 s, 6.47 s, 6.15 s (mean 6.54 s) |
| Client tests (`npm test -w client`) | 3.02 s, 3.03 s, 2.95 s (mean 3.00 s) | 3.21 s, 3.15 s, 3.53 s (mean 3.30 s) |
| Server tests (`npm test -w server`) | 32.63 s, 32.28 s, 32.69 s (mean 32.53 s) | 36.45 s, 34.69 s, 36.15 s (mean 35.76 s) |

All three tasks were about 10 percent slower after the change, in every run. The cause was not measured; the runs were
not interleaved, so machine load from other agents may account for part of it. D47 accepts this: the gain is fewer
tools (one CLI, linting added), not speed.
