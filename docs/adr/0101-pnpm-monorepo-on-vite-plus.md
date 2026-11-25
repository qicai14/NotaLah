# 0101 - pnpm monorepo on the Vite+ toolchain (summary of D13, D61, D63, #152, 26 Nov 2026)

- **Context:** one student maintains a React client, an Express API and a shared schema package. The IR fixes the stack
  (React, Node, Express, PostgreSQL); the build tooling was left open.
- **Decision:** a pnpm workspace with three packages (`client/`, `server/`, `shared/`) and one toolchain, Vite+ (`vp`),
  for install, format, lint, type-aware lint, type check, test, build and cached tasks. TypeScript 7, Vitest only through
  Vite+. CI uses `setup-vp` and the Vite Task cache. npm and npx are not used. Details and the migration record:
  D61 and D63 in [DECISIONS.md](../DECISIONS.md).
- **Alternatives:** npm workspaces with tsc, concurrently and separate lint scripts (the state before D61); Turborepo or
  Nx on top of pnpm (a second task runner for three packages).
- **Reversibility:** Medium; each package keeps ordinary `package.json` scripts, so leaving Vite+ means re-adding
  per-package tooling.
- **Tests:** none specific; `vp run check`, `vp run -r test` and `vp run -r build` are the CI gates.
