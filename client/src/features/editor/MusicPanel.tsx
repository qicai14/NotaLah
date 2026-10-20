import { MUSIC_VIDEO_CONFLICT } from '@notalah/shared';
import { Music, Pause, Play, Search } from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ConfirmButton';
import { api, ApiError, errorText } from '@/lib/api';
import type { MusicTrack } from '@/types';
import { useEditor } from './store';

const DEFAULT_VOLUME = 60;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Who made the track and under which Creative Commons licence; Jamendo's licences all require this credit. */
export function MusicCredit({ track }: { track: Pick<MusicTrack, 'title' | 'artist' | 'licenseUrl'> }) {
  return (
    <p className="text-caption text-muted-foreground">
      “{track.title}” by {track.artist}.{' '}
      {track.licenseUrl && (
        <a
          href={track.licenseUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="font-semibold underline underline-offset-2"
        >
          Creative Commons licence
        </a>
      )}{' '}
      · Music from{' '}
      <a href="https://www.jamendo.com" target="_blank" rel="noreferrer noopener" className="font-semibold underline">
        Jamendo
      </a>
    </p>
  );
}

/** Removes the deck's music as one undo step. */
export const removeMusic = () => useEditor.getState().apply((d) => ({ ...d, music: null }));

/**
 * Wireframe-style Music panel (R9, FR17): search Jamendo through the server proxy, preview a track on tap, pick it, set
 * the volume. Nothing plays until a play button is pressed. A deck with a video cannot have music, so the panel is
 * disabled and says why.
 */
export function MusicPanel() {
  const hasVideo = useEditor((s) => s.deck.slides.some((sl) => sl.elements.some((e) => e.type === 'video')));
  const music = useEditor((s) => s.deck.music);
  const picked = useEditor((s) => (s.deck.music ? s.tracks[s.deck.music.trackId] : undefined));
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [instrumental, setInstrumental] = useState(true);
  const [results, setResults] = useState<MusicTrack[] | null>(null);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const latest = useRef(0);
  const volume = music?.volume ?? DEFAULT_VOLUME;

  useEffect(
    () => () => {
      audio.current?.pause();
    },
    [],
  );
  useEffect(() => {
    if (audio.current) audio.current.volume = volume / 100;
  }, [volume]);

  async function search(text: string, p: number) {
    const ticket = ++latest.current;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ results: MusicTrack[] }>(
        `/music/search?q=${encodeURIComponent(text)}&instrumental=${instrumental ? 1 : 0}&page=${p}`,
      );
      if (ticket !== latest.current) return;
      setResults((prev) => (p === 1 || !prev ? r.results : [...prev, ...r.results]));
      setPage(p);
      setQuery(text);
      setMore(r.results.length > 0);
    } catch (e) {
      if (ticket !== latest.current) return;
      setError(e instanceof ApiError && e.status === 503 ? `${e.message}. Try again later.` : errorText(e));
    } finally {
      if (ticket === latest.current) setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (q.trim() && !hasVideo) void search(q.trim(), 1);
  }

  function toggle(t: MusicTrack) {
    if (playing === t.id) {
      audio.current?.pause();
      return setPlaying(null);
    }
    audio.current ??= new Audio();
    const a = audio.current;
    a.onended = () => setPlaying(null);
    a.pause();
    a.src = t.audioUrl;
    a.volume = volume / 100;
    setPlaying(t.id);
    void Promise.resolve(a.play()).catch(() => {
      setPlaying(null);
      setError('This track could not be played. Try another.');
    });
  }

  function pick(t: MusicTrack) {
    const st = useEditor.getState();
    st.addTrack(t);
    st.apply((d) => ({
      ...d,
      music: { provider: 'jamendo', trackId: t.id, volume: d.music?.volume ?? DEFAULT_VOLUME },
    }));
  }

  const setVolume = (v: number) =>
    useEditor.getState().preview((d) => ({ ...d, music: d.music && { ...d.music, volume: v } }));

  return (
    <fieldset disabled={hasVideo} className="flex min-w-0 flex-col gap-4 disabled:opacity-60">
      <legend className="sr-only">Background music</legend>
      {hasVideo && (
        <p role="note" className="rounded-md bg-surface px-3 py-2 text-body-sm font-medium text-foreground">
          {MUSIC_VIDEO_CONFLICT}. A note with a video plays the video’s own sound.
        </p>
      )}
      {music && (
        <section aria-label="Music on this note" className="flex flex-col gap-3 rounded-xl border border-border p-3">
          <div className="flex items-center gap-3">
            {picked?.cover ? (
              <img src={picked.cover} alt="" className="size-12 shrink-0 rounded-md object-cover" />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-surface">
                <Music className="size-5 text-muted-foreground" aria-hidden="true" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body-sm font-semibold">{picked?.title || 'Chosen track'}</span>
              <span className="block truncate text-caption text-muted-foreground">{picked?.artist}</span>
            </span>
          </div>
          <label className="flex flex-col gap-1 text-body-sm">
            <span className="flex justify-between">
              <span className="font-semibold">Volume</span>
              <span className="text-muted-foreground tabular-nums">{volume}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              onPointerUp={() => useEditor.getState().commit()}
              onKeyUp={() => useEditor.getState().commit()}
              onBlur={() => useEditor.getState().commit()}
              className="accent-primary"
            />
          </label>
          {picked && <MusicCredit track={picked} />}
          <div>
            <ConfirmButton label="Remove music" onConfirm={removeMusic} focusMain={false} />
          </div>
        </section>
      )}
      <form role="search" onSubmit={onSubmit} className="relative">
        <label htmlFor="music-search" className="sr-only">
          Search free music
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id="music-search"
          type="search"
          value={q}
          maxLength={100}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search free music"
          className="h-10 w-full rounded-full border border-input bg-surface pr-3 pl-9 text-body-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/25"
        />
      </form>
      <label className="flex min-h-8 items-center gap-3 text-body-sm">
        <input
          type="checkbox"
          checked={instrumental}
          onChange={(e) => setInstrumental(e.target.checked)}
          className="size-5 accent-primary"
        />
        Instrumental only
      </label>
      <p className="text-caption text-muted-foreground">
        Free Creative Commons tracks from{' '}
        <a href="https://www.jamendo.com" target="_blank" rel="noreferrer noopener" className="font-semibold underline">
          Jamendo
        </a>
        . Readers hear a track only when they press play.
      </p>
      {error && (
        <p role="alert" className="text-body-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {busy && !results?.length && (
        <p role="status" className="text-body-sm text-muted-foreground">
          Searching…
        </p>
      )}
      {!busy && results && !results.length && !error && (
        <p className="text-body-sm text-muted-foreground">No tracks found. Try another word.</p>
      )}
      {results && results.length > 0 && (
        <ul aria-label="Search results" className="flex flex-col gap-1">
          {results.map((t) => (
            <li key={t.id} className="flex items-center gap-2">
              <button
                type="button"
                aria-label={`${playing === t.id ? 'Pause' : 'Play'} preview of ${t.title}`}
                aria-pressed={playing === t.id}
                onClick={() => toggle(t)}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface transition-colors duration-(--duration-fast) hover:bg-surface-strong focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {playing === t.id ? (
                  <Pause className="size-4" aria-hidden="true" />
                ) : (
                  <Play className="size-4" aria-hidden="true" />
                )}
              </button>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-sm font-semibold">{t.title}</span>
                <span className="block truncate text-caption text-muted-foreground">
                  {t.artist} · {mmss(t.duration)}
                </span>
              </span>
              <Button
                type="button"
                size="sm"
                variant={music?.trackId === t.id ? 'secondary' : 'default'}
                aria-label={`Use ${t.title}`}
                aria-pressed={music?.trackId === t.id}
                onClick={() => pick(t)}
              >
                {music?.trackId === t.id ? 'Chosen' : 'Use'}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {more && (
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => void search(query, page + 1)}>
          {busy ? 'Loading…' : 'Show more'}
        </Button>
      )}
    </fieldset>
  );
}
