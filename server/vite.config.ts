import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  // Unbundled so dist/ mirrors src/ and env.ts still finds the root .env three levels up.
  pack: { entry: ['src/server.ts'], unbundle: true, format: ['esm'], fixedExtension: false },
  test: {
    // Guards truncateAll against ever pointing at the dev DB when the shell sets NODE_ENV.
    env: { NODE_ENV: 'test', STORAGE_DIR: path.join(os.tmpdir(), 'parp-uploads-test') },
    globalSetup: ['tests/globalSetup.ts'],
    // Tests share one database, so files must not run in parallel.
    fileParallelism: false,
  },
});
