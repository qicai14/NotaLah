import { Link, useParams } from 'react-router-dom';
import { LecturerBadge } from '../../components/LecturerBadge';
import { NoteActions } from '../../components/NoteActions';
import { SlideViewer } from '../../components/SlideViewer';
import { timeAgo, visibilityLabel } from '../../lib/format';
import { useFetch } from '../../lib/useFetch';
import type { Note } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { CommentPanel } from './CommentPanel';

export default function NoteDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, error, loading } = useFetch<{ note: Note }>(`/notes/${id}`);

  if (loading) return <p>Loading…</p>;
  if (error || !data) {
    return (
      <p role="alert" className="text-red-600">
        {error ?? 'Note not found'}
      </p>
    );
  }
  const n = data.note;
  return (
    <article>
      <h1 className="text-2xl font-semibold">{n.title}</h1>
      <p className="mb-3 mt-1 flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
        <Link to={`/users/${n.author.id}`} className="font-medium text-slate-900">
          {n.author.displayName}
        </Link>
        {n.author.isVerifiedLecturer && <LecturerBadge />}
        {n.module && <span className="rounded bg-slate-100 px-1.5">{n.module.code}</span>}
        <span>{timeAgo(n.publishedAt ?? n.updatedAt)}</span>
        <span>· {visibilityLabel(n.visibility)}</span>
        {n.verified && <span className="font-medium text-indigo-700">· Verified by a lecturer</span>}
      </p>
      <SlideViewer slides={n.slides} />
      {n.hashtags.length > 0 && <p className="mt-2 text-sm text-indigo-700">{n.hashtags.map((h) => `#${h}`).join(' ')}</p>}
      {n.author.id === user?.id && (
        <Link to={`/notes/${n.id}/edit`} className="mt-3 inline-block rounded-md border border-slate-300 px-3 py-1 text-sm">
          Edit
        </Link>
      )}
      {n.status === 'published' && <NoteActions note={n} commentsLink={false} />}
      {n.status === 'published' && <CommentPanel noteId={n.id} slideCount={n.slides.length} />}
    </article>
  );
}
