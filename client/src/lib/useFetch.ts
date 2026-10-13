import { useCallback, useEffect, useState } from 'react';
import { api, errorText } from './api';

interface State<T> {
  path: string | null;
  data: T | null;
  error: string | null;
}

/** GET `path` (null = skip). `reload` refetches without clearing the data already shown; a new path starts loading afresh. */
export function useFetch<T>(path: string | null) {
  // Results are tagged with their path, so data and loading never describe a previous path.
  const [state, setState] = useState<State<T>>({ path: null, data: null, error: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (path === null) return;
    let live = true;
    api<T>(path)
      .then((data) => live && setState({ path, data, error: null }))
      .catch((e) => live && setState((s) => ({ path, data: s.path === path ? s.data : null, error: errorText(e) })));
    return () => {
      live = false;
    };
  }, [path, tick]);

  const current = state.path === path;
  const setData = useCallback(
    (fn: (d: T | null) => T | null) => setState((s) => ({ ...s, data: fn(s.data) })),
    [],
  );
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data: current ? state.data : null, setData, error: current ? state.error : null, loading: path !== null && !current, reload };
}
