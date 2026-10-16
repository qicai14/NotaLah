import { defineConfig } from 'vite-plus';

// Type-aware lint is off because tsgolint rejects server/tsconfig.json (moduleResolution "node"); tsc runs separately.
// The format options approximate the existing hand-written style, but the codebase is not yet formatted (see docs/sprints/vite_plus_migration.md).
export default defineConfig({
  lint: { options: { typeAware: false, typeCheck: false } },
  fmt: { singleQuote: true, printWidth: 120 },
});
