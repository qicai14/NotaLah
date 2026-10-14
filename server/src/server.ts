import { app } from './app';
import { assertWeightsSumToOne } from './features/ranking/config';
import { purgeOldRateLimits } from './features/auth/rateLimit';
import { purgeFeedSnapshots } from './features/feed/repository';
import { purgeOldInteractions } from './features/ranking/repository';
import { env } from './lib/env';
import { initErrorReporting } from './lib/errorReporting';
import { logger } from './lib/logger';
import { pool } from './lib/pool';

const SHUTDOWN_TIMEOUT_MS = 10_000;
const DAY_MS = 24 * 60 * 60 * 1000;

assertWeightsSumToOne();
void initErrorReporting().catch((err) => logger.error({ err }, 'error reporting failed to start'));
const server = app.listen(env.PORT, () => logger.info({ port: env.PORT }, 'server listening'));

const purge = () =>
  Promise.all([purgeOldInteractions(), purgeFeedSnapshots(), purgeOldRateLimits()]).then(
    ([interactions, snapshots, limits]) => logger.info({ interactions, snapshots, limits }, 'daily purge done'),
    (err) => logger.error({ err }, 'daily purge failed'),
  );
let purgeInterval: NodeJS.Timeout | undefined;
const purgeStart = setTimeout(() => {
  void purge();
  purgeInterval = setInterval(purge, DAY_MS).unref();
}, 60_000).unref();

// Fly sends SIGINT/SIGTERM on deploy: drain in-flight requests, close the pool, exit 0; a second signal or the timeout exits 1.
let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) {
    logger.warn({ signal }, 'second signal, forcing exit');
    process.exit(1);
  }
  shuttingDown = true;
  logger.info({ signal }, 'shutting down: no longer accepting connections');
  clearTimeout(purgeStart);
  clearInterval(purgeInterval);
  setTimeout(() => {
    logger.error({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();
  server.close(() => {
    logger.info('in-flight requests drained, closing database pool');
    pool.end().then(
      () => {
        logger.info('shutdown complete');
        process.exit(0);
      },
      (err) => {
        logger.error({ err }, 'pool close failed');
        process.exit(1);
      },
    );
  });
  server.closeIdleConnections();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
