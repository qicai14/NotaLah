// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { emptySearch, type SearchState } from './searchParams';
import { useSearchResults } from './useSearchResults';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const reply = (body: unknown, status = 200) => ({
  status,
  ok: status < 400,
  headers: new Headers(),
  json: () => Promise.resolve(body),
});
const state = (over: Partial<SearchState>): SearchState => ({ ...emptySearch, q: 'sql', tab: 'notes', ...over });

describe('useSearchResults', () => {
  it('CLI-TC26: load more sends the cursor and the asOf from page 1, and never repeats an item', async () => {
    const calls: string[] = [];
    const pages = [
      { items: [{ id: 1 }, { id: 2 }], nextCursor: 'c1', asOf: '2026-10-17T01:00:00.000Z' },
      { items: [{ id: 2 }, { id: 3 }], nextCursor: null, asOf: '2026-10-17T02:00:00.000Z' },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        calls.push(url);
        return Promise.resolve(reply(pages[calls.length - 1]));
      }),
    );
    const { result } = renderHook(() => useSearchResults(state({})));
    await waitFor(() => expect(result.current.results?.loaded).toBe(true));
    expect(calls[0]).toBe('/api/search?q=sql&tab=notes');
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.results?.items).toHaveLength(3));
    expect(calls[1]).toBe('/api/search?q=sql&tab=notes&cursor=c1&asOf=2026-10-17T01%3A00%3A00.000Z');
    expect(result.current.results?.items.map((i) => i.id)).toEqual([1, 2, 3]);
    expect(result.current.results?.next).toBeNull();
  });

  it('CLI-TC27: a new query drops the answer to the old one and a blank query fetches nothing', async () => {
    const pending: Record<string, (v: unknown) => void> = {};
    const fetchMock = vi.fn((url: string) => new Promise((resolve) => (pending[url] = resolve)));
    vi.stubGlobal('fetch', fetchMock);
    const { result, rerender } = renderHook(({ s }) => useSearchResults(s), {
      initialProps: { s: state({ q: 'old' }) },
    });
    rerender({ s: state({ q: 'new' }) });
    await act(async () => pending['/api/search?q=old&tab=notes'](reply({ items: [{ id: 9 }], nextCursor: null })));
    expect(result.current.results?.loaded).toBe(false);
    await act(async () => pending['/api/search?q=new&tab=notes'](reply({ items: [{ id: 1 }], nextCursor: null })));
    await waitFor(() => expect(result.current.results?.items).toEqual([{ id: 1 }]));

    fetchMock.mockClear();
    rerender({ s: state({ q: '  ' }) });
    expect(result.current.results).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('CLI-TC28: a failed page shows the error and Try again fetches that page again', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ error: 'Server error' }, 500))
      .mockResolvedValueOnce(reply({ items: [{ id: 1 }], nextCursor: null, asOf: '2026-10-17T01:00:00.000Z' }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useSearchResults(state({})));
    await waitFor(() => expect(result.current.results?.error).toBe('Server error'));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.results?.items).toEqual([{ id: 1 }]));
    expect(result.current.results?.error).toBeNull();
  });
});
