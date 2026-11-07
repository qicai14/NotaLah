import { join } from 'node:path';

// Screenshots and the timing baseline go to test-results/ (ignored) unless E2E_WRITE_DOCS=1 refreshes the tracked docs/ copies.
const root = join(__dirname, '../..');
const docs = process.env.E2E_WRITE_DOCS === '1';
export const SCREENSHOT_DIR = docs ? join(root, 'docs/screenshots/81') : join(root, 'test-results/screenshots');
export const BASELINE_FILE = docs
  ? join(root, 'docs/testing/e2e-baseline.json')
  : join(root, 'test-results/e2e-baseline.json');
