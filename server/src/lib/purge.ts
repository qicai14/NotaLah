import { purgeOldRateLimits } from '../features/auth/rateLimit';
import { purgeFeedSnapshots } from '../features/feed/repository';
import { purgeOldNotifications } from '../features/notifications/repository';
import { purgeOldInteractions } from '../features/ranking/repository';

/** The one purge set (D34, D40, D51): old interactions, expired feed snapshots, ended rate-limit windows and old notifications. Run by the daily job and `db:purge-interactions`. */
export const purgeAll = async () => {
  const [interactions, snapshots, limits, notifications] = await Promise.all([
    purgeOldInteractions(),
    purgeFeedSnapshots(),
    purgeOldRateLimits(),
    purgeOldNotifications(),
  ]);
  return { interactions, snapshots, limits, notifications };
};
