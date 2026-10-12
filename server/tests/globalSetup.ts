import { execSync } from 'node:child_process';
import path from 'node:path';

// Brings parp_test up to date; dbmate skips already-applied migrations, so this is idempotent.
export default function setup() {
  execSync('npm run db:migrate:test', { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
}
