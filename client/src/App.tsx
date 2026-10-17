import { lazy, type ReactNode, Suspense } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AppShell } from './components/shell/AppShell';
import { useAuth } from './features/auth/AuthContext';
import { isGuestBrowsing } from './features/auth/guest';
import { GuestPromptProvider } from './features/auth/GuestPrompt';
import { ProtectedRoute } from './features/auth/ProtectedRoute';

// One chunk per page, so the first load carries only the shell and the screen being opened.
const Welcome = lazy(() => import('./features/auth/Welcome'));
const Feed = lazy(() => import('./features/feed/Feed'));
const Search = lazy(() => import('./features/search/Search'));
const Saved = lazy(() => import('./features/feed/Saved'));
const Drafts = lazy(() => import('./features/notes/Drafts'));
const NoteDetail = lazy(() => import('./features/notes/NoteDetail'));
const NoteEditor = lazy(() => import('./features/notes/NoteEditor'));
const EditProfile = lazy(() => import('./features/users/EditProfile'));
const Profile = lazy(() => import('./features/users/Profile'));
const AdminLecturers = lazy(() => import('./features/moderation/AdminLecturers'));
const AdminReports = lazy(() => import('./features/moderation/AdminReports'));
const AdminUsers = lazy(() => import('./features/moderation/AdminUsers'));

/** One NoteEditor per note id: /notes/new and /notes/:id/edit must never share state. */
function EditorRoute() {
  const { id } = useParams();
  return <NoteEditor key={id ?? 'new'} />;
}

/** The Feed is open to guests (R31) once they choose "Browse as guest"; other signed-out visitors start at Welcome. */
function FeedRoute() {
  const { user } = useAuth();
  if (!user && !isGuestBrowsing()) return <Navigate to="/welcome" replace />;
  return <Feed />;
}

const pageFallback = (
  <p role="status" className="py-16 text-center text-body-sm text-muted-foreground">
    Loading…
  </p>
);

const signedIn = (page: ReactNode, roles?: ['admin']) => <ProtectedRoute roles={roles}>{page}</ProtectedRoute>;

function ShellRoutes() {
  return (
    <AppShell>
      <Suspense fallback={pageFallback}>
        <Routes>
          <Route path="/" element={<FeedRoute />} />
          <Route path="/search" element={<Search />} />
          <Route path="/notes/new" element={signedIn(<EditorRoute />)} />
          <Route path="/notes/:id/edit" element={signedIn(<EditorRoute />)} />
          <Route path="/notes/:id" element={<NoteDetail />} />
          <Route path="/drafts" element={signedIn(<Drafts />)} />
          <Route path="/saved" element={signedIn(<Saved />)} />
          <Route path="/profile" element={signedIn(<Profile />)} />
          <Route path="/profile/edit" element={signedIn(<EditProfile />)} />
          <Route path="/users/:id" element={<Profile />} />
          <Route path="/admin/lecturers" element={signedIn(<AdminLecturers />, ['admin'])} />
          <Route path="/admin/reports" element={signedIn(<AdminReports />, ['admin'])} />
          <Route path="/admin/users" element={signedIn(<AdminUsers />, ['admin'])} />
        </Routes>
      </Suspense>
    </AppShell>
  );
}

export default function App() {
  return (
    <GuestPromptProvider>
      <Suspense fallback={pageFallback}>
        <Routes>
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/login" element={<Welcome dialog="login" />} />
          <Route path="/register" element={<Welcome dialog="register" />} />
          <Route path="*" element={<ShellRoutes />} />
        </Routes>
      </Suspense>
    </GuestPromptProvider>
  );
}
