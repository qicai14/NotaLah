import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['tests/globalSetup.ts'],
    // Tests share one database, so files must not run in parallel.
    fileParallelism: false,
  },
});
