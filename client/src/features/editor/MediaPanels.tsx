import { boardHeight, type ImageSource, LIMITS } from '@parp/shared';
import { ImageUp, LoaderCircle, Search } from 'lucide-react';
import { type FormEvent, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api, apiOrigin, ApiError, errorText } from '@/lib/api';
import { usePaged } from '@/lib/usePaged';
import { cn } from '@/lib/utils';
import { makeImage } from './elements';
import { useEditor } from './store';

export interface UploadedImage {
  id: number;
  width: number | null;
  height: number | null;
  url: string;
}

interface UnsplashPhoto {
  photoId: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  alt: string;
  authorName: string;
  authorUrl: string;
}

/** JPEG, PNG, WebP or GIF; the server re-encodes to WebP and checks the real type (D54). */
export const IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/gif';
const MAX_BYTES = 5 * 1024 * 1024;

/** Sends one image as multipart (the JSON `api` helper cannot), with the CSRF header every write needs (D35). */
export async function uploadImage(file: File): Promise<UploadedImage> {
  if (file.size > MAX_BYTES) throw new ApiError(413, 'Image must be at most 5 MB');
  const body = new FormData();
  body.append('file', file);
  let res: Response;
  try {
    res = await fetch(`${apiOrigin()}/api/assets/images`, {
      method: 'POST',
      headers: { 'X-Requested-With': 'parp' },
      credentials: 'include',
      body,
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Please try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Upload failed. Please try again.');
  return data.asset as UploadedImage;
}

const absolute = (url: string) => (url.startsWith('/') ? apiOrigin() + url : url);

/** Places an image on the active slide; false when the slide already holds the most images the server allows. */
function insert(source: ImageSource, width: number | null, height: number | null, alt = ''): boolean {
  const st = useEditor.getState();
  const images = st.deck.slides[st.activeSlide].elements.filter((e) => e.type === 'image').length;
  if (images >= LIMITS.imagesPerSlide) return false;
  st.addElement(makeImage(boardHeight(st.deck.aspect), source, width ?? 800, height ?? 600, alt));
  return true;
}
const FULL = `A slide holds at most ${LIMITS.imagesPerSlide} images. Add a new slide for more.`;

const tile =
  'group relative block overflow-hidden rounded-md bg-surface outline-none ring-offset-2 ring-offset-background transition-transform duration-(--duration-fast) focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]';

/** Wireframe 24: upload from the device, then pick from every image this account has uploaded. */
export function UploadsPanel({ onAdd }: { onAdd?: () => void }) {
  const mine = usePaged<UploadedImage>('/assets/images', 'assets');
  const [added, setAdded] = useState<UploadedImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const use = (a: UploadedImage) => {
    useEditor.getState().addAsset(a.id, a.url);
    if (!insert({ kind: 'upload', assetId: a.id }, a.width, a.height)) return setError(FULL);
    onAdd?.();
  };

  async function send(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const a = await uploadImage(file);
      setAdded((list) => [a, ...list]);
      use(a);
    } catch (e) {
      setError(`${file.name} was not added. ${errorText(e)}`);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  const seen = new Set(added.map((a) => a.id));
  const all = [...added, ...mine.items.filter((a) => !seen.has(a.id))];
  return (
    <div className="flex flex-col gap-4">
      <label
        className={cn(
          'flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-input px-4 py-6 text-center transition-colors duration-(--duration-fast) hover:border-primary hover:bg-surface has-focus-visible:ring-[3px] has-focus-visible:ring-ring/25',
          busy && 'pointer-events-none opacity-60',
        )}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void send(e.dataTransfer.files[0]);
        }}
      >
        {busy ? (
          <LoaderCircle className="size-6 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <ImageUp className="size-6 text-primary" aria-hidden="true" />
        )}
        <span className="text-body-sm font-semibold">{busy ? 'Uploading…' : 'Upload an image'}</span>
        <span className="text-caption text-muted-foreground">
          JPEG, PNG, WebP or GIF, up to 5 MB. Or drop one here.
        </span>
        <input
          ref={input}
          type="file"
          accept={IMAGE_TYPES}
          className="sr-only"
          disabled={busy}
          onChange={(e) => void send(e.target.files?.[0])}
        />
      </label>
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-body-sm font-medium text-destructive">
          {error}
        </p>
      )}
      <section className="flex flex-col gap-2">
        <h3 className="text-body-sm font-semibold text-muted-foreground">Your uploads</h3>
        {mine.loading && !all.length && (
          <p role="status" className="text-body-sm text-muted-foreground">
            Loading…
          </p>
        )}
        {mine.error && (
          <p role="alert" className="text-body-sm font-medium text-destructive">
            {mine.error}
          </p>
        )}
        {!mine.loading && !mine.error && !all.length && (
          <p className="text-body-sm text-muted-foreground">Nothing yet. Images you upload appear here for any note.</p>
        )}
        <ul className="grid grid-cols-2 gap-2">
          {all.map((a) => (
            <li key={a.id}>
              <button type="button" className={cn(tile, 'aspect-square w-full')} onClick={() => use(a)}>
                <img src={absolute(a.url)} alt="" loading="lazy" className="size-full object-cover" draggable={false} />
                <span className="sr-only">Add upload {a.id}</span>
              </button>
            </li>
          ))}
        </ul>
        {mine.hasMore && (
          <Button variant="secondary" size="sm" disabled={mine.loadingMore} onClick={mine.loadMore}>
            {mine.loadingMore ? 'Loading…' : 'Show more'}
          </Button>
        )}
      </section>
    </div>
  );
}

