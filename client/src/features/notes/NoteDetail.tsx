import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ReportDialog } from '../../components/ReportDialog';
import { SlideViewer } from '../../components/SlideViewer';
import { timeAgo, visibilityLabel } from '../../lib/format';
import { useFetch } from '../../lib/useFetch';
import type { Note } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { LecturerBadge } from '../feed/NoteCard';
import { CommentPanel } from './CommentPanel';

export default function NoteDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data, error, loading } = useFetch<{ note: Note }>(`/notes/${id}`);
  const [reporting, setReporting] = useState(false);

  if (loading) return <p>Loading…</p>;
  if (error || !data) {
    return (
      <p role="alert" className="text-red-600">
        {error ?? 'Note not found'}
      </p>
    );
  }
  const n = data.note;
  const own = n.author.id === user?.id;
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
      </p>
      <SlideViewer slides={n.slides} />
      {n.hashtags.length > 0 && <p className="mt-2 text-sm text-indigo-700">{n.hashtags.map((h) => `#${h}`).join(' ')}</p>}
      <div className="mt-3 flex gap-2">
        {own ? (
          <Link to={`/notes/${n.id}/edit`} className="rounded-md border border-slate-300 px-3 py-1 text-sm">
            Edit
          </Link>
        ) : (
          <button type="button" onClick={() => setReporting(true)} className="rounded-md border border-slate-300 px-3 py-1 text-sm">
            Report
          </button>
        )}
      </div>
      {n.status === 'published' && <CommentPanel noteId={n.id} slideCount={n.slides.length} />}
      {reporting && <ReportDialog noteId={n.id} onClose={() => setReporting(false)} />}
    </article>
  );
}
