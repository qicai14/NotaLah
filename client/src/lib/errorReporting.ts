/** Share-link tokens grant access (D46), so none leaves in an event or breadcrumb (D77). */
export const scrubShareTokens = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value).replace(/\/share\/[^/?#"\\\s]+/g, '/share/:token'));

/** Loads @sentry/browser only when VITE_SENTRY_DSN was set at build time; otherwise nothing is fetched or sent (R18). */
export async function initErrorReporting(dsn: string | undefined = import.meta.env.VITE_SENTRY_DSN): Promise<void> {
  if (!dsn) return;
  const sentry = await import('@sentry/browser');
  sentry.init({
    dsn,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    },
    beforeSend: (event) => scrubShareTokens(event),
    beforeBreadcrumb: (breadcrumb) => scrubShareTokens(breadcrumb),
  });
}
