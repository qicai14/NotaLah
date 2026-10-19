import { pool } from '../lib/pool';
import { purgeAll } from '../lib/purge';

purgeAll()
  .then(({ interactions, snapshots, limits, notifications, assets, orphanedFiles }) => {
    console.log(
      `Purged ${interactions} interactions, ${snapshots} feed snapshots, ${limits} rate-limit rows, ${notifications} notifications, ${assets} unlinked assets`,
    );
    if (orphanedFiles > 0) {
      console.error(`db:purge: ${orphanedFiles} asset files could not be removed from storage (keys in the log above)`);
      process.exitCode = 1;
    }
  })
  .catch((err: Error) => {
    console.error(`db:purge failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
