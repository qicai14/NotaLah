import { Link, useLocation } from 'react-router-dom';
import { useUnread } from '@/features/messaging/MessagingContext';
import { cn } from '@/lib/utils';
import { isActive, TABS } from './nav';

/** Phone tab bar (below 768 px), translucent so the full-screen feed runs under it. */
export function BottomTabs() {
  const { pathname, search } = useLocation();
  const unread = useUnread();
  return (
    <nav
      aria-label="Main tabs"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="grid h-tabbar grid-cols-5">
        {TABS.map((item) => {
          const active = isActive(item, pathname, search);
          const Icon = item.icon;
          const count = item.to === '/messages' ? unread : 0;
          return (
            <li key={item.to} className="grid">
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                aria-label={item.primary ? item.label : count ? `${item.label}, ${count} unread` : undefined}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-semibold transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {item.primary ? (
                  <span className="grid h-8 w-12 place-items-center rounded-md bg-primary text-primary-foreground transition-transform active:scale-95">
                    <Icon className="size-5" strokeWidth={2.6} aria-hidden="true" />
                  </span>
                ) : (
                  <>
                    <span className="relative">
                      <Icon className="size-6" strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />
                      {count > 0 && (
                        <span
                          aria-hidden="true"
                          className="absolute -top-1 -right-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[0.625rem] font-bold text-primary-foreground tabular-nums"
                        >
                          {count > 99 ? '99+' : count}
                        </span>
                      )}
                    </span>
                    {item.label}
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
