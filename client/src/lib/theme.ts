import { useCallback, useEffect, useSyncExternalStore } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'notalah-theme';
const media = () =>
  typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const listeners = new Set<() => void>();

function read(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

/** Puts `.dark` on <html> for the preference; eases the colour change for one frame unless motion is reduced. */
function apply(pref: ThemePreference) {
  const dark = pref === 'dark' || (pref === 'system' && !!media()?.matches);
  const root = document.documentElement;
  if (root.classList.contains('dark') === dark) return;
  root.classList.add('theme-transition');
  root.classList.toggle('dark', dark);
  window.setTimeout(() => root.classList.remove('theme-transition'), 350);
}

/** Theme preference: 'system' follows prefers-color-scheme; 'light' / 'dark' are stored in localStorage. */
export function useTheme() {
  const pref = useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    read,
    () => 'system' as ThemePreference,
  );

  useEffect(() => {
    apply(pref);
    if (pref !== 'system') return;
    const m = media();
    if (!m) return;
    const onChange = () => apply('system');
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, [pref]);

  const setTheme = useCallback((next: ThemePreference) => {
    try {
      if (next === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // storage blocked: the choice lasts for this page only
    }
    apply(next);
    listeners.forEach((l) => l());
  }, []);

  return { theme: pref, setTheme };
}
