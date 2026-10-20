import { useCallback, useSyncExternalStore } from 'react';

/**
 * The one thing allowed to make sound right now, app-wide (R29; R9 background audio claims it with its own id).
 * A source claims it when the reader turns its sound on and releases it when it stops; claiming takes it from
 * whoever held it, which then sees `active` turn false and mutes itself.
 */
let current: string | null = null;
const listeners = new Set<() => void>();
const set = (id: string | null) => {
  current = id;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useActiveSound(id: string) {
  const active = useSyncExternalStore(
    subscribe,
    () => current === id,
    () => false,
  );
  const claim = useCallback(() => set(id), [id]);
  const release = useCallback(() => {
    if (current === id) set(null);
  }, [id]);
  return { active, claim, release };
}
