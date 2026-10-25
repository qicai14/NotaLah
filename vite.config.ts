import { defineConfig } from 'vite-plus';

// docs/ and Markdown are hand-written dissertation material, so lint and format cover the app code only.
export default defineConfig({
  staged: {
    '*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}': 'vp check --fix',
    '*.{json,jsonc,yaml,yml,css}': 'vp fmt --no-error-on-unmatched-pattern',
  },
  lint: { ignorePatterns: ['docs/**', 'load/k6/**'], options: { typeAware: true, typeCheck: true } },
  fmt: { singleQuote: true, printWidth: 120, ignorePatterns: ['docs/**', 'load/k6/**', '**/*.md', 'pnpm-lock.yaml'] },
  run: {
    tasks: {
      // Type checks read @notalah/shared's built .d.ts files.
      check: { command: 'vp check && node scripts/check-agents.mjs', dependsOn: ['@notalah/shared#build'] },
      dev: { command: 'vp run -r --parallel dev', dependsOn: ['@notalah/shared#build'], cache: false },
    },
  },
});
