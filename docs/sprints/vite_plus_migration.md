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

## Native migration, 20 Oct

Branch `chore/vite-plus-native` (D61). The toolchain now runs on Vite+ end to end instead of Vite+ sitting on top of npm scripts.

### What changed

- `vp migrate --full --no-interactive --no-agent` (global vp 1.3.0) ran first, after the npm-to-pnpm switch. It moved `vite`,
  `vitest` and `vite-plus` into a pnpm catalog with `vite@*`/`vitest@*` overrides, rewrote 52 test files to import from
  `vite-plus/test`, added the `.vite-hooks/pre-commit` hook (`vp staged`) and a `staged` block. It wrote no editor files,
  so `.vscode/` was added by hand. Agent files were declined (`--no-agent`).
- pnpm 12.14.0 workspaces (`pnpm-workspace.yaml`), `workspace:*` for `@parp/shared`, `pnpm-lock.yaml` from `vp install`.
  Only `esbuild` needs its install script (`allowBuilds`); sharp 0.35 and dbmate ship prebuilt binaries with no script.
  Node 24.22.0 (newest LTS) is pinned in `.node-version` and pnpm in `packageManager` by `vp env pin`; `engines.node` is
  `^24.22.0`. Version policy (user, 20 Oct): newest releases, exact pins, pnpm `minimumReleaseAge` 3 days for npm
  packages with the Vite+ toolchain excluded; this replaces the two-week rule. The guard rejected one transitive jsdom
  dependency (`@asamuzakjp/css-color` 7.1.7, published 17 Oct), which now resolves to 7.1.6. Patch and minor updates were
  applied (React 19.3.1, Express 5.3.0, tiptap 3.32.0 with its overrides, radix-ui 1.8.1, lucide-react 1.58.0, zod 4.6.7,
  pino 10.4.0, sanitize-html 2.18.1 and others).
- Server is ESM (`"type": "module"`, `moduleResolution: bundler`), built by `vp pack` (tsdown) unbundled into `dist/`.
  `__dirname` became `import.meta.dirname`, `require.main === module` became `import.meta.main`. `node dist/server.js`
  starts and `/api/health` answers `{"status":"ok","db":"up"}`.
- `shared` is built by `vp pack` (ESM plus `index.d.ts`) instead of `tsc`.
- `vp check` runs format, lint, type-aware lint and the type check (tsgolint). With type-aware rules on, lint reported 140 warnings in
  app code, all fixed: 77 `unbound-method` (callback props declared as methods are now property signatures), 35
  `require-array-sort-compare` (test sorts of ids), 14 `no-floating-promises` (`void navigate(...)`), 8
  `no-base-to-string`, 3 `no-meaningless-void-operator`, 2 unused test bindings, plus the `no-control-regex` in messaging,
  which keeps one commented suppression because matching control characters is its purpose. `docs/` is excluded from lint,
  as it already was from fmt.
- Tests: direct `vitest` dependencies dropped; `server/vitest.config.ts` folded into `server/vite.config.ts`.
- Tasks: `concurrently` and the `pretest`/`pretypecheck`/`prepare` build hooks are gone. Cached `run.tasks`: root `check`,
  `build` in each package, client `test`. Server `test` has `cache: false`. Each depends on the shared build.
  `vp run dev` builds shared, then runs shared watch, server and client in parallel. Shared watch uses `--no-clean`,
  because cleaning `dist/` on start crashed the server with `ERR_MODULE_NOT_FOUND`.
- Client: `resolve.tsconfigPaths` replaces the hand-written `@` alias; there are no `rollupOptions` or `manualChunks`.
- CI: `voidzero-dev/setup-vp` v1.21.2 pinned by commit SHA, Vite Task cache restore and save,
  `pnpm audit --prod --audit-level high`. First run on the branch: green in 2m49s.

### Timings, 20 Oct

Same worktree and machine, median of 3, wall clock in seconds. "Before" is main (npm, tsc, concurrently); "after" is this
branch. Uncached runs use `vp run --no-cache`; cached runs are an immediate rerun with nothing changed.

| Task | Before (command) | Before runs | After (command) | After runs | Median before | Median after |
|---|---|---|---|---|---|---|
| Install (no node_modules, warm store) | `npm ci` | 110.53, 94.57, 92.03 | `vp install` | 14.94, 10.54, 10.10 | 94.57 | 10.54 |
| Static checks | `npm run typecheck && npm run lint && npm run format:check` | 21.00, 17.67, 16.52 | `vp run --no-cache check` | 5.08, 5.19, 4.98 | 17.67 | 5.08 |
| Static checks, cached | - | - | `vp run check` | 0.72, 0.73 (first run 5.41) | - | 0.73 |
| Client tests | `npm test -w client` | 17.02, 13.40, 14.70 | `vp run --no-cache client#test` | 16.62, 15.67, 15.28 | 14.70 | 15.67 |
| Client tests, cached | - | - | `vp run client#test` | 0.78, 0.85 (first run 17.40) | - | 0.85 |
| Server tests | `npm test -w server` | 87.79, 97.15, 93.16 | `vp run server#test` (never cached) | 92.97, 85.04, 84.47 | 93.16 | 85.04 |
| Build | `npm run build` | 14.59, 11.82, 13.35 | `vp run --no-cache -r build` | 3.35, 3.20, 3.40 | 13.35 | 3.35 |
| Build, cached | - | - | `vp run -r build` | 0.94, 0.92 (first run 2.42) | - | 0.94 |
| Dev cold start to ready | concurrently (shared tsc -w, tsx watch, vp dev) | 3.25, 3.35, 3.43 | `vp run dev` | 2.50, 2.01, 2.31 | 3.35 | 2.31 |

Notes: the old build ran `tsc --noEmit` before `vp build` and built shared and server with `tsc`; type checking now lives
in `vp run check`, so the build number is not like for like. Server and client test times are within noise; their gain is
only the cached shared build. Dev ready is measured until the server logs "server listening" and Vite prints "ready in",
on ports 4300/5373. Install is with a warm npm cache and a warm pnpm store respectively.

### Verification

`vp install`, `vp run check` (0 warnings, 0 errors), `vp run -r test` (server 367 passed and 2 skipped, client 113 passed),
`vp run -r build`, `vp run server#start` with a health check, `vp run dev` (both apps up, `/api` proxy 200), and the
pre-commit hook (fires on a staged `.ts` change and blocks a type error; docs-only commits skip it). Test counts match main.
