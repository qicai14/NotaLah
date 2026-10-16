import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');

/** Round avatar: the photo when there is one, otherwise the person's initials. Decorative: the name is always shown beside it. */
export function UserAvatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  return (
    <Avatar aria-hidden="true" className={cn('size-10', className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className="bg-surface-strong text-caption font-bold text-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
