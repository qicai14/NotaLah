import { Link, NavLink, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from './features/auth/AuthContext';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import AdminLecturers from './features/moderation/AdminLecturers';
import AdminReports from './features/moderation/AdminReports';
import AdminUsers from './features/moderation/AdminUsers';
import Login from './features/auth/Login';
import Register from './features/auth/Register';
import { LecturerBadge } from './components/LecturerBadge';
import Feed from './features/feed/Feed';
import Saved from './features/feed/Saved';
import Drafts from './features/notes/Drafts';
import NoteDetail from './features/notes/NoteDetail';
import NoteEditor from './features/notes/NoteEditor';
import EditProfile from './features/users/EditProfile';
import Profile from './features/users/Profile';

/** One NoteEditor per note id: /notes/new and /notes/:id/edit must never share state. */
function EditorRoute() {
  const { id } = useParams();
  return <NoteEditor key={id ?? 'new'} />;
}

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
const ADMIN_NAV = [
  ['/admin/lecturers', 'Lecturer applications'],
  ['/admin/reports', 'Reports'],
  ['/admin/users', 'Users'],
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
              <nav aria-label="Administration" className="flex gap-3">
                {ADMIN_NAV.map(([to, label]) => (
                  <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'font-semibold text-indigo-700' : 'text-indigo-600')}>
                    {label}
                  </NavLink>
                ))}
              </nav>
            )}
            <Link to="/profile" className="font-medium">
              {user.displayName}
              {verified && <LecturerBadge />}
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
        <main id="main" tabIndex={-1} className="min-w-0 outline-none max-w-2xl flex-1">
          <Routes>
            <Route path="/" element={<ProtectedRoute><Feed /></ProtectedRoute>} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/notes/new" element={<ProtectedRoute><EditorRoute /></ProtectedRoute>} />
            <Route path="/notes/:id/edit" element={<ProtectedRoute><EditorRoute /></ProtectedRoute>} />
            <Route path="/notes/:id" element={<ProtectedRoute><NoteDetail /></ProtectedRoute>} />
            <Route path="/drafts" element={<ProtectedRoute><Drafts /></ProtectedRoute>} />
            <Route path="/saved" element={<ProtectedRoute><Saved /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/profile/edit" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
            <Route path="/users/:id" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/admin/lecturers" element={<ProtectedRoute roles={['admin']}><AdminLecturers /></ProtectedRoute>} />
            <Route path="/admin/reports" element={<ProtectedRoute roles={['admin']}><AdminReports /></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute roles={['admin']}><AdminUsers /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
      {user && <TabBar />}
    </div>
  );
}
