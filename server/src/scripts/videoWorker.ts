import { startVideoWorker } from '../features/assets/worker';
import { logger } from '../lib/logger';
import { pool } from '../lib/pool';

// The video worker as its own service (R40, D67): same code as the in-process loop, for a deploy that sets VIDEO_WORKER_IN_PROCESS=false on the API.
const worker = startVideoWorker();

let stopping = false;
function stop(signal: string): void {
  if (stopping) process.exit(1);
  stopping = true;
  logger.info({ signal }, 'video worker stopping after the job in flight');
  void worker
    .stop()
    .then(() => pool.end())
    .then(
      () => process.exit(0),
      (err: unknown) => {
        logger.error({ err }, 'video worker shutdown failed');
        process.exit(1);
      },
    );
}
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));
