import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Guards truncateAll against ever pointing at the dev DB when the shell sets NODE_ENV.
    env: { NODE_ENV: 'test' },
    globalSetup: ['tests/globalSetup.ts'],
    // Tests share one database, so files must not run in parallel.
    fileParallelism: false,
  },
});
