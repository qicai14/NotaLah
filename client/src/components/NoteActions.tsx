import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { api, errorText } from '../lib/api';
import type { Note } from '../types';
import { ReportDialog } from './ReportDialog';

const btn = 'rounded-md border border-slate-300 px-3 py-1 text-sm disabled:opacity-50';

/** Like, comments, save, report and the Sprint 4 message placeholder; used by the feed card and the note detail. */
export function NoteActions({ note, commentsLink = true }: { note: Note; commentsLink?: boolean }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(note.liked);
  const [likes, setLikes] = useState(note.counts.likes);
  const [saved, setSaved] = useState(note.bookmarked);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(kind: 'like' | 'bookmark') {
    if (busy) return;
    setBusy(true);
    setError(null);
    const on = kind === 'like' ? liked : saved;
    try {
      const r = await api<{ liked?: boolean; likes?: number; bookmarked?: boolean }>(`/notes/${note.id}/${kind}`, { method: on ? 'DELETE' : 'POST' });
      if (kind === 'like') (setLiked(!!r.liked), setLikes(r.likes ?? likes));
      else setSaved(!!r.bookmarked);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => toggle('like')} disabled={busy} aria-pressed={liked} aria-label={`Like, ${likes} likes`} className={`${btn} ${liked ? 'bg-indigo-600 text-white' : ''}`}>
          {liked ? 'Liked' : 'Like'} ({likes})
        </button>
        {commentsLink && (
          <Link to={`/notes/${note.id}`} className={btn} aria-label={`Comments, ${note.counts.comments}`}>
            Comments ({note.counts.comments})
          </Link>
        )}
        <button type="button" onClick={() => toggle('bookmark')} disabled={busy} aria-pressed={saved} className={`${btn} ${saved ? 'bg-slate-800 text-white' : ''}`}>
          {saved ? 'Saved' : 'Save'}
        </button>
        {note.author.id !== user?.id && (
          <button type="button" onClick={() => setReporting(true)} className={btn}>
            Report
          </button>
        )}
        <button type="button" disabled title="Coming in Sprint 4" className={btn}>
          Message author — coming soon
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {reporting && <ReportDialog noteId={note.id} onClose={() => setReporting(false)} />}
    </>
  );
}
