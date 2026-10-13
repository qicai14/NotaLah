import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from './api';

export function errorText(e: unknown): string {
  return e instanceof ApiError ? e.message : 'Could not reach the server. Please try again.';
}

/** GET `path` (null = skip). `reload` refetches without clearing the data already shown. */
export function useFetch<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let live = true;
    api<T>(path)
      .then((d) => live && (setData(d), setError(null)))
      .catch((e) => live && setError(errorText(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, setData, error, loading, reload };
}
