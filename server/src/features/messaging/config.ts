/** Messaging settings (FR6, FR7, FR13, D50). Not ranking constants, so they live with the feature. */
export const MESSAGING = Object.freeze({
  /** Longest message or held request text, in characters (the column is VARCHAR(2000)). */
  bodyMax: 2000,
  /** Longest group name (the column is VARCHAR(80)). */
  groupNameMax: 80,
  /** A group holds at most this many members, the creator included; a new group needs at least two other members. */
  groupMax: 30,
  groupMinOthers: 2,
  /** History page size; conversation and request inbox page size. */
  historyPage: 50,
  listPage: 20,
  /** A socket's typing events for one conversation are relayed at most once per this window; the rest are dropped. */
  typingThrottleMs: 2000,
});
