// The server cuts a socket 50 minutes into its token hour (ADR 0088); a tab idle that long stops renewing itself (#93, #96).
export const IDLE_LIMIT_MS = 50 * 60_000;
// Focus and visibility are not activity: a visible but unattended tab must not renew.
const ACTIVITY = ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const;

let lastActive = 0;
const subscribers = new Set<() => void>();
const active = () => {
  lastActive = Date.now();
  for (const fn of subscribers) fn();
};

/**
 * Tracks pointer and key activity in this tab while anyone subscribes; `fn` runs on each activity. The first subscriber
 * counts as activity (the tab was just used to open the view), and the window listeners go once the last one leaves.
 */
export function onActivity(fn: () => void = () => {}): () => void {
  if (!subscribers.size) {
    lastActive = Date.now();
    for (const e of ACTIVITY) window.addEventListener(e, active, { passive: true });
  }
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
    if (!subscribers.size) for (const e of ACTIVITY) window.removeEventListener(e, active);
  };
}

/** No pointer or key activity for the idle limit since tracking began. */
export const isIdle = () => Date.now() - lastActive >= IDLE_LIMIT_MS;
