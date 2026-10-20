import { jamendoStreamUrl } from '@notalah/shared';
import { Music, Pause, Play } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useActiveSound } from '@/hooks/useActiveSound';
import { cn } from '@/lib/utils';
import type { Note } from '@/types';

/**
 * The viewer's background music (R9, FR17): a chip with the track credit and a tap-to-play button, never autoplaying.
 * Starting it takes the app's one sound from any feed video (and the reverse); it pauses when less than half of it is on
 * screen and when it unmounts. A track saved during a Jamendo outage has no details, so it shows a generic credit.
 */
export function MusicChip({ music, className }: { music: NonNullable<Note['music']>; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const [visible, setVisible] = useState(true);
  const { active, claim, release } = useActiveSound(useId());

  useEffect(() => {
    const node = box.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.intersectionRatio >= 0.5), { threshold: [0, 0.5, 1] });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const node = audio.current;
    if (!node) return;
    if (active && visible) {
      node.play()?.catch((e: unknown) => {
        if ((e as Error)?.name !== 'AbortError') release();
      });
    } else {
      node.pause();
      if (active) release();
    }
  }, [active, visible, release]);
  useEffect(() => release, [release]);
  useEffect(() => {
    if (audio.current) audio.current.volume = music.volume / 100;
  }, [music.volume]);

  const Icon = active ? Pause : Play;
  return (
    <div
      ref={box}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full bg-surface p-1 pr-3 text-caption',
        className,
      )}
    >
      <button
        type="button"
        aria-label="Background music"
        aria-pressed={active}
        onClick={() => (active ? release() : claim())}
        className="flex min-w-0 cursor-pointer items-center gap-2 rounded-full pr-1 focus-visible:ring-[3px] focus-visible:ring-ring/25"
      >
        <span className="relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-strong">
          {music.cover ? (
            <img src={music.cover} alt="" className="absolute inset-0 size-full object-cover" />
          ) : (
            <Music aria-hidden="true" className="size-4" />
          )}
          <span className="absolute inset-0 grid place-items-center bg-foreground/40 text-background">
            <Icon aria-hidden="true" className="size-4" />
          </span>
        </span>
        <span className="truncate font-semibold">
          {music.title ? `${music.title} — ${music.artist ?? 'Unknown artist'}` : 'Music from Jamendo'}
        </span>
      </button>
      {music.licenseUrl && (
        <a
          href={music.licenseUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 font-semibold text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          CC licence<span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
      <audio ref={audio} src={jamendoStreamUrl(music.trackId)} preload="none" loop />
    </div>
  );
}
