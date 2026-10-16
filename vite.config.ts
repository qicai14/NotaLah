import { defineConfig } from 'vite-plus';

// Type-aware lint is off because tsgolint rejects server/tsconfig.json (moduleResolution "node"); tsc runs separately.
// Formatting applies to code only; docs and Markdown are hand-written and excluded.
export default defineConfig({
  lint: { options: { typeAware: false, typeCheck: false } },
  fmt: { singleQuote: true, printWidth: 120, ignorePatterns: ['docs/**', '**/*.md', 'package-lock.json'] },
});
