import { purgeOldRateLimits } from '../features/auth/rateLimit';
import { purgeFeedSnapshots } from '../features/feed/repository';
import { purgeOldInteractions } from '../features/ranking/repository';

/** The one purge set (D34, D40): old interactions, expired feed snapshots and ended rate-limit windows. Run by the daily job and `db:purge-interactions`. */
export const purgeAll = async () => {
  const [interactions, snapshots, limits] = await Promise.all([purgeOldInteractions(), purgeFeedSnapshots(), purgeOldRateLimits()]);
  return { interactions, snapshots, limits };
};
