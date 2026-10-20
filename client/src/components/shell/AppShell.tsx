import { Bell, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useAuth } from '@/features/auth/AuthContext';
import { useNotificationUnread } from '@/features/notifications/NotificationsContext';
import { cn } from '@/lib/utils';
import { BottomTabs } from './BottomTabs';
import { LeftRail } from './LeftRail';
import { MoreMenu } from './MoreMenu';

/** Screens that draw edge to edge and bring their own phone header (the feed, a note, messages). */
const isFullBleed = (pathname: string) =>
  pathname === '/' || /^\/notes\/\d+$/.test(pathname) || pathname === '/messages' || pathname.startsWith('/messages/');

function MobileTopBar() {
  const { user } = useAuth();
  const unread = useNotificationUnread();
  return (
    <header className="sticky top-0 z-30 flex h-topbar items-center justify-between border-b bg-background/92 px-2 backdrop-blur-xl md:hidden">
      <MoreMenu variant="icon" />
      <Logo />
      {user ? (
        <Button asChild variant="ghost" size="icon" className="relative">
          <Link to="/notifications" aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
            <Bell aria-hidden="true" className="size-5" />
            {unread > 0 && (
              <span
                aria-hidden="true"
                className="absolute top-0.5 right-0 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.625rem] font-bold text-primary-foreground tabular-nums"
              >
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </Link>
        </Button>
      ) : (
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon">
            <Link to="/search" aria-label="Search">
              <Search aria-hidden="true" className="size-5" />
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/login">Log in</Link>
          </Button>
        </div>
      )}
    </header>
  );
}

/** App frame: left rail on desktop, tab bar on phones, and a padded column for ordinary pages. */
export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const bleed = isFullBleed(pathname);

  return (
    <TooltipProvider delayDuration={300}>
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-primary px-4 py-2 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <div className="flex min-h-dvh bg-background text-foreground">
        <LeftRail />
        <div className="flex min-w-0 flex-1 flex-col">
          {!bleed && <MobileTopBar />}
          <main
            id="main"
            tabIndex={-1}
            className={cn(
              'min-w-0 flex-1 outline-none',
              !bleed && 'mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10',
              !bleed && user && 'pb-[calc(var(--spacing-tabbar)+2rem)]',
            )}
          >
            {children}
          </main>
        </div>
      </div>
      {user && <BottomTabs />}
    </TooltipProvider>
  );
}
