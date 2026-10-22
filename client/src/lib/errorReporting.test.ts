import { expect, it, vi } from 'vite-plus/test';
import { initErrorReporting } from './errorReporting';

const sentry = vi.hoisted(() => ({ init: vi.fn() }));
vi.mock('@sentry/browser', () => sentry);

it('OPS-TC7: client error reporting is off without a DSN and collects no user data with one', async () => {
  await initErrorReporting('');
  expect(sentry.init).not.toHaveBeenCalled();

  await initErrorReporting('https://key@o0.ingest.sentry.io/1');
  const opts = sentry.init.mock.calls[0]![0];
  expect(opts.dsn).toBe('https://key@o0.ingest.sentry.io/1');
  expect(opts.dataCollection).toMatchObject({ userInfo: false, cookies: false, httpHeaders: false, httpBodies: [] });
  expect(opts.tracesSampleRate).toBeUndefined();
});
