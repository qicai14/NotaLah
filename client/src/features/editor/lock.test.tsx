// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { afterLockWon, LOCK_RENEW_MS, LOCK_RETRY_MS, useEditLock } from './lock';
import { emptyDeck, useEditor } from './store';
import { LockedNotice } from './LockedNotice';

type Reply = { status: number; body?: unknown };
let calls: string[];
let reply: () => Reply;

beforeEach(() => {
  calls = [];
  vi.useFakeTimers();
  vi.stubEnv('VITE_API_URL', '');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      const { status, body } = init?.method === 'DELETE' ? { status: 204 } : reply();
      return { status, ok: status < 400, headers: new Headers(), json: () => Promise.resolve(body ?? {}) };
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const flush = () => act(async () => {});

describe('editor soft lock', () => {
  it('NOTE-TC82: takes, renews and releases the lock; waits read-only while another editor holds it', async () => {
    const holder = { id: 9, displayName: 'Aina Rahman' };
    reply = () => ({ status: 423, body: { error: 'Another collaborator is editing this note', lockedBy: holder } });
    const onAcquired = vi.fn();
    const { result, unmount } = renderHook(() => useEditLock(5, onAcquired));
    await flush();
    expect(result.current.state).toMatchObject({ kind: 'locked', holder });
    reply = () => ({ status: 200, body: { expiresAt: new Date().toISOString() } });
    await act(async () => vi.advanceTimersByTime(LOCK_RETRY_MS));
    expect(result.current.state).toEqual({ kind: 'held' });
    expect(onAcquired).toHaveBeenCalledTimes(1); // won after a wait: the caller reloads the note
    await act(async () => vi.advanceTimersByTime(LOCK_RENEW_MS));
    expect(calls.filter((c) => c === 'POST /api/notes/5/lock')).toHaveLength(3);
    expect(onAcquired).toHaveBeenCalledTimes(1); // renewals do not reload
    unmount();
    expect(calls.at(-1)).toBe('DELETE /api/notes/5/lock');
  });

  it('NOTE-TC82: a new note takes no lock, and the notice names the holder with Try again', async () => {
    reply = () => ({ status: 200 });
    renderHook(() => useEditLock(null, () => {}));
    await flush();
    expect(calls).toEqual([]);
    const retry = vi.fn();
    render(<LockedNotice holder={{ id: 9, displayName: 'Aina Rahman' }} owner onRetry={retry} />);
    expect(screen.getByText('Aina Rahman is editing')).toBeTruthy();
    expect(screen.getByText(/publish the last saved version/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
  });

  it('NOTE-TC86: winning the lock back keeps unsaved edits, and only the last of two runs releases', async () => {
    useEditor.getState().load(emptyDeck());
    const reload = vi.fn();
    afterLockWon(reload);
    expect(reload).toHaveBeenCalledTimes(1); // nothing unsaved: load what the other editor saved
    useEditor.getState().setMeta({ title: 'typed while waiting' });
    afterLockWon(reload);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(useEditor.getState().saveState).toBe('conflict'); // Reload or Keep mine, never a silent wipe

    reply = () => ({ status: 200, body: {} });
    const a = renderHook(() => useEditLock(6, () => {}));
    const b = renderHook(() => useEditLock(6, () => {}));
    await flush();
    a.unmount();
    expect(calls.filter((c) => c.startsWith('DELETE'))).toEqual([]); // the other run still holds it
    b.unmount();
    expect(calls.filter((c) => c.startsWith('DELETE'))).toEqual(['DELETE /api/notes/6/lock']);
  });
});
