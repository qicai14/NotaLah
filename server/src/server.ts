import { app } from './app';
import { attachSocket } from './features/messaging/socket';
import { RANKING, assertWeightsSumToOne } from './features/ranking/config';
import { env } from './lib/env';
import { initErrorReporting } from './lib/errorReporting';
import { logger } from './lib/logger';
import { pool } from './lib/pool';
import { purgeAll } from './lib/purge';

const SHUTDOWN_TIMEOUT_MS = 10_000;
const DAY_MS = 24 * 60 * 60 * 1000;

assertWeightsSumToOne();
assertWeightsSumToOne(RANKING.searchWeights);
void initErrorReporting().catch((err) => logger.error({ err }, 'error reporting failed to start'));
const server = app.listen(env.PORT, () => logger.info({ port: env.PORT }, 'server listening'));
const io = attachSocket(server);

const purge = () =>
  purgeAll().then(
    (counts) => logger.info(counts, 'daily purge done'),
    (err) => logger.error({ err }, 'daily purge failed'),
  );
// Fallback only: Render free sleeps after 15 idle minutes, so this timer is best-effort there; the GitHub purge workflow
// is the dependable daily run (R37, D65).
let purgeInterval: NodeJS.Timeout | undefined;
const purgeStart = setTimeout(() => {
  void purge();
  purgeInterval = setInterval(purge, DAY_MS).unref();
}, 60_000).unref();

// Render sends SIGTERM on deploy (D65): drain in-flight requests, close the pool, exit 0; a second signal or the timeout exits 1.
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
  // io.close() disconnects every socket (open ones would keep the server from draining), then closes the HTTP server (D41).
  void io.close(() => {
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
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
