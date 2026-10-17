import { useEffect, useRef, useState } from 'react';
import { api, apiOrigin, ApiError } from '@/lib/api';

/** The server's lock lasts 120 s (D46); renew well inside it so a slow network never lets it lapse. */
export const LOCK_RENEW_MS = 45_000;
/** While someone else holds the lock, ask again this often; an expired lock is taken over on the next try. */
export const LOCK_RETRY_MS = 20_000;

export interface LockHolder {
  id: number;
  displayName: string;
}

export type LockState =
  | { kind: 'none' }
  | { kind: 'held' }
  | { kind: 'locked'; holder: LockHolder; checkedAt: number }
  | { kind: 'error' };

/** Frees the lock even while the page unloads (keepalive), so the next editor need not wait for the TTL. */
function release(noteId: number) {
  void fetch(`${apiOrigin()}/api/notes/${noteId}/lock`, {
    method: 'DELETE',
    headers: { 'X-Requested-With': 'parp' },
    credentials: 'include',
    keepalive: true,
  }).catch(() => {});
}

/**
 * Holds the note's soft edit lock (R30, D46) while the editor is open: takes it on open, renews it, releases it on
 * leave. When another editor holds it the editor turns read-only and retries in the background; `onAcquired` runs
 * when the lock is won after a wait, so the caller can load what the other editor saved. `retry` asks at once.
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
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let held = false;
    const take = async () => {
      try {
        await api(`/notes/${noteId}/lock`, { method: 'POST' });
        if (!alive) return release(noteId); // closed while the request was out
        held = true;
        if (waited.current) {
          waited.current = false;
          acquired.current();
        }
        setState({ kind: 'held' });
        timer = setTimeout(take, LOCK_RENEW_MS);
      } catch (e) {
        if (!alive) return;
        held = false;
        if (e instanceof ApiError && e.status === 423) {
          const holder = (e.data as { lockedBy?: LockHolder }).lockedBy;
          waited.current = true;
          setState({ kind: 'locked', holder: holder ?? { id: 0, displayName: 'Someone' }, checkedAt: Date.now() });
          timer = setTimeout(take, LOCK_RETRY_MS);
        } else {
          // Network trouble or no edit access: saving reports its own errors, so do not block editing here.
          setState({ kind: 'error' });
          timer = setTimeout(take, LOCK_RETRY_MS);
        }
      }
    };
    void take();
    const onHide = () => held && release(noteId);
    window.addEventListener('pagehide', onHide);
    return () => {
      alive = false;
      clearTimeout(timer);
      window.removeEventListener('pagehide', onHide);
      if (held) release(noteId);
    };
  }, [noteId, attempt]);

  return { state, retry: () => setAttempt((n) => n + 1) };
}
