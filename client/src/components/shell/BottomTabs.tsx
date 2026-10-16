import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { isActive, TABS } from './nav';

/** Phone tab bar (below 768 px), translucent so the full-screen feed runs under it. */
export function BottomTabs() {
  const { pathname, search } = useLocation();
  return (
    <nav
      aria-label="Main tabs"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="grid h-tabbar grid-cols-5">
        {TABS.map((item) => {
          const active = isActive(item, pathname, search);
          const Icon = item.icon;
          return (
            <li key={item.to} className="grid">
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                aria-label={item.primary ? item.label : undefined}
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
                    <Icon className="size-6" strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />
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
