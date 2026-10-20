import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vite-plus';

// One temp dir per run, so parallel runs of the suite never see each other's uploads or video temp files.
const runDir = mkdtempSync(path.join(os.tmpdir(), 'notalah-test-'));

const afterShared = [{ task: 'build', from: 'dependencies' as const }];

export default defineConfig({
  // Unbundled so dist/ mirrors src/ and env.ts still finds the root .env three levels up.
  pack: {
    entry: ['src/server.ts', 'src/scripts/videoWorker.ts'],
    unbundle: true,
    format: ['esm'],
    fixedExtension: false,
  },
  test: {
    // Guards truncateAll against ever pointing at the dev DB when the shell sets NODE_ENV.
    env: {
      NODE_ENV: 'test',
      STORAGE_DIR: path.join(runDir, 'uploads'),
      TMPDIR: runDir,
      TMP: runDir,
      TEMP: runDir,
    },
    globalSetup: ['tests/globalSetup.ts'],
    // Tests share one database, so files must not run in parallel.
    fileParallelism: false,
  },
  run: {
    tasks: {
      build: { command: 'vp pack', dependsOn: afterShared },
      // Never cached: the result depends on the Postgres state, so a replay would hide a real failure.
      test: { command: 'vp test run', dependsOn: afterShared, cache: false },
      // The daily purge (R37); run by .github/workflows/purge.yml against production. Never cached: it changes the database.
      'db:purge': { command: 'tsx src/scripts/purge.ts', cache: false },
      // The video worker as a separate service after a build (R40, D67); the API runs the same loop in-process unless VIDEO_WORKER_IN_PROCESS=false.
      worker: { command: 'node dist/scripts/videoWorker.js', cache: false },
    },
  },
});
