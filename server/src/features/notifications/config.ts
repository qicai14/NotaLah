import type { NotificationType } from './repository';

/** Notification settings (R8, D51). Not ranking constants, so they live with the feature. */
export const NOTIFICATIONS = Object.freeze({
  /** Notifications older than this are deleted by the daily purge, read or not (D47: kept 30 days). */
  retentionDays: 30,
  /**
   * Per type: a notification identical to one the recipient got within this many minutes (same type, actor and targets)
   * is not repeated, e.g. an unfollow and re-follow, or a Super Like withdrawn and given again; the 1-minute window on
   * edits covers two saves racing past `voidedVerifiers`. Other types point at a new comment or request each time.
   */
  dedupeWindowMinutes: Object.freeze<Partial<Record<NotificationType, number>>>({ follow: 60, super_like: 60, edited_since_verification: 1 }),
  mentionMax: 10,
  listPage: 20,
  markReadMax: 100,
});
