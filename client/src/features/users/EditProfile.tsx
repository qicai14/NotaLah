import { ArrowLeft } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Field, inputClass } from '@/components/Field';
import { ProgrammeSelect } from '@/components/ProgrammeSelect';
import { Button } from '@/components/ui/button';
import { api, ApiError, errorText } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAction } from '@/lib/useAction';
import { useFetch } from '@/lib/useFetch';
import type { Profile, User } from '@/types';
import { useAuth } from '../auth/AuthContext';
import { BlockedAccounts } from './BlockedAccounts';

export default function EditProfile() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading } = useFetch<{ user: Profile }>(`/users/${user?.id}`); // /auth/me has no bio
  const [displayName, setDisplayName] = useState('');
  const [programme, setProgramme] = useState('');
  const [bio, setBio] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending: busy, error: formError } = useAction();

  useEffect(() => {
    if (!data) return;
    setDisplayName(data.user.displayName);
    setProgramme(data.user.programme ?? '');
    setBio(data.user.bio ?? '');
  }, [data]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    const r = await run(
      () => api<{ user: User }>('/users/me', { method: 'PUT', body: { displayName, programme, bio } }),
      (err) => {
        if (err instanceof ApiError && Object.keys(err.errors ?? {}).length) {
          setErrors(err.errors);
          return null;
        }
        return errorText(err);
      },
    );
    if (r) {
      setUser(r.user);
      navigate('/profile');
    }
  }

  if (loading) {
    return (
      <p role="status" className="py-16 text-center text-body-sm text-muted-foreground">
        Loading…
      </p>
    );
  }
  if (error) {
    return (
      <p role="alert" className="text-body-sm font-medium text-destructive">
        {error}
      </p>
    );
  }
  const count = (s: string, max: number) => (
    <span className={cn('text-caption tabular-nums', s.length > max ? 'text-destructive' : 'text-muted-foreground')}>
      {s.length}/{max}
    </span>
  );
  return (
    <section className="max-w-md">
      <div className="mb-5 flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => navigate('/profile')} className="-ml-2">
          <ArrowLeft aria-hidden="true" />
        </Button>
        <h1 className="text-title font-bold">Edit profile</h1>
      </div>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div>
          <Field
            label="Display name"
            name="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            error={errors.displayName}
          />
          {count(displayName, 50)}
        </div>
        <ProgrammeSelect value={programme} onChange={(e) => setProgramme(e.target.value)} error={errors.programme} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="field-bio" className="text-body-sm font-semibold">
            Bio
          </label>
          <textarea
            id="field-bio"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            aria-invalid={errors.bio ? true : undefined}
            aria-describedby={errors.bio ? 'bio-error' : undefined}
            className={cn(inputClass, 'h-auto py-3')}
          />
          {count(bio, 300)}
          {errors.bio && (
            <p id="bio-error" role="alert" className="text-body-sm font-medium text-destructive">
              {errors.bio}
            </p>
          )}
        </div>
        {formError && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-body-sm font-medium text-destructive">
            {formError}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" size="lg" disabled={busy} className="flex-1">
            {busy ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" variant="outline" size="lg" onClick={() => navigate('/profile')}>
            Cancel
          </Button>
        </div>
      </form>
      <BlockedAccounts />
    </section>
  );
}
