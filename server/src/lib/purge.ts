import '../features/assets/rateLimit'; // registers the upload, video and file windows with the purge
import '../features/unsplash/rateLimit';
import { purgeUnlinkedAssets } from '../features/assets/service';
import { purgeOldRateLimits } from '../features/auth/rateLimit';
import { purgeFeedSnapshots } from '../features/feed/repository';
import { purgeOldNotifications } from '../features/notifications/repository';
import { purgeOldInteractions } from '../features/ranking/repository';

/** The one purge set (D34, D40, D51): old interactions, expired feed snapshots, ended rate-limit windows, old notifications and unlinked assets (R22). Run by the GitHub purge workflow through `db:purge`, and by the in-process daily timer as a fallback (R37). */
export const purgeAll = async () => {
  const [interactions, snapshots, limits, notifications, { assets, orphanedFiles }] = await Promise.all([
    purgeOldInteractions(),
    purgeFeedSnapshots(),
    purgeOldRateLimits(),
    purgeOldNotifications(),
    purgeUnlinkedAssets(),
  ]);
  return { interactions, snapshots, limits, notifications, assets, orphanedFiles };
};
