import { env } from './env';
import { logger } from './logger';

/** Share-link tokens grant access (D46), so none leaves in an event or breadcrumb (D77). */
export const scrubShareTokens = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value).replace(/\/share\/[^/?#"\\\s]+/g, '/share/:token'));

type Sentry = typeof import('@sentry/node');
let sentry: Sentry | undefined;

/** Loads @sentry/node only when SENTRY_DSN is set; otherwise nothing is imported and nothing leaves the process. */
export async function initErrorReporting(): Promise<void> {
  if (!env.SENTRY_DSN) return;
  const s = await import('@sentry/node');
  s.init({
    dsn: env.SENTRY_DSN,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    },
    beforeSend(event) {
      delete event.request;
      return scrubShareTokens(event);
    },
    beforeBreadcrumb: (breadcrumb) => scrubShareTokens(breadcrumb),
  });
  sentry = s;
  logger.info('error reporting enabled');
}

export function reportError(err: unknown, ctx: { requestId?: string } = {}): void {
  sentry?.withScope((scope) => {
    if (ctx.requestId) scope.setTag('request_id', ctx.requestId);
    sentry?.captureException(err);
  });
}
