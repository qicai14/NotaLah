import { type FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAction } from '@/lib/useAction';
import { cn } from '@/lib/utils';
import { type RegisterInput, useAuth } from './AuthContext';
import { Field } from '../../components/Field';
import { ProgrammeSelect } from '../../components/ProgrammeSelect';
import { ApiError } from '../../lib/api';

const EMPTY: RegisterInput = {
  displayName: '',
  email: '',
  password: '',
  confirmPassword: '',
  programme: '',
  role: 'student',
  staffId: '',
};

/** Registration form (UC01, UC22, wireframe 02); shown in a dialog over the Welcome page. */
export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [form, setForm] = useState<RegisterInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { run, pending, error: formError } = useAction();

  const set = (key: keyof RegisterInput) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const isLecturer = form.role === 'lecturer';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    const done = await run(
      async () => (await register({ ...form, staffId: isLecturer ? form.staffId : undefined }), true),
      (err) => {
        if (err instanceof ApiError && err.status === 409) {
          setErrors({ email: err.message });
          return null;
        }
        if (err instanceof ApiError && Object.keys(err.errors).length) {
          setErrors(err.errors);
          return null;
        }
        return err instanceof ApiError ? err.message : 'Could not reach the server. Please try again.';
      },
    );
    if (done)
      navigate('/login', {
        state: {
          from,
          notice: isLecturer
            ? 'Account created. Lecturer features unlock after an administrator approves your application.'
            : 'Account created. You can now log in.',
        },
      });
  }

  return (
    <div>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <fieldset>
          <legend className="sr-only">I am a</legend>
          <div className="inline-flex rounded-full bg-surface p-1">
            {(['student', 'lecturer'] as const).map((r) => (
              <label
                key={r}
                className={cn(
                  'relative cursor-pointer rounded-full px-5 py-2 text-body-sm font-semibold transition-colors duration-(--duration-fast) has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                  form.role === r ? 'bg-background text-foreground shadow-(--shadow-card)' : 'text-muted-foreground',
                )}
              >
                <input
                  type="radio"
                  name="role"
                  value={r}
                  checked={form.role === r}
                  onChange={set('role')}
                  className="sr-only"
                />
                {r === 'student' ? 'Student' : 'Lecturer'}
              </label>
            ))}
          </div>
          {errors.role && (
            <p role="alert" className="mt-1.5 text-body-sm font-medium text-destructive">
              {errors.role}
            </p>
          )}
        </fieldset>
        <Field
          label="Display name"
          name="displayName"
          autoComplete="nickname"
          maxLength={50}
          value={form.displayName}
          onChange={set('displayName')}
          error={errors.displayName}
        />
        <Field
          label="APU email"
          name="email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={set('email')}
          error={errors.email}
        />
        {errors.email === 'This email is already registered' && (
          <p className="-mt-2 text-body-sm">
            <Link to="/login" className="font-bold underline underline-offset-2">
              Log in instead
            </Link>
          </p>
        )}
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters."
          value={form.password}
          onChange={set('password')}
          error={errors.password}
        />
        <Field
          label="Confirm password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={form.confirmPassword}
          onChange={set('confirmPassword')}
          error={errors.confirmPassword}
        />
        <ProgrammeSelect value={form.programme} onChange={set('programme')} error={errors.programme} />

        {isLecturer && (
          <Field
            label="Staff ID"
            name="staffId"
            maxLength={20}
            value={form.staffId}
            onChange={set('staffId')}
            error={errors.staffId}
            hint="Lecturer features (such as Super Like) unlock after an administrator approves your application. Until then your account works as a student account."
          />
        )}

        {formError && (
          <p role="alert" className="text-body-sm font-semibold text-destructive">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" disabled={pending} className="mt-1">
          {pending ? 'Creating account…' : 'Register'}
        </Button>
      </form>
      <p className="mt-5 text-center text-body-sm text-muted-foreground">
        Already have an account?{' '}
        <Link to="/login" state={from ? { from } : undefined} className="font-bold text-foreground hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
