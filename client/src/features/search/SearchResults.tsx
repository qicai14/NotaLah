import { Heart, Hash } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LecturerBadge } from '@/components/LecturerBadge';
import { SlideBoard } from '@/components/board/SlideBoard';
import { UserAvatar } from '@/components/UserAvatar';
import { VerifiedPill } from '@/components/VerifiedPill';
import { timeAgo } from '@/lib/format';
import type { Note } from '../../types';
import { searchHref } from './searchParams';
import type { HashtagResult, ModuleResult, PersonResult } from './useSearchResults';

/** A result list section: a heading, an optional "See all", and its rows. */
export function Section({ title, onSeeAll, children }: { title: string; onSeeAll?: () => void; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-title-sm font-bold">{title}</h2>
        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="rounded-sm px-1 text-body-sm font-semibold text-primary hover:underline"
          >
            See all<span className="sr-only"> {title.toLowerCase()}</span>
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

const rowClass =
  'relative flex min-h-14 items-center gap-3 rounded-md border bg-card px-3 py-2 transition-colors duration-(--duration-fast) hover:bg-accent';

export function PersonRow({ person, onLecturer }: { person: PersonResult; onLecturer?: (id: string) => void }) {
  return (
    <li className={rowClass}>
      <UserAvatar name={person.displayName} src={person.avatarUrl} />
      <div className="min-w-0 flex-1">
        <Link
          to={`/users/${person.id}`}
          className="block truncate text-body font-bold hover:underline after:absolute after:inset-0"
        >
          {person.displayName}
          {person.isVerifiedLecturer && <LecturerBadge />}
        </Link>
        <p className="truncate text-body-sm text-muted-foreground">
          {person.isVerifiedLecturer ? 'Lecturer' : person.role === 'admin' ? 'Administrator' : 'Student'}
          {person.programme && ` · ${person.programme}`}
        </p>
      </div>
      {person.isVerifiedLecturer && onLecturer && (
        <button
          type="button"
          onClick={() => onLecturer(String(person.id))}
          className="relative z-10 h-9 shrink-0 rounded-full bg-surface px-3 text-body-sm font-semibold hover:bg-surface-strong"
        >
          Their notes
          <span className="sr-only"> and notes they validated, by {person.displayName}</span>
        </button>
      )}
    </li>
  );
}

export function HashtagRow({ tag }: { tag: HashtagResult }) {
  return (
    <li className={rowClass}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-strong" aria-hidden="true">
        <Hash className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <Link
          to={searchHref({ q: `#${tag.name}`, tab: 'notes' })}
          className="block truncate text-body font-bold hover:underline after:absolute after:inset-0"
        >
          #{tag.name}
        </Link>
        <p className="text-body-sm text-muted-foreground">
          {tag.noteCount} {tag.noteCount === 1 ? 'note' : 'notes'}
        </p>
      </div>
    </li>
  );
}

export function ModuleRow({ module }: { module: ModuleResult }) {
  return (
    <li className={rowClass}>
      <span
        className="grid h-10 min-w-10 shrink-0 place-items-center rounded-sm bg-surface-strong px-2 text-caption font-bold"
        aria-hidden="true"
      >
        {module.code.split('-')[0]}
      </span>
      <div className="min-w-0 flex-1">
        <Link
          to={searchHref({ q: module.code, tab: 'notes', module: String(module.id) })}
          className="block truncate text-body font-bold hover:underline after:absolute after:inset-0"
        >
          {module.code} {module.name}
        </Link>
        <p className="truncate text-body-sm text-muted-foreground">
          {module.programme} · {module.noteCount} {module.noteCount === 1 ? 'note' : 'notes'}
        </p>
      </div>
    </li>
  );
}

/** A note result: the first slide as a thumbnail, then the title, author and the marks that matter when searching. */
export function NoteResult({ note }: { note: Note }) {
  const titleId = `result-${note.id}`;
  const first = note.slides[0];
  return (
    <li className="relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-(--shadow-card) transition-colors duration-(--duration-fast) hover:bg-accent/50">
      <div className="h-40 bg-surface p-2" aria-hidden="true">
        {first && <SlideBoard slide={first} aspect={note.aspect} assets={note.assets} label="First slide" />}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {note.verified && <VerifiedPill by={note.verifiedBy} className="self-start" />}
        <h3 className="line-clamp-2 text-title-sm font-semibold">
          <Link
            id={titleId}
            to={`/notes/${note.id}`}
            className="hover:underline after:absolute after:inset-0 after:z-0"
          >
            {note.title}
          </Link>
        </h3>
        <p className="flex flex-wrap items-center gap-x-1.5 text-body-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{note.author.displayName}</span>
          {note.author.isVerifiedLecturer && <LecturerBadge />}
          <span>{timeAgo(note.publishedAt)}</span>
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
          {note.module && (
            <span className="rounded-sm bg-surface-strong px-2 py-0.5 text-caption font-semibold">
              {note.module.code}
            </span>
          )}
          {note.hashtags.slice(0, 3).map((h) => (
            <span key={h} className="text-body-sm font-bold">
              #{h}
            </span>
          ))}
          <span className="ml-auto inline-flex items-center gap-1 text-caption font-semibold tabular-nums text-muted-foreground">
            <Heart className="size-3.5" aria-hidden="true" />
            {note.counts.likes}
            <span className="sr-only"> likes</span>
          </span>
        </div>
      </div>
    </li>
  );
}
