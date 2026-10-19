import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vite-plus';

const afterShared = [{ task: 'build', from: 'dependencies' as const }];

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
  run: {
    tasks: {
      build: { command: 'vp pack', dependsOn: afterShared },
      // Never cached: the result depends on the Postgres state, so a replay would hide a real failure.
      test: { command: 'vp test run', dependsOn: afterShared, cache: false },
    },
  },
});
