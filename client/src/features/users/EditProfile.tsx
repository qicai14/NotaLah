import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Field } from '../../components/Field';
import { api, ApiError, errorText } from '../../lib/api';
import { useFetch } from '../../lib/useFetch';
import type { Profile, User } from '../../types';
import { useAuth } from '../auth/AuthContext';

export default function EditProfile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading } = useFetch<{ user: Profile }>(`/users/${user?.id}`); // /auth/me has no bio
  const [displayName, setDisplayName] = useState('');
  const [programme, setProgramme] = useState('');
  const [bio, setBio] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data) return;
    setDisplayName(data.user.displayName);
    setProgramme(data.user.programme ?? '');
    setBio(data.user.bio ?? '');
  }, [data]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setFormError(null);
    try {
      const r = await api<{ user: User }>('/users/me', { method: 'PUT', body: { displayName, programme, bio } });
      setUser(r.user);
      navigate('/profile');
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.errors ?? {}).length) setErrors(err.errors);
      else setFormError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p>Loading…</p>;
  if (error) {
    return (
      <p role="alert" className="text-red-600">
        {error}
      </p>
    );
  }
  const count = (s: string, max: number) => (
    <span className={`text-xs ${s.length > max ? 'text-red-600' : 'text-slate-500'}`}>
      {s.length}/{max}
    </span>
  );
  return (
    <section className="max-w-md">
      <h1 className="mb-4 text-xl font-semibold">Edit profile</h1>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div>
          <Field label="Display name" name="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} error={errors.displayName} />
          {count(displayName, 50)}
        </div>
        <div>
          <Field label="Programme" name="programme" value={programme} onChange={(e) => setProgramme(e.target.value)} error={errors.programme} />
          {count(programme, 100)}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="field-bio" className="text-sm font-medium">
            Bio
          </label>
          <textarea
            id="field-bio"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            aria-invalid={errors.bio ? true : undefined}
            aria-describedby={errors.bio ? 'bio-error' : undefined}
            className="rounded-md border border-slate-300 px-3 py-2"
          />
          {count(bio, 300)}
          {errors.bio && (
            <p id="bio-error" role="alert" className="text-sm text-red-600">
              {errors.bio}
            </p>
          )}
        </div>
        {formError && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="rounded-md bg-indigo-600 px-4 py-2 text-white disabled:opacity-60">
            {busy ? 'Saving…' : 'Save'}
          </button>
          <button type="button" onClick={() => navigate('/profile')} className="rounded-md border border-slate-300 px-4 py-2">
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