/**
 * Wireframe 21: Unsplash search through the server proxy. Every result and every placed photo credits its
 * photographer, and placing one reports a download to Unsplash, as its API terms require.
 */
export function PhotosPanel({ onAdd }: { onAdd?: () => void }) {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [results, setResults] = useState<UnsplashPhoto[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search(text: string, p: number) {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ results: UnsplashPhoto[]; totalPages: number }>(
        `/unsplash/search?q=${encodeURIComponent(text)}&page=${p}`,
      );
      setResults((prev) => (p === 1 ? r.results : [...prev, ...r.results]));
      setTotalPages(r.totalPages);
      setQuery(text);
      setPage(p);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 503 ? 'Photo search is not available right now.' : errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (q.trim()) void search(q.trim(), 1);
  }

  function place(p: UnsplashPhoto) {
    setError(null);
    const placed = insert(
      { kind: 'unsplash', photoId: p.photoId, url: p.url, authorName: p.authorName, authorUrl: p.authorUrl },
      p.width,
      p.height,
      p.alt,
    );
    if (!placed) return setError(FULL);
    void api(`/unsplash/${encodeURIComponent(p.photoId)}/download`, { method: 'POST' }).catch(() => {});
    onAdd?.();
  }

  return (
    <div className="flex flex-col gap-4">
      <form role="search" onSubmit={onSubmit} className="relative">
        <label htmlFor="photo-search" className="sr-only">
          Search free photos
        </label>
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id="photo-search"
          type="search"
          value={q}
          maxLength={100}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search free photos"
          className="h-10 w-full rounded-full border border-input bg-surface pr-3 pl-9 text-body-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-ring/25"
        />
      </form>
      <p className="text-caption text-muted-foreground">
        Photos from{' '}
        <a
          href="https://unsplash.com/?utm_source=notalah&utm_medium=referral"
          target="_blank"
          rel="noreferrer noopener"
          className="font-semibold underline"
        >
          Unsplash
        </a>
        . Each one is credited on the slide.
      </p>
      {error && (
        <p role="alert" className="text-body-sm font-medium text-destructive">
          {error}
        </p>
      )}
      {busy && !results.length && (
        <p role="status" className="text-body-sm text-muted-foreground">
          Searching…
        </p>
      )}
      {!busy && query && !results.length && !error && (
        <p className="text-body-sm text-muted-foreground">No photos for “{query}”. Try a broader word.</p>
      )}
      <ul className="grid grid-cols-2 gap-2">
        {results.map((p) => (
          <li key={p.photoId} className="flex flex-col gap-1">
            <button type="button" className={cn(tile, 'aspect-[4/3] w-full')} onClick={() => place(p)}>
              <img src={p.thumbUrl} alt="" loading="lazy" className="size-full object-cover" draggable={false} />
              <span className="sr-only">Add photo{p.alt ? `: ${p.alt}` : ''}</span>
            </button>
            <a
              href={p.authorUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="truncate text-caption text-muted-foreground underline-offset-2 hover:underline"
            >
              {p.authorName}
            </a>
          </li>
        ))}
      </ul>
      {page < totalPages && results.length > 0 && (
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => void search(query, page + 1)}>
          {busy ? 'Loading…' : 'Show more'}
        </Button>
      )}
    </div>
  );
}
