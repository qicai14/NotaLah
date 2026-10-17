import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorText } from './api';
import { useAction } from './useAction';

interface First<T> {
  items: T[];
  next: string | null;
}

/**
 * A keyset list (D40): the first page loads from `path` (or comes in `initial`, already embedded elsewhere), `loadMore`
 * appends the next one. `key` names the array in each response; the cursor is `nextCursor`. `remove` drops rows locally.
 */
export function usePaged<T>(path: string, key: string, initial?: First<T>) {
  const [list, setList] = useState<First<T>>(initial ?? { items: [], next: null });
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const more = useAction();
  const seeded = useRef(initial !== undefined);

  useEffect(() => {
    if (seeded.current) {
      seeded.current = false;
      return;
    }
    let live = true;
    setLoading(true);
    setError(null);
    api<Record<string, unknown>>(path)
      .then((r) => live && setList({ items: r[key] as T[], next: (r.nextCursor as string | null) ?? null }))
      .catch((e) => live && setError(errorText(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [path, key]);

  const loadMore = useCallback(
    () =>
      more.run(async () => {
        if (!list.next) return;
        const r = await api<Record<string, unknown>>(`${path}?cursor=${list.next}`);
        setList((l) => ({ items: [...l.items, ...(r[key] as T[])], next: (r.nextCursor as string | null) ?? null }));
      }),
    // run is stable; list.next changes each page
    [more.run, path, key, list.next],
  );

  const remove = useCallback(
    (drop: (item: T) => boolean) => setList((l) => ({ ...l, items: l.items.filter((i) => !drop(i)) })),
    [],
  );

  return {
    items: list.items,
    hasMore: list.next !== null,
    loading,
    loadingMore: more.pending,
    error: error ?? more.error,
    loadMore,
    remove,
  };
}
