import { defineConfig } from 'vite-plus';

// docs/ and Markdown are hand-written dissertation material, so lint and format cover the app code only.
export default defineConfig({
  staged: {
    '*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}': 'vp check --fix',
    '*.{json,jsonc,yaml,yml,css}': 'vp fmt',
  },
  lint: { ignorePatterns: ['docs/**'], options: { typeAware: true, typeCheck: true } },
  fmt: { singleQuote: true, printWidth: 120, ignorePatterns: ['docs/**', '**/*.md', 'pnpm-lock.yaml'] },
  run: {
    tasks: {
      // Type checks read @parp/shared's built .d.ts files.
      check: { command: 'vp check', dependsOn: ['@parp/shared#build'] },
      dev: { command: 'vp run -r --parallel dev', dependsOn: ['@parp/shared#build'], cache: false },
    },
  },
});
