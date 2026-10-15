import { env } from './env';
import { logger } from './logger';

type Sentry = typeof import('@sentry/node');
let sentry: Sentry | undefined;

/** Loads @sentry/node only when SENTRY_DSN is set; otherwise nothing is imported and nothing leaves the process. */
export async function initErrorReporting(): Promise<void> {
  if (!env.SENTRY_DSN) return;
  const s = await import('@sentry/node');
  s.init({
    dsn: env.SENTRY_DSN,
    sendDefaultPii: false,
    beforeSend(event) {
      delete event.request;
      return event;
    },
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
