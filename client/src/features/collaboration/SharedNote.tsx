import { Eye, LogIn, Pencil } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Coauthors } from '@/components/Coauthors';
import { SlideCarousel } from '@/components/board/SlideCarousel';
import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import { useAction } from '@/lib/useAction';
import { useAuth } from '../auth/AuthContext';
import { api } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import type { CollabRole, Note } from '../../types';

function Message({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-sm py-16 text-center">
      <h1 className="text-title font-bold">{title}</h1>
      <p className="mt-2 text-body text-muted-foreground">{text}</p>
      {children && <div className="mt-5 flex flex-col items-center gap-2">{children}</div>}
    </div>
  );
}

/**
 * The page behind a share link (R30, D46). A view link opens the note read-only, guests included. An edit link needs
 * an account (guests are sent to log in and return here); "Join as editor" is the write, so it is a button, not a side
 * effect of opening the link.
 */
export default function SharedNote() {
  const { token = '' } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data, error, errorStatus, loading } = useFetch<{ role: CollabRole; note: Note | null }>(
    `/share/${encodeURIComponent(token)}`,
  );
  const join = useAction();

  if (loading)
    return (
      <p role="status" className="py-16 text-center text-body-sm text-muted-foreground">
        Opening shared note…
      </p>
    );

  if (errorStatus === 401) {
    return (
      <Message title="Log in to edit this note" text="This link lets you join as an editor, which needs an account.">
        <Button size="lg" onClick={() => navigate('/login', { state: { from: location.pathname } })}>
          <LogIn aria-hidden="true" />
          Log in
        </Button>
        <Button size="lg" variant="ghost" onClick={() => navigate('/register', { state: { from: location.pathname } })}>
          Register
        </Button>
      </Message>
    );
  }
  if (error || !data?.note) {
    return (
      <Message
        title="This link does not work"
        text={error ?? 'The link was revoked, or the note is no longer available.'}
      >
        <Button asChild variant="secondary">
          <Link to="/">Back to Feed</Link>
        </Button>
      </Message>
    );
  }

  const { role, note: n } = data;
  const own = user?.id === n.author.id;
  const joinAsEditor = async () => {
    const r = await join.run(() => api<{ noteId: number }>(`/share/${encodeURIComponent(token)}`, { method: 'POST' }));
    if (r) navigate(`/notes/${r.noteId}`, { replace: true });
  };

  return (
    <article aria-labelledby="shared-title" className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface px-4 py-3">
        {role === 'edit' ? (
          <Pencil className="size-5 shrink-0" aria-hidden="true" />
        ) : (
          <Eye className="size-5 shrink-0" aria-hidden="true" />
        )}
        <p className="min-w-0 flex-1 basis-56 text-body-sm">
          {own ? (
            <>This is your note.</>
          ) : role === 'edit' ? (
            <>
              <strong className="font-bold">{n.author.displayName}</strong> invited you to edit this note.
            </>
          ) : (
            <>
              You are reading a shared copy. <span className="text-muted-foreground">It is view only.</span>
            </>
          )}
        </p>
        {own && (
          <Button asChild variant="outline" size="sm">
            <Link to={`/notes/${n.id}`}>Open note</Link>
          </Button>
        )}
        {role === 'edit' && !own && (
          <Button onClick={joinAsEditor} disabled={join.pending}>
            {join.pending ? 'Joining…' : 'Join as editor'}
          </Button>
        )}
        {role === 'view' && !user && (
          <Button asChild variant="outline" size="sm">
            <Link to="/login" state={{ from: location.pathname }}>
              Log in
            </Link>
          </Button>
        )}
      </div>
      {join.error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-body-sm font-medium text-destructive">
          {join.error}
        </p>
      )}

      <header className="flex items-center gap-3">
        <UserAvatar name={n.author.displayName} className="size-11" />
        <p className="min-w-0 text-body-sm">
          <span className="font-bold">{n.author.displayName}</span> <Coauthors people={n.coauthors} />
        </p>
      </header>

      <div className="rounded-2xl border bg-card p-4 shadow-(--shadow-card) md:p-6">
        {n.module && <p className="mb-3 text-caption font-semibold text-muted-foreground">{n.module.code}</p>}
        <div className="h-[min(36rem,64dvh)]">
          <SlideCarousel slides={n.slides} aspect={n.aspect} assets={n.assets} />
        </div>
      </div>

      <h1 id="shared-title" className="text-title font-bold text-balance">
        {n.title}
      </h1>
      {(n.module || n.hashtags.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {n.module && (
            <span className="rounded-full bg-surface px-3 py-1 text-caption font-semibold">
              {n.module.code} {n.module.name}
            </span>
          )}
          {n.hashtags.map((h) => (
            <span key={h} className="rounded-full bg-surface px-3 py-1 text-caption font-semibold">
              #{h}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
