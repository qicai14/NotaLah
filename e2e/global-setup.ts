import { execSync } from 'node:child_process';
import { E2E_ENV } from './playwright.config';

// Every run starts from the migrated, freshly reseeded test database (the specs mutate notes, reports and users).
export default function globalSetup() {
  const opts = { stdio: 'inherit', env: { ...process.env, ...E2E_ENV } } as const;
  execSync('vp run server#db:migrate', opts);
  execSync('vp run server#uat:reset', opts);
}
