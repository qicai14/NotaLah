import { Link, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './features/auth/AuthContext';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import AdminLecturers from './features/moderation/AdminLecturers';
import Login from './features/auth/Login';
import Register from './features/auth/Register';
import Feed from './features/feed/Feed';
import Saved from './features/feed/Saved';
import Drafts from './features/notes/Drafts';
import NoteDetail from './features/notes/NoteDetail';
import NoteEditor from './features/notes/NoteEditor';
import EditProfile from './features/users/EditProfile';
import Profile from './features/users/Profile';

const DESKTOP_NAV = [
  ['/', 'Feed'],
  ['/notes/new', 'Create Note'],
  ['/drafts', 'Drafts'],
  ['/saved', 'Saved'],
  ['/profile', 'Profile'],
];
const TABS = [
  ['/', 'Feed'],
  ['/notes/new', 'Create'],
  ['/saved', 'Saved'],
  ['/profile', 'Me'],
];
const linkClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'font-semibold text-indigo-700' : 'text-slate-700');

function SideNav() {
  return (
    <nav aria-label="Main" className="hidden w-44 shrink-0 md:block">
      <ul className="sticky top-20 flex flex-col gap-1">
        {DESKTOP_NAV.map(([to, label]) => (
          <li key={to}>
            <NavLink to={to} end={to === '/'} className={(s) => `block rounded-md px-3 py-2 ${linkClass(s)}`}>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function TabBar() {
  return (
    <nav aria-label="Main tabs" className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white md:hidden">
      <ul className="grid grid-cols-4">
        {TABS.map(([to, label]) => (
          <li key={to}>
            <NavLink to={to} end={to === '/'} className={(s) => `block py-3 text-center text-sm ${linkClass(s)}`}>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const verified = user?.role === 'lecturer' && user.lecturerStatus === 'approved';

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-3">
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
            <Link to="/profile" className="font-medium">
              {user.displayName}
              {verified && (
                <span title="Verified lecturer" className="ml-1 rounded-full bg-indigo-600 px-1.5 text-xs text-white">
                  ✓<span className="sr-only"> verified lecturer</span>
                </span>
              )}
            </Link>
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

export default function App() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header />
      <div className="mx-auto flex max-w-4xl gap-6 px-4 py-6 pb-24 md:pb-6">
        {user && <SideNav />}
        <main className="min-w-0 max-w-2xl flex-1">
          <Routes>
            <Route path="/" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/notes/new" element={<ProtectedRoute><NoteEditor /></ProtectedRoute>} />
            <Route path="/notes/:id/edit" element={<ProtectedRoute><NoteEditor /></ProtectedRoute>} />
            <Route path="/notes/:id" element={<ProtectedRoute><NoteDetail /></ProtectedRoute>} />
            <Route path="/drafts" element={<ProtectedRoute><Drafts /></ProtectedRoute>} />
            <Route path="/saved" element={<ProtectedRoute><Saved /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/profile/edit" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
            <Route path="/users/:id" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/admin/lecturers" element={<ProtectedRoute roles={['admin']}><AdminLecturers /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
      {user && <TabBar />}
    </div>
  );
}
