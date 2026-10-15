import { pool } from '../lib/pool';
import { purgeAll } from '../lib/purge';

purgeAll()
  .then(({ interactions, snapshots, limits }) =>
    console.log(`Purged ${interactions} interactions, ${snapshots} feed snapshots, ${limits} rate-limit rows`))
  .catch((err: Error) => {
    console.error(`db:purge-interactions failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
