import { useCallback, useRef, useState } from 'react';
import { errorText } from './api';

/**
 * Pending and error state for one write (like, post, log in). `run` ignores calls while one is in flight, clears the
 * last error, and resolves to the result, or undefined when it failed. `onError` may map an error to a message, or
 * return null when it handled the error itself (field errors).
 */
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const run = useCallback(
    async <T>(fn: () => Promise<T>, onError?: (e: unknown) => string | null): Promise<T | undefined> => {
      if (busy.current) return undefined;
      busy.current = true;
      setPending(true);
      setError(null);
      try {
        return await fn();
      } catch (e) {
        setError(onError ? onError(e) : errorText(e));
        return undefined;
      } finally {
        busy.current = false;
        setPending(false);
      }
    },
    [],
  );

  return { run, pending, error, setError };
}
