import { Link, useParams } from 'react-router-dom';
import { timeAgo } from '../../lib/format';
import { useFetch } from '../../lib/useFetch';
import type { Profile as ProfileData } from '../../types';
import { useAuth } from '../auth/AuthContext';
import { LecturerBadge } from '../../components/LecturerBadge';

/** /users/:id shows any user; /profile shows the signed-in user with Edit and the drafts count. */
export default function Profile() {
  const { id } = useParams();
  const { user } = useAuth();
  const uid = id ?? String(user?.id);
  const { data, error, loading } = useFetch<{ user: ProfileData }>(`/users/${uid}`);

  if (loading) return <p>Loading…</p>;
  if (error || !data) {
    return (
      <p role="alert" className="text-red-600">
        {error ?? 'User not found'}
      </p>
    );
  }
  const p = data.user;
  const own = p.id === user?.id;
  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {p.displayName}
            {p.isVerifiedLecturer && <LecturerBadge />}
          </h1>
          <p className="text-sm capitalize text-slate-600">
            {p.role}
            {p.programme && ` · ${p.programme}`}
          </p>
        </div>
        {own && (
          <Link to="/profile/edit" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
            Edit profile
          </Link>
        )}
      </div>
      {p.bio && <p className="mt-3 whitespace-pre-wrap">{p.bio}</p>}
      {own && (
        <p className="mt-3 text-sm">
          <Link to="/drafts" className="text-indigo-700 underline">
            {p.draftCount ?? 0} {p.draftCount === 1 ? 'draft' : 'drafts'}
          </Link>
        </p>
      )}
      <h2 className="mb-2 mt-6 text-lg font-semibold">Notes</h2>
      {p.notes.length === 0 && <p className="text-slate-600">No notes to show yet.</p>}
      <ul className="flex flex-col gap-3">
        {p.notes.map((n) => (
          <li key={n.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <Link to={`/notes/${n.id}`} className="font-medium text-indigo-700">
              {n.title}
            </Link>
            <p className="text-sm text-slate-600">
              {[n.moduleCode, timeAgo(n.publishedAt), n.verifiedBy && `Verified by ${n.verifiedBy}`, n.hashtags.map((h) => `#${h}`).join(' ')].filter(Boolean).join(' · ')}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
