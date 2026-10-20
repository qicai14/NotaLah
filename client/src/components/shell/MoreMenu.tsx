import { Bell, Bookmark, LogOut, Menu, Monitor, Moon, MoreHorizontal, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/features/auth/AuthContext';
import { useNotificationUnread } from '@/features/notifications/NotificationsContext';
import { useAction } from '@/lib/useAction';
import { type ThemePreference, useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

const THEMES: [ThemePreference, string, typeof Sun][] = [
  ['system', 'System', Monitor],
  ['light', 'Light', Sun],
  ['dark', 'Dark', Moon],
];

/** Theme choice and Log out. `variant="rail"` is the labelled rail row; `"icon"` is the phone header button. */
export function MoreMenu({ variant, collapsed = false }: { variant: 'rail' | 'icon'; collapsed?: boolean }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const unread = useNotificationUnread();
  const { run, error } = useAction();

  const logOut = () =>
    run(
      async () => {
        await logout();
        void navigate('/login', { replace: true });
      },
      () => 'Could not log out. Try again.',
    );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="More: appearance and account"
          className={cn(
            variant === 'rail'
              ? 'flex h-12 w-full cursor-pointer items-center gap-4 rounded-md px-3 text-body font-medium text-foreground/85 hover:bg-accent data-[state=open]:bg-accent'
              : 'grid size-10 cursor-pointer place-items-center rounded-full text-current hover:bg-foreground/10',
            collapsed && 'justify-center px-0',
          )}
        >
          {variant === 'rail' ? (
            <>
              <MoreHorizontal className="size-6 shrink-0" aria-hidden="true" />
              {!collapsed && 'More'}
            </>
          ) : (
            <Menu className="size-6" aria-hidden="true" />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={variant === 'rail' ? 'top' : 'bottom'}
          align="start"
          className="w-60 rounded-lg p-1.5"
        >
          <DropdownMenuLabel className="text-caption text-muted-foreground">Appearance</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemePreference)}>
            {THEMES.map(([value, label, Icon]) => (
              <DropdownMenuRadioItem key={value} value={value} className="h-10 rounded-sm">
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {user && (
            <>
              <DropdownMenuSeparator />
              {variant === 'icon' && (
                <DropdownMenuItem className="h-10 rounded-sm" onSelect={() => navigate('/notifications')}>
                  <Bell className="size-4" aria-hidden="true" />
                  Notifications
                  {unread > 0 && (
                    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-caption font-bold text-primary-foreground tabular-nums">
                      <span className="sr-only">{unread} unread</span>
                      <span aria-hidden="true">{unread > 99 ? '99+' : unread}</span>
                    </span>
                  )}
                </DropdownMenuItem>
              )}
              {variant === 'icon' && (
                <DropdownMenuItem className="h-10 rounded-sm" onSelect={() => navigate('/saved')}>
                  <Bookmark className="size-4" aria-hidden="true" />
                  Saved
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="h-10 rounded-sm" onSelect={logOut}>
                <LogOut className="size-4" aria-hidden="true" />
                Log out
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {error && (
        <p role="alert" className="px-3 text-body-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </>
  );
}
