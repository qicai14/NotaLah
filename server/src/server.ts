import { app } from './app';
import { assertWeightsSumToOne } from './features/ranking/config';
import { purgeOldInteractions } from './features/ranking/repository';
import { env } from './lib/env';

assertWeightsSumToOne();
app.listen(env.PORT, () => console.log(`PARP server listening on :${env.PORT}`));

const DAY_MS = 24 * 60 * 60 * 1000;
const purge = () =>
  purgeOldInteractions().then(
    (n) => n && console.log(`purged ${n} old interactions`),
    (err) => console.error('interaction purge failed', err),
  );
setTimeout(() => {
  void purge();
  setInterval(purge, DAY_MS).unref();
}, 60_000).unref();
