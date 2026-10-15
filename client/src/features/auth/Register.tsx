import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof RegisterInput) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));
  const isLecturer = form.role === 'lecturer';

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    setBusy(true);
    try {
      await register({ ...form, staffId: isLecturer ? form.staffId : undefined });
      navigate('/login', {
        state: {
          notice: isLecturer
            ? 'Account created. Lecturer features unlock after an administrator approves your application.'
            : 'Account created. You can now log in.',
        },
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) setErrors({ email: err.message });
      else if (err instanceof ApiError && Object.keys(err.errors).length) setErrors(err.errors);
      else setFormError(err instanceof ApiError ? err.message : 'Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-sm">
      <h1 className="mb-4 text-xl font-semibold">Create an account</h1>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Display name" name="displayName" autoComplete="nickname" maxLength={50} value={form.displayName} onChange={set('displayName')} error={errors.displayName} />
        <Field label="Email" name="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
        {errors.email === 'This email is already registered' && (
          <p className="-mt-2 text-sm">
            <Link to="/login" className="text-indigo-600 underline">
              Log in instead
            </Link>
          </p>
        )}
        <Field label="Password" name="password" type="password" autoComplete="new-password" hint="At least 8 characters." value={form.password} onChange={set('password')} error={errors.password} />
        <Field label="Confirm password" name="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} />
        <ProgrammeSelect value={form.programme} onChange={set('programme')} error={errors.programme} />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">I am a</legend>
          {(['student', 'lecturer'] as const).map((r) => (
            <label key={r} className="flex items-center gap-2">
              <input type="radio" name="role" value={r} checked={form.role === r} onChange={set('role')} />
              {r === 'student' ? 'Student' : 'Lecturer'}
            </label>
          ))}
          {errors.role && (
            <p role="alert" className="text-sm text-red-600">
              {errors.role}
            </p>
          )}
        </fieldset>

        {isLecturer && (
          <>
            <Field label="Staff ID" name="staffId" maxLength={20} value={form.staffId} onChange={set('staffId')} error={errors.staffId} />
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Lecturer features (such as Super Like) unlock after an administrator approves your application. Until then
              your account works as a student account.
            </p>
          </>
        )}

        {formError && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        )}
        <button type="submit" disabled={busy} className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-60">
          {busy ? 'Creating account…' : 'Register'}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Already registered?{' '}
        <Link to="/login" className="text-indigo-600 underline">
          Log in
        </Link>
      </p>
    </section>
  );
}
