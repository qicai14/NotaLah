import { Bookmark, Flag, Heart, type LucideIcon, MessageCircle, UserPlus, Users } from 'lucide-react';
import { createContext, type ReactNode, useCallback, useContext, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { DESKTOP, useMediaQuery } from '@/hooks/useMediaQuery';

export type GuestAction = 'like' | 'save' | 'comment' | 'report' | 'follow' | 'message' | 'collaborate';

const COPY: Record<GuestAction, { title: string; icon: LucideIcon }> = {
  like: { title: 'Log in to like this note', icon: Heart },
  save: { title: 'Log in to save this note', icon: Bookmark },
  comment: { title: 'Log in to join the discussion', icon: MessageCircle },
  report: { title: 'Log in to report this note', icon: Flag },
  follow: { title: 'Log in to follow people', icon: UserPlus },
  message: { title: 'Log in to send a message', icon: MessageCircle },
  collaborate: { title: 'Log in to ask to collaborate', icon: Users },
};

interface Ask {
  action: GuestAction;
  /** Where to land after logging in; defaults to the current page. */
  returnTo?: string;
}

const GuestPromptContext = createContext<(ask: Ask) => void>(() => {});

/** For guests (R31): an action that needs an account calls this to open the Log in / Register sheet. */
export const useGuestPrompt = () => useContext(GuestPromptContext);

/** Holds the R31 sheet: a bottom sheet on phones (wireframe 06), a small dialog on desktop. */
export function GuestPromptProvider({ children }: { children: ReactNode }) {
  const [ask, setAsk] = useState<Ask | null>(null);
  const [lastAction, setLastAction] = useState<GuestAction>('like');
  const desktop = useMediaQuery(DESKTOP);
  const navigate = useNavigate();
  const location = useLocation();

  const open = useCallback((next: Ask) => {
    setLastAction(next.action);
    setAsk(next);
  }, []);
  const go = (to: '/login' | '/register') => {
    const from = ask?.returnTo ?? `${location.pathname}${location.search}`;
    setAsk(null);
    void navigate(to, { state: { from } });
  };

  const { title, icon: Icon } = COPY[ask?.action ?? lastAction];
  const icon = (
    <span
      className="mx-auto grid size-16 place-items-center rounded-full bg-surface text-foreground"
      aria-hidden="true"
    >
      <Icon className="size-7" />
    </span>
  );
  const actions = (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-2.5 pt-5">
      <Button size="lg" onClick={() => go('/login')}>
        Log in
      </Button>
      <Button size="lg" variant="outline" onClick={() => go('/register')}>
        Register
      </Button>
      <Button size="lg" variant="ghost" onClick={() => setAsk(null)}>
        Not now
      </Button>
    </div>
  );
  const description = 'Guests can read public notes and comments. An APU account lets you like, save and comment.';
  const onOpenChange = (o: boolean) => !o && setAsk(null);

  return (
    <GuestPromptContext.Provider value={open}>
      {children}
      {desktop ? (
        <Dialog open={ask !== null} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-sm gap-0 p-7 pt-9 text-center">
            {icon}
            <DialogTitle className="mt-5 text-center text-title font-bold">{title}</DialogTitle>
            <DialogDescription className="mt-2 text-center text-body text-muted-foreground">
              {description}
            </DialogDescription>
            {actions}
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet open={ask !== null} onOpenChange={onOpenChange}>
          <SheetContent
            side="bottom"
            className="gap-0 rounded-t-2xl border-t-0 px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center"
          >
            <span aria-hidden="true" className="mx-auto mb-6 h-1.5 w-10 rounded-full bg-surface-strong" />
            {icon}
            <SheetTitle className="mt-5 text-title font-bold">{title}</SheetTitle>
            <SheetDescription className="mx-auto mt-2 max-w-xs text-body text-muted-foreground">
              {description}
            </SheetDescription>
            {actions}
          </SheetContent>
        </Sheet>
      )}
    </GuestPromptContext.Provider>
  );
}
