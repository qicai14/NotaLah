import { Bookmark, Heart, Highlighter, MessageCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { markGuest } from './guest';
import Login from './Login';
import Register from './Register';


/** A still of the phone feed, drawn with tokens so it follows the theme. Decorative. */
function PhonePreview() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-[17.5rem] select-none lg:w-[19rem]">
      <div className="rounded-[2.75rem] border-[10px] border-foreground bg-background p-2 shadow-(--shadow-float)">
        <div className="flex items-center justify-center gap-5 pt-3 pb-2 text-caption font-bold">
          <span className="border-b-2 border-foreground pb-1">Feed</span>
          <span className="pb-1 text-muted-foreground">Following</span>
        </div>
        <div className="flex gap-2 px-1">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card">
            <div className="px-2.5 pt-2.5">
              <span className="highlighter inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[0.625rem] font-bold">
                <Highlighter className="size-2.5" /> Verified by Dr Lee
              </span>
            </div>
            <div className="px-3 pt-4 pb-3">
              <p className="text-[0.625rem] font-semibold text-muted-foreground">CT030-3-2</p>
              <p className="mt-1 text-[1.05rem] leading-tight font-extrabold tracking-[-0.02em]">
                Normalisation, 1NF to 3NF
              </p>
              <div className="mt-3 flex flex-col gap-1.5">
                <span className="h-1.5 w-full rounded-full bg-surface-strong" />
                <span className="h-1.5 w-4/5 rounded-full bg-surface-strong" />
                <span className="h-1.5 w-11/12 rounded-full bg-surface-strong" />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1 rounded-md bg-surface p-1.5 text-[0.5625rem] font-semibold">
                <span className="rounded-sm bg-background px-1 py-1.5 text-center">StudentID</span>
                <span className="rounded-sm bg-background px-1 py-1.5 text-center">Module</span>
                <span className="rounded-sm bg-primary px-1 py-1.5 text-center text-primary-foreground">Grade</span>
              </div>
              <div className="mt-3 flex justify-center gap-1">
                <span className="h-1 w-3 rounded-full bg-foreground" />
                <span className="size-1 rounded-full bg-surface-strong" />
                <span className="size-1 rounded-full bg-surface-strong" />
                <span className="size-1 rounded-full bg-surface-strong" />
              </div>
            </div>
            <div className="mt-auto border-t bg-surface px-3 py-2.5">
              <p className="text-[0.6875rem] font-bold">Aina Rahman</p>
              <p className="text-[0.625rem] text-muted-foreground">#normalisation #sql</p>
            </div>
          </div>
          <div className="flex flex-col justify-end gap-2.5 pb-2">
            {[Heart, MessageCircle, Bookmark].map((Icon, i) => (
              <span key={i} className="grid size-8 place-items-center rounded-full bg-surface">
                <Icon className={i === 0 ? 'size-4 fill-like text-like' : 'size-4'} />
              </span>
            ))}
          </div>
        </div>
        <div className="mt-3 mb-1 flex justify-around px-2 pt-2 text-[0.5625rem] font-semibold text-muted-foreground">
          <span className="text-foreground">Home</span>
          <span>Saved</span>
          <span className="grid h-5 w-8 place-items-center rounded-sm bg-primary text-primary-foreground">+</span>
          <span>Drafts</span>
          <span>Profile</span>
        </div>
      </div>
    </div>
  );
}

const POINTS = [
  'One note per screen, ranked by likes, comments, recency and lecturer validation.',
  'A lecturer’s Super Like highlights the notes they would teach from.',
  'Notes are slides, so a whole topic fits in a minute of scrolling.',
];

/** First screen for signed-out visitors (R31, wireframe 01). `/login` and `/register` open their dialog on top. */
export default function Welcome({ dialog }: { dialog?: 'login' | 'register' }) {
  const navigate = useNavigate();
  const close = () => ((window.history.state?.idx ?? 0) > 0 ? navigate(-1) : navigate('/welcome'));
  const browse = () => {
    markGuest();
    navigate('/');
  };

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex h-16 items-center justify-between border-b px-4 md:px-10">
        <Logo to="/welcome" />
        <nav aria-label="Account" className="flex items-center gap-2">
          <Button asChild variant="secondary">
            <Link to="/login">Log in</Link>
          </Button>
          <Button asChild variant="outline" className="max-sm:hidden">
            <Link to="/register">Register</Link>
          </Button>
        </nav>
      </header>

      <main
        id="main"
        className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-5 py-12 md:px-10 lg:grid-cols-[1.15fr_1fr] lg:py-16"
      >
        <div className="max-w-xl">
          <h1 className="text-display font-extrabold text-balance">Welcome to NotaLah</h1>
          <p className="mt-6 max-w-[34rem] text-title-sm text-muted-foreground md:text-[1.25rem] md:leading-8">
            Lecture notes from students in your modules, one card at a time. Scroll, like what helps, and see which
            notes your lecturers trust.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={browse}>
              Browse as guest
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/register">Register</Link>
            </Button>
          </div>
          <p className="mt-4 text-body-sm text-muted-foreground">
            Guests can read public notes and comments. Log in with your APU email to like, save and comment.
          </p>
          <ul className="mt-10 flex flex-col gap-3 border-t pt-8">
            {POINTS.map((p) => (
              <li key={p} className="flex gap-3 text-body">
                <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <PhonePreview />
      </main>

      <footer className="px-5 pb-6 text-caption text-muted-foreground md:px-10">&copy; 2026 NotaLah</footer>

      <Dialog open={dialog !== undefined} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[92dvh] gap-0 overflow-y-auto p-6 sm:max-w-[28rem] sm:p-8">
          <DialogTitle className="mb-5 text-title font-bold">
            {dialog === 'register' ? 'Create your NotaLah account' : 'Log in to NotaLah'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {dialog === 'register' ? 'Register with your APU email.' : 'Log in with your APU email and password.'}
          </DialogDescription>
          {dialog === 'register' ? <Register /> : dialog === 'login' ? <Login /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
