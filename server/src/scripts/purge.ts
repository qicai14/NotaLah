import { pool } from '../lib/pool';
import { purgeAll } from '../lib/purge';

purgeAll()
  .then(({ interactions, snapshots, limits, notifications, assets }) =>
    console.log(
      `Purged ${interactions} interactions, ${snapshots} feed snapshots, ${limits} rate-limit rows, ${notifications} notifications, ${assets} unlinked assets`,
    ),
  )
  .catch((err: Error) => {
    console.error(`db:purge failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
