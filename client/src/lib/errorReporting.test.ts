import { expect, it, vi } from 'vite-plus/test';
import { initErrorReporting, scrubShareTokens } from './errorReporting';

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
  expect(opts.beforeBreadcrumb({ data: { url: '/share/AbC_-1?x=1' } })).toEqual({ data: { url: '/share/:token?x=1' } });
});

it('OPS-TC10: client events and breadcrumbs never carry a share-link token', () => {
  const event = {
    request: { url: 'https://notalah.pages.dev/share/AbC_-123#s2' },
    breadcrumbs: [{ data: { url: '/api/share/XyZ-9/assets/1' } }, { message: 'nav to /share/Q7w\\"x' }],
  };
  expect(JSON.stringify(scrubShareTokens(event))).not.toMatch(/AbC_-123|XyZ-9|Q7w/);
  expect(scrubShareTokens(event).request.url).toBe('https://notalah.pages.dev/share/:token#s2');
  expect(scrubShareTokens(event).breadcrumbs[0].data?.url).toBe('/api/share/:token/assets/1');
});
