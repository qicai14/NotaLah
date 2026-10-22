import { createContext, lazy, type ReactNode, Suspense, useCallback, useContext, useState } from 'react';
import type { GuestAction } from './GuestPromptSheet';

export interface Ask {
  action: GuestAction;
  /** Where to land after logging in; defaults to the current page. */
  returnTo?: string;
}

// Off the entry chunk (D81): most visits never open it, and it is the only eager user of the dialog and sheet.
const GuestPromptSheet = lazy(() => import('./GuestPromptSheet'));

const GuestPromptContext = createContext<(ask: Ask) => void>(() => {});

/** For guests (R31): an action that needs an account calls this to open the Log in / Register sheet. */
export const useGuestPrompt = () => useContext(GuestPromptContext);

/** Holds the R31 sheet. The last ask is kept after closing, so the closing animation keeps its title. */
export function GuestPromptProvider({ children }: { children: ReactNode }) {
  const [ask, setAsk] = useState<Ask | null>(null);
  const [open, setOpen] = useState(false);
  const show = useCallback((next: Ask) => {
    setAsk(next);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  return (
    <GuestPromptContext.Provider value={show}>
      {children}
      {ask && (
        <Suspense fallback={null}>
          <GuestPromptSheet ask={ask} open={open} onClose={close} />
        </Suspense>
      )}
    </GuestPromptContext.Provider>
  );
}
