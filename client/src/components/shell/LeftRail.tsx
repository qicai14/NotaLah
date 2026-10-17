import { PanelLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/features/auth/AuthContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';
import { MoreMenu } from './MoreMenu';
import { ADMIN_RAIL, isActive, type NavItem, RAIL } from './nav';

const KEY = 'notalah-rail';
const readCollapsed = () => {
  try {
    return localStorage.getItem(KEY) === 'collapsed';
  } catch {
    return false;
  }
};

function RailLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { pathname, search } = useLocation();
  const active = isActive(item, pathname, search);
  const Icon = item.icon;
  const link = (
    <Link
      to={item.to}
      aria-current={active ? 'page' : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        'flex h-12 items-center gap-4 rounded-md px-3 text-body font-medium transition-colors duration-(--duration-fast)',
        active ? 'bg-surface-strong font-bold text-foreground' : 'text-foreground/85 hover:bg-accent',
        collapsed && 'justify-center px-0',
      )}
    >
      {item.primary ? (
        <span className="grid size-6 shrink-0 place-items-center rounded-[0.45rem] bg-primary text-primary-foreground">
          <Icon className="size-4" strokeWidth={2.75} aria-hidden="true" />
        </span>
      ) : (
        <Icon className="size-6 shrink-0" strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
      )}
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

/** Desktop navigation (TikTok web style). Collapses to icons below 1280 px, or when the person collapses it. */
export function LeftRail() {
  const { user } = useAuth();
  const wide = useMediaQuery('(min-width: 1280px)');
  const [pinnedCollapsed, setPinnedCollapsed] = useState(readCollapsed);
  const collapsed = !wide || pinnedCollapsed;

  const toggle = () => {
    const next = !pinnedCollapsed;
    setPinnedCollapsed(next);
    try {
      localStorage.setItem(KEY, next ? 'collapsed' : 'open');
    } catch {
      // storage blocked: the choice lasts for this page only
    }
  };

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-rail py-4 md:flex',
        collapsed ? 'w-rail-collapsed px-2' : 'w-rail px-3',
      )}
    >
      <div className={cn('mb-5 flex items-center', collapsed ? 'flex-col gap-3' : 'justify-between pr-1 pl-2')}>
        <Logo compact={collapsed} />
        {wide && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggle}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            aria-expanded={!collapsed}
            className="text-muted-foreground"
          >
            <PanelLeft className="size-5" aria-hidden="true" />
          </Button>
        )}
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {user ? (
          <>
            {RAIL.map((item) => (
              <RailLink key={item.to} item={item} collapsed={collapsed} />
            ))}
            {user.role === 'admin' && (
              <div role="group" aria-label="Administration" className="mt-3 flex flex-col gap-1 border-t pt-3">
                {!collapsed && <p className="px-3 pb-1 text-caption font-semibold text-muted-foreground">Admin</p>}
                {ADMIN_RAIL.map((item) => (
                  <RailLink key={item.to} item={item} collapsed={collapsed} />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {RAIL.slice(0, 2).map((item) => (
              <RailLink key={item.to} item={item} collapsed={collapsed} />
            ))}
            {!collapsed && (
              <div className="mt-4 flex flex-col gap-2 border-t px-1 pt-5">
                <p className="px-2 pb-1 text-body-sm text-muted-foreground">
                  Log in to like, save and comment on notes.
                </p>
                <Button asChild size="lg">
                  <Link to="/login">Log in</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/register">Register</Link>
                </Button>
              </div>
            )}
          </>
        )}
        <div className="mt-1">
          <MoreMenu variant="rail" collapsed={collapsed} />
        </div>
      </nav>

      {!collapsed && <p className="mt-4 px-3 text-caption text-muted-foreground">&copy; 2026 NotaLah</p>}
    </aside>
  );
}
