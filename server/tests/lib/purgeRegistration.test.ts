import { afterAll, expect, it } from 'vite-plus/test';
import { PgStore } from '../../src/features/auth/rateLimit';
import { pool } from '../../src/lib/pool';
import { purgeAll } from '../../src/lib/purge';

afterAll(() => pool.end());

it('DEP-TC12: purgeAll alone registers every limiter window, so no prefix is purged on the default window', async () => {
  await purgeAll();
  expect([...PgStore.windows.keys()].sort()).toEqual([
    'auth:',
    'file:',
    'guest:',
    'login:',
    'music:',
    'musicday:',
    'unsplash:',
    'upload:',
    'video:',
    'write:',
  ]);
  expect(PgStore.windows.get('upload:')).toBe(60 * 60_000);
});
