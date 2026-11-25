export type GuestAction = 'like' | 'save' | 'comment' | 'report' | 'follow' | 'message' | 'collaborate' | 'annotate';

export interface Ask {
  action: GuestAction;
  /** Where to land after logging in; defaults to the current page. */
  returnTo?: string;
}
