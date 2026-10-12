import { app } from './app';
import { assertWeightsSumToOne } from './config/ranking';
import { env } from './config/env';

assertWeightsSumToOne();
app.listen(env.PORT, () => console.log(`PARP server listening on :${env.PORT}`));
