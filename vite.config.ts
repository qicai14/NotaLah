import { defineConfig } from 'vite-plus';

// docs/ and Markdown are hand-written dissertation material, so lint and format cover the app code only.
export default defineConfig({
  staged: {
    '*': 'vp check --fix',
  },
  lint: { ignorePatterns: ['docs/**'], options: { typeAware: true, typeCheck: true } },
  fmt: { singleQuote: true, printWidth: 120, ignorePatterns: ['docs/**', '**/*.md', 'pnpm-lock.yaml'] },
});
