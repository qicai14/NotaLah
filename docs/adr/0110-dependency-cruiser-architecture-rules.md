# 0110 - Architecture rules enforced by dependency-cruiser in `vp run check` (#153, 26 Nov 2026)

- **Context:** the layering in [0102](0102-three-tier-rest-api-with-socket-io.md) and [0106](0106-slide-note-deck-schema-in-shared.md)
  was only written down; nothing failed when a PR broke it.
- **Decision:** `.dependency-cruiser.cjs` forbids: circular imports; `client/` importing `server/` and the reverse;
  `shared/` importing either side; production code importing test code (`*.test.*`, `server/tests/`, `e2e/`). It runs as
  the last step of `vp run check`, so CI fails on a violation. Three cycles that already existed are listed in
  `.dependency-cruiser-known-violations.json` (regenerate with `depcruise ... --output-type baseline`) so new ones fail
  while the old ones are fixed (issue #160). `scripts/check-deps.test.mjs` proves each rule fails on a fixture project.
- **Notes:** TypeScript 7 has no JS API, so dependency-cruiser parses with `@swc/core` (`parser: 'swc'`), and the client's
  `@/` alias is resolved through `tsconfig.depcruise.json`. A rule "a feature may not import another feature's
  repository" (ARCHITECTURE.md convention) was tried and dropped: it flags 50 existing imports (issue #161), so the convention was rewritten to
  match the code (ARCHITECTURE.md, #161).
- **Not done:** an orphan-module rule; entry points (routes, scripts, tests) make it noisy, so it was left out.
- **Alternatives:** ESLint import rules (no graph-wide cycle detection); `madge` (cycles only).
- **Reversibility:** High; one config, one check step.
- **Tests:** `scripts/check-deps.test.mjs`.
