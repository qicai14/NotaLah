import { pool } from '../lib/pool';
import { purgeOldInteractions } from '../features/ranking/repository';

purgeOldInteractions()
  .then((n) => console.log(`Purged ${n} interactions`))
  .catch((err: Error) => {
    console.error(`db:purge-interactions failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
