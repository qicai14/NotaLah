import { execSync } from 'node:child_process';
import path from 'node:path';

// Brings notalah_test up to date; dbmate skips already-applied migrations, so this is idempotent.
export default function setup() {
  execSync('pnpm run db:migrate:test', { cwd: path.resolve(import.meta.dirname, '..'), stdio: 'inherit' });
}
