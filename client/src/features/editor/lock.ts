import { useEffect, useRef, useState } from 'react';
import { isIdle, onActivity } from '@/lib/activity';
import { api, apiOrigin, ApiError } from '@/lib/api';
import { useEditor } from './store';

/** The server's lock lasts 120 s (D46); renew well inside it so a slow network never lets it lapse. */
export const LOCK_RENEW_MS = 45_000;
/** While someone else holds the lock, ask again this often; an expired lock is taken over on the next try. */
export const LOCK_RETRY_MS = 20_000;

export interface LockHolder {
  id: number;
  displayName: string;
}

type LockState =
  | { kind: 'none' }
  | { kind: 'held' }
  | { kind: 'locked'; holder: LockHolder; checkedAt: number }
  | { kind: 'error' };

/**
 * Lock runs alive per note in this tab. React's StrictMode, a retry and the remount after a note's first save all start
 * a new run before or after the old one stops; only the last run to stop releases, so none frees a lock another still uses.
 */
const live = new Map<number, number>();
const start = (id: number) => live.set(id, (live.get(id) ?? 0) + 1);
/** Ends one run; true when it was the last for that note. */
const stop = (id: number) => {
  const n = (live.get(id) ?? 1) - 1;
  if (n > 0) live.set(id, n);
  else live.delete(id);
  return n <= 0;
};

/**
 * After waiting for the lock: reload the note to start from what the other editor saved, unless this editor somehow
 * has unsaved changes, which a reload would wipe; those go to the conflict banner (Reload or Keep mine) instead.
 */
export function afterLockWon(reload: () => void): void {
  const st = useEditor.getState();
  if (st.dirty) st.setSaveState('conflict');
  else reload();
}

/** Frees the lock even while the page unloads (keepalive), so the next editor need not wait for the TTL. */
function release(noteId: number) {
  void fetch(`${apiOrigin()}/api/notes/${noteId}/lock`, {
    method: 'DELETE',
    headers: { 'X-Requested-With': 'notalah' },
    credentials: 'include',
    keepalive: true,
  }).catch(() => {});
}

/**
 * Holds the note's soft edit lock (R30, D46) while the editor is open: takes it on open, renews it, releases it on
 * leave, skipping renewals and retries while the tab is idle. When another editor holds it the editor turns read-only
 * and retries in the background; `onAcquired` runs when the lock is won after a wait, so the caller can load what the
 * other editor saved. `retry` asks at once.
 */
export function useEditLock(noteId: number | null, onAcquired: () => void) {
  const [state, setState] = useState<LockState>({ kind: 'none' });
  const [attempt, setAttempt] = useState(0);
  const acquired = useRef(onAcquired);
  acquired.current = onAcquired;
  /** Someone else held the lock since this editor opened, so what is on screen may be out of date. */
  const waited = useRef(false);

  useEffect(() => {
    if (!noteId) return;
    start(noteId);
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let held = false;
    const untrack = onActivity();
    const later = (ms: number) => {
      timer = setTimeout(() => (isIdle() ? later(ms) : void take()), ms);
    };
    const take = async () => {
      try {
        await api(`/notes/${noteId}/lock`, { method: 'POST' });
        if (!alive) {
          if (!live.has(noteId)) release(noteId); // closed while the request was out, and no other run needs it
          return;
        }
        held = true;
        if (waited.current) {
          waited.current = false;
          acquired.current();
        }
        setState({ kind: 'held' });
        later(LOCK_RENEW_MS);
      } catch (e) {
        if (!alive) return;
        held = false;
        if (e instanceof ApiError && e.status === 423) {
          const holder = (e.data as { lockedBy?: LockHolder }).lockedBy;
          waited.current = true;
          setState({ kind: 'locked', holder: holder ?? { id: 0, displayName: 'Someone' }, checkedAt: Date.now() });
          later(LOCK_RETRY_MS);
        } else {
          // Network trouble or no edit access: saving reports its own errors, so do not block editing here.
          setState({ kind: 'error' });
          later(LOCK_RETRY_MS);
        }
      }
    };
    void take();
    const onHide = () => held && release(noteId);
    window.addEventListener('pagehide', onHide);
    return () => {
      alive = false;
      clearTimeout(timer);
      untrack();
      window.removeEventListener('pagehide', onHide);
      if (stop(noteId) && held) release(noteId);
    };
  }, [noteId, attempt]);

  return { state, retry: () => setAttempt((n) => n + 1) };
}
