// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useFetch } from './useFetch';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useFetch', () => {
  it('CLI-TC14: a stale response after the path changes is ignored', async () => {
    const pending: Record<string, (v: unknown) => void> = {};
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => new Promise((resolve) => (pending[url] = resolve))),
    );
    const reply = (url: string, body: unknown) =>
      act(async () =>
        pending[url]({ status: 200, ok: true, headers: new Headers(), json: () => Promise.resolve(body) }),
      );

    const { result, rerender } = renderHook(({ p }) => useFetch<{ n: string }>(p), { initialProps: { p: '/a' } });
    expect(result.current.loading).toBe(true);
    rerender({ p: '/b' });
    await reply('/api/a', { n: 'old' });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
    await reply('/api/b', { n: 'new' });
    await waitFor(() => expect(result.current.data).toEqual({ n: 'new' }));
    expect(result.current.loading).toBe(false);
  });

  it('CLI-TC14: a late response for the old path cannot overwrite the new data', async () => {
    const pending: Record<string, (v: unknown) => void> = {};
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => new Promise((resolve) => (pending[url] = resolve))),
    );
    const reply = (url: string, body: unknown) =>
      act(async () =>
        pending[url]({ status: 200, ok: true, headers: new Headers(), json: () => Promise.resolve(body) }),
      );

    const { result, rerender } = renderHook(({ p }) => useFetch<{ n: string }>(p), { initialProps: { p: '/a' } });
    rerender({ p: '/b' });
    await reply('/api/b', { n: 'new' });
    await waitFor(() => expect(result.current.data).toEqual({ n: 'new' }));
    await reply('/api/a', { n: 'old' });
    expect(result.current.data).toEqual({ n: 'new' });
    expect(result.current.loading).toBe(false);
  });
});
