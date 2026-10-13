import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './features/auth/AuthContext';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import AdminLecturers from './features/moderation/AdminLecturers';
import Login from './features/auth/Login';
import Register from './features/auth/Register';

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const verified = user?.role === 'lecturer' && user.lecturerStatus === 'approved';

  return (
    <header className="sticky top-0 border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link to="/" className="text-lg font-bold tracking-wide text-indigo-600">
          PARP
        </Link>
        {user ? (
          <div className="flex items-center gap-3 text-sm">
            {user.role === 'admin' && (
              <Link to="/admin/lecturers" className="text-indigo-600">
                Lecturer applications
              </Link>
            )}
            <span className="font-medium">
              {user.displayName}
              {verified && (
                <span title="Verified lecturer" className="ml-1 rounded-full bg-indigo-600 px-1.5 text-xs text-white">
                  ✓<span className="sr-only"> verified lecturer</span>
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
              className="rounded-md border border-slate-300 px-3 py-1"
            >
              Log out
            </button>
          </div>
        ) : (
          <div className="flex gap-4 text-sm">
            <Link to="/login">Log in</Link>
            <Link to="/register">Register</Link>
          </div>
        )}
      </nav>
    </header>
  );
}

function Feed() {
  return (
    <section>
      <h1 className="text-xl font-semibold">Feed</h1>
      <p className="mt-2 text-slate-600">Feed — coming in Sprint 2</p>
    </section>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Routes>
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Feed />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/admin/lecturers"
            element={
              <ProtectedRoute roles={['admin']}>
                <AdminLecturers />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
