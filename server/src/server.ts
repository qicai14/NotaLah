import { app } from './app';
import { assertWeightsSumToOne } from './features/ranking/config';
import { env } from './lib/env';

assertWeightsSumToOne();
app.listen(env.PORT, () => console.log(`PARP server listening on :${env.PORT}`));
