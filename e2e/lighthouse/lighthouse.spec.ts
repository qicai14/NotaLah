import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { test } from '@playwright/test';

// Lighthouse accessibility pass over the UAT pages, against the stack this config started. `vp run test:lighthouse`.
test('Lighthouse accessibility scores for the UAT pages', () => {
  execFileSync(process.execPath, [path.resolve(__dirname, '../../scripts/lighthouse-evidence.mjs')], {
    stdio: 'inherit',
  });
});
