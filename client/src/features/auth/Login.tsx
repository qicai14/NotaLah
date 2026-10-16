import { type FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAction } from '@/lib/useAction';
import { useAuth } from './AuthContext';
import { Field } from '../../components/Field';
import { ApiError } from '../../lib/api';

type LoginState = { notice?: string; from?: string } | null;

/** Log in form (UC02, wireframe 03); shown in a dialog over the Welcome page. Returns the visitor to `state.from`. */
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const state = location.state as LoginState;
  const notice = state?.notice ?? (params.get('expired') ? 'Session expired. Please log in again.' : null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { run, pending, error, setError } = useAction();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) return setError('Email and password are required');
    const user = await run(
      () => login(email, password),
      (err) => (err instanceof ApiError ? err.message : 'Could not reach the server. Please try again.'),
    );
    if (user) navigate(state?.from ?? (user.role === 'admin' ? '/admin/lecturers' : '/'), { replace: true });
  }

  return (
    <div>
      {notice && (
        <p role="status" className="mb-5 rounded-md bg-surface px-4 py-3 text-body-sm font-medium">
          {notice}
        </p>
      )}
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field
          label="APU email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="tp000000@mail.apu.edu.my"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p role="alert" className="-mt-1 text-body-sm font-semibold text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={pending} className="mt-1">
          {pending ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
      <p className="mt-5 text-center text-body-sm text-muted-foreground">
        Don&rsquo;t have an account?{' '}
        <Link
          to="/register"
          state={state?.from ? { from: state.from } : undefined}
          className="font-bold text-foreground hover:underline"
        >
          Register
        </Link>
      </p>
    </div>
  );
}
