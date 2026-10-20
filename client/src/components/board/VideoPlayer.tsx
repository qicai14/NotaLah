import { createContext, type ReactNode, useContext, useEffect, useId, useRef, useState } from 'react';
import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useActiveSound } from '@/hooks/useActiveSound';
import { useMediaQuery } from '@/hooks/useMediaQuery';

/** Whether the slide holding this video is the carousel's current one; undefined outside a carousel (no playback there). */
export const SlideActive = createContext<boolean | undefined>(undefined);
/** The board's scale, so the controls can be drawn at a constant size on screen. */
export const BoardScale = createContext(1);

const control =
  'pointer-events-auto grid size-11 cursor-pointer place-items-center rounded-full text-media media-shadow transition-transform duration-(--duration-fast) ease-(--ease-out-soft) active:scale-90';

/** Draws a button at a fixed on-screen size inside the scaled board. */
function Pin({ at, children }: { at: 'tl' | 'tr' | 'center'; children: ReactNode }) {
  const s = useContext(BoardScale) || 1;
  const pad = 8 / s;
  const style =
    at === 'center'
      ? { top: '50%', left: '50%', transform: `translate(-50%, -50%) scale(${1 / s})` }
      : {
          top: pad,
          [at === 'tl' ? 'left' : 'right']: pad,
          transformOrigin: `top ${at === 'tl' ? 'left' : 'right'}`,
          transform: `scale(${1 / s})`,
        };
  return (
    <div className="absolute" style={style}>
      {children}
    </div>
  );
}

/**
 * A feed video: muted and inline, plays while at least half of it is on screen and its slide is the current one,
 * pauses otherwise. A tap or the sound button turns sound on, for one video at a time. With reduced motion it shows
 * the poster and waits for the Play button (R29).
 */
export function VideoPlayer({
  src,
  poster,
  loop,
  slideActive,
}: {
  src: string;
  poster: string;
  loop: boolean;
  slideActive: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [started, setStarted] = useState(false);
  /** The browser refused to play it, or it ended: nothing is playing though it should be, so offer Play. */
  const [stalled, setStalled] = useState(false);
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const sound = useActiveSound(useId());
  const playing = slideActive && visible && (!reduced || started);

  const scale = useContext(BoardScale);
  useEffect(() => {
    const node = box.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.intersectionRatio >= 0.5), { threshold: [0, 0.5, 1] });
    // Chrome can report the box as empty before the board's scale transform lands and never revisit it, so start watching a frame later.
    let raf = requestAnimationFrame(() => (raf = requestAnimationFrame(() => io.observe(node))));
    return () => (cancelAnimationFrame(raf), io.disconnect());
  }, [scale]);

  const { release } = sound;
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (playing) node.play()?.catch(() => setStalled(true));
    else {
      if (!node.paused) node.pause();
      release();
      setStalled(false);
      setStarted(false);
    }
  }, [playing, release]);
  useEffect(() => release, [release]);

  const loud = playing && sound.active;
  useEffect(() => {
    if (ref.current) ref.current.muted = !loud;
  }, [loud]);

  const start = () => {
    setStarted(true);
    setStalled(false);
    if (playing) ref.current?.play()?.catch(() => setStalled(true));
  };
  const onScreen = slideActive && visible;
  const toggleSound = () => (loud ? sound.release() : sound.claim());
  return (
    <div ref={box} className="relative size-full">
      <video
        ref={ref}
        src={src}
        poster={poster}
        muted
        playsInline
        preload="none"
        loop={loop}
        aria-label="Video"
        onPlay={() => setStalled(false)}
        onEnded={() => setStalled(true)}
        onClick={playing ? toggleSound : undefined}
        className="size-full bg-surface-strong object-contain"
      />
      <div className="pointer-events-none absolute inset-0">
        {onScreen && (stalled || (reduced && !started)) && (
          <Pin at="center">
            <button type="button" aria-label="Play video" onClick={start} className={control}>
              <Play aria-hidden="true" className="size-8" />
            </button>
          </Pin>
        )}
        {onScreen && reduced && started && !stalled && (
          <Pin at="tl">
            <button type="button" aria-label="Pause video" onClick={() => setStarted(false)} className={control}>
              <Pause aria-hidden="true" className="size-6" />
            </button>
          </Pin>
        )}
        {playing && (
          <Pin at="tr">
            <button
              type="button"
              aria-label="Video sound"
              aria-pressed={loud}
              onClick={toggleSound}
              className={control}
            >
              {loud ? (
                <Volume2 aria-hidden="true" className="size-6" />
              ) : (
                <VolumeX aria-hidden="true" className="size-6" />
              )}
            </button>
          </Pin>
        )}
      </div>
    </div>
  );
}
