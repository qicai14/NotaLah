import { Link, Route, Routes } from 'react-router-dom';

function Page({ title, children }: { title: string; children?: string }) {
  return (
    <section>
      <h1 className="text-xl font-semibold">{title}</h1>
      {children && <p className="mt-2 text-slate-600">{children}</p>}
    </section>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-bold tracking-wide text-indigo-600">
            PARP
          </Link>
          <div className="flex gap-4 text-sm">
            <Link to="/login">Log in</Link>
            <Link to="/register">Register</Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Page title="Feed">Feed — coming in Sprint 2</Page>} />
          <Route path="/login" element={<Page title="Log in" />} />
          <Route path="/register" element={<Page title="Register" />} />
        </Routes>
      </main>
    </div>
  );
}
