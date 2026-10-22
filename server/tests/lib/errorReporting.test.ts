import { expect, it, vi } from 'vite-plus/test';

const sentry = vi.hoisted(() => {
  const scope = { setTag: vi.fn() };
  return {
    scope,
    init: vi.fn(),
    captureException: vi.fn(),
    withScope: vi.fn((cb: (s: typeof scope) => void) => cb(scope)),
  };
});
vi.mock('@sentry/node', () => sentry);
vi.mock('../../src/lib/env', () => ({ env: { SENTRY_DSN: 'https://key@o0.ingest.sentry.io/1' } }));

it('OPS-TC6: error reporting collects no request data, user info or variables and tags the request id', async () => {
  const { initErrorReporting, reportError } = await import('../../src/lib/errorReporting');
  await initErrorReporting();

  const opts = sentry.init.mock.calls[0]![0];
  expect(opts.dataCollection).toEqual({
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    queues: false,
    stackFrameVariables: false,
  });
  expect(opts.tracesSampleRate).toBeUndefined();
  const event = { message: 'boom', request: { url: '/x?token=1', headers: { cookie: 'a=b' }, data: 'body' } };
  expect(opts.beforeSend(event)).not.toHaveProperty('request');
  expect(opts.beforeSend({ message: 'GET /api/share/AbC_-123/assets/1 failed' }).message).toBe(
    'GET /api/share/:token/assets/1 failed',
  );
  expect(opts.beforeBreadcrumb({ data: { url: '/api/share/XyZ-9?x=1' } })).toEqual({
    data: { url: '/api/share/:token?x=1' },
  });

  const err = new Error('boom');
  reportError(err, { requestId: 'req-1' });
  expect(sentry.scope.setTag).toHaveBeenCalledWith('request_id', 'req-1');
  expect(sentry.captureException).toHaveBeenCalledWith(err);
});

it('OPS-TC9: server events and breadcrumbs never carry a share-link token', async () => {
  const { scrubShareTokens } = await import('../../src/lib/errorReporting');
  const event = {
    exception: { values: [{ value: 'no note for /api/share/AbC_-123#x' }] },
    tags: { path: '/share/Q7w' },
  };
  expect(JSON.stringify(scrubShareTokens(event))).not.toMatch(/AbC_-123|Q7w/);
  expect(scrubShareTokens(event).tags.path).toBe('/share/:token');
});
