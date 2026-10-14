import { app } from './app';
import { assertWeightsSumToOne } from './features/ranking/config';
import { purgeFeedSnapshots } from './features/feed/repository';
import { purgeOldInteractions } from './features/ranking/repository';
import { env } from './lib/env';

assertWeightsSumToOne();
app.listen(env.PORT, () => console.log(`PARP server listening on :${env.PORT}`));

const DAY_MS = 24 * 60 * 60 * 1000;
const purge = () =>
  Promise.all([purgeOldInteractions(), purgeFeedSnapshots()]).then(
    ([interactions, snapshots]) => console.log(`purged ${interactions} old interactions, ${snapshots} feed snapshots`),
    (err) => console.error('daily purge failed', err),
  );
setTimeout(() => {
  void purge();
  setInterval(purge, DAY_MS).unref();
}, 60_000).unref();
