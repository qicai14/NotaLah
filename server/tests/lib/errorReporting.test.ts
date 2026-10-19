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

  const err = new Error('boom');
  reportError(err, { requestId: 'req-1' });
  expect(sentry.scope.setTag).toHaveBeenCalledWith('request_id', 'req-1');
  expect(sentry.captureException).toHaveBeenCalledWith(err);
});
