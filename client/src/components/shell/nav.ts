import {
  Bookmark,
  FileText,
  Flag,
  GraduationCap,
  House,
  type LucideIcon,
  Plus,
  User,
  Users,
  UsersRound,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Drawn as the filled Create button (rail) or the raised centre tab (phone). */
  primary?: boolean;
}

/**
 * Desktop left rail, in order. Add a screen here (and to TABS when it belongs in the phone tab bar) so both stay in
 * step. Explore, Messages and Notifications join when their branches land (see client/DESIGN.md).
 */
export const RAIL: NavItem[] = [
  { to: '/', label: 'Feed', icon: House },
  { to: '/?tab=following', label: 'Following', icon: UsersRound },
  { to: '/notes/new', label: 'Create', icon: Plus, primary: true },
  { to: '/drafts', label: 'Drafts', icon: FileText },
  { to: '/saved', label: 'Saved', icon: Bookmark },
  { to: '/profile', label: 'Profile', icon: User },
];

export const ADMIN_RAIL: NavItem[] = [
  { to: '/admin/lecturers', label: 'Lecturer applications', icon: GraduationCap },
  { to: '/admin/reports', label: 'Reports', icon: Flag },
  { to: '/admin/users', label: 'Users', icon: Users },
];

/** Phone tab bar: five slots, Create in the middle. */
export const TABS: NavItem[] = [
  { to: '/', label: 'Home', icon: House },
  { to: '/saved', label: 'Saved', icon: Bookmark },
  { to: '/notes/new', label: 'Create', icon: Plus, primary: true },
  { to: '/drafts', label: 'Drafts', icon: FileText },
  { to: '/profile', label: 'Profile', icon: User },
];

/** Feed and Following share the path '/', so the active item is decided by the tab query too. */
export function isActive(item: NavItem, pathname: string, search: string): boolean {
  const [path, query] = item.to.split('?');
  if (path !== '/') return pathname === path || pathname.startsWith(`${path}/`);
  if (pathname !== '/') return false;
  const tab = new URLSearchParams(search).get('tab');
  return query ? `tab=${tab}` === query : tab !== 'following';
}
