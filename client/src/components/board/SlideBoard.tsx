import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Play } from 'lucide-react';
import {
  BOARD_WIDTH,
  boardHeight,
  type Aspect,
  type Fill,
  type ImageSource,
  type Slide,
  type SlideElement,
} from '@parp/shared';
import { apiOrigin } from '@/lib/api';
import { arrowHead, backgroundCss, cropBox, FONT_STACK, fitScale, inReadingOrder, shapePoints } from './geometry';

/** What the board draws; page notes are never shown on it. */
export type BoardSlide = Pick<Slide, 'background' | 'elements'>;
type Assets = Record<string, string>;
type El<T extends SlideElement['type']> = Extract<SlideElement, { type: T }>;

/** The image's URL, or null when an upload is not in the note's asset map (the frame then stays a plain tile). */
const imageUrl = (src: ImageSource, assets: Assets): string | null => {
  if (src.kind === 'unsplash') return src.url;
  const u = assets[String(src.assetId)];
  if (!u) return null;
  return u.startsWith('/') ? apiOrigin() + u : u;
};

/** Unsplash requires a credit next to every photo it supplies. */
const creditsOf = (slide: BoardSlide): { name: string; url: string }[] => {
  const sources: ImageSource[] = [];
  if (slide.background.kind === 'image') sources.push(slide.background.image);
  for (const e of slide.elements) if (e.type === 'image') sources.push(e.source);
  const seen = new Map<string, string>();
  for (const s of sources) if (s.kind === 'unsplash') seen.set(s.authorName, s.authorUrl);
  return [...seen].map(([name, url]) => ({ name, url }));
};

function Background({ fill, assets }: { fill: Fill; assets: Assets }) {
  if (fill.kind !== 'image') return <div className="absolute inset-0" style={{ background: backgroundCss(fill) }} />;
  const url = imageUrl(fill.image, assets);
  return (
    <div className="absolute inset-0 bg-surface-strong">
      {url && <img src={url} alt="" loading="lazy" className="size-full object-cover" draggable={false} />}
      {fill.overlay && <div className="absolute inset-0" style={{ background: fill.overlay }} />}
    </div>
  );
}

export const textBoxStyle = (el: El<'text'>): CSSProperties => ({
  fontFamily: FONT_STACK[el.font],
  fontSize: el.size,
  fontWeight: el.weight,
  color: el.color,
  textAlign: el.align,
  lineHeight: el.lineHeight,
  letterSpacing: el.letterSpacing,
  padding: el.padding,
  background: el.fill,
  textShadow: el.shadow && `${el.shadow.x}px ${el.shadow.y}px ${el.shadow.blur}px ${el.shadow.color}`,
});

function TextBox({ el }: { el: El<'text'> }) {
  const style = textBoxStyle(el);
  // The server sanitised this HTML against the editor allow-list (R21 spec 2.5), so it is safe to inject.
  return (
    <div
      className="board-text size-full overflow-hidden break-words"
      style={style}
      dangerouslySetInnerHTML={{ __html: el.html }}
    />
  );
}

function Shape({ el }: { el: El<'shape'> }) {
  const sw = el.strokeWidth;
  const paint = {
    fill: el.fill ?? 'none',
    stroke: el.stroke ?? 'none',
    strokeWidth: sw,
    strokeLinejoin: 'round' as const,
  };
  let body: ReactNode;
  if (el.shape === 'rect') {
    const r = Math.min(el.radius, (el.w - sw) / 2, (el.h - sw) / 2);
    body = <rect x={sw / 2} y={sw / 2} width={el.w - sw} height={el.h - sw} rx={r} {...paint} />;
  } else if (el.shape === 'ellipse') {
    body = <ellipse cx={el.w / 2} cy={el.h / 2} rx={(el.w - sw) / 2} ry={(el.h - sw) / 2} {...paint} />;
  } else {
    body = <polygon points={shapePoints(el.shape, el.w, el.h, sw / 2)} {...paint} />;
  }
  return (
    <svg width={el.w} height={el.h} className="block overflow-visible" aria-hidden="true">
      {body}
    </svg>
  );
}

/** A line runs along the middle of its box from left to right; rotation gives it any direction. */
function Line({ el }: { el: El<'line'> }) {
  const sw = el.strokeWidth;
  const head = Math.max(sw * 4, 16);
  const y = el.h / 2;
  const x1 = el.startCap === 'arrow' ? head : 0;
  const x2 = el.endCap === 'arrow' ? el.w - head : el.w;
  const dash = el.dash === 'dashed' ? `${sw * 3} ${sw * 2}` : el.dash === 'dotted' ? `0 ${sw * 2}` : undefined;
  return (
    <svg width={el.w} height={el.h} className="block overflow-visible" aria-hidden="true">
      <line
        x1={x1}
        y1={y}
        x2={x2}
        y2={y}
        stroke={el.stroke}
        strokeWidth={sw}
        strokeDasharray={dash}
        strokeLinecap={el.dash === 'dotted' ? 'round' : 'butt'}
      />
      {el.startCap === 'arrow' && <polygon points={arrowHead(0, y, -1, head)} fill={el.stroke} />}
      {el.endCap === 'arrow' && <polygon points={arrowHead(el.w, y, 1, head)} fill={el.stroke} />}
    </svg>
  );
}

function Picture({ el, assets }: { el: El<'image'>; assets: Assets }) {
  const url = imageUrl(el.source, assets);
  const flip = el.flipX || el.flipY ? `scale(${el.flipX ? -1 : 1}, ${el.flipY ? -1 : 1})` : undefined;
  return (
    <div
      className="relative size-full overflow-hidden bg-surface-strong"
      style={{ borderRadius: el.radius, transform: flip }}
    >
      {url && (
        <img
          src={url}
          alt={el.alt}
          loading="lazy"
          draggable={false}
          className="absolute max-w-none"
          style={cropBox(el.w, el.h, el.crop)}
        />
      )}
    </div>
  );
}

function Code({ el }: { el: El<'code'> }) {
  const light = el.theme === 'light';
  return (
    <pre
      className="size-full overflow-hidden"
      data-language={el.language}
      style={{
        margin: 0,
        padding: el.size * 0.8,
        borderRadius: el.size * 0.5,
        fontFamily: FONT_STACK['jetbrains-mono'],
        fontSize: el.size,
        lineHeight: 1.45,
        whiteSpace: 'pre',
        background: light ? 'var(--board-code-light)' : 'var(--board-code-dark)',
        color: light ? 'var(--board-code-light-foreground)' : 'var(--board-code-dark-foreground)',
      }}
    >
      <code className={`language-${el.language}`}>{el.code}</code>
    </pre>
  );
}

function Grid({ el }: { el: El<'table'> }) {
  const cell: CSSProperties = {
    border: `2px solid ${el.borderColor}`,
    padding: el.size * 0.4,
    textAlign: 'left',
  };
  const head = el.headerRow ? el.cells[0] : undefined;
  const rows = el.headerRow ? el.cells.slice(1) : el.cells;
  return (
    <table
      className="size-full"
      style={{
        borderCollapse: 'collapse',
        tableLayout: 'fixed',
        fontFamily: FONT_STACK[el.font],
        fontSize: el.size,
        color: el.color,
      }}
    >
      {head && (
        <thead>
          <tr>
            {head.map((c, i) => (
              <th key={i} scope="col" style={{ ...cell, fontWeight: 700 }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri}>
            {r.map((c, ci) => (
              <td key={ci} style={cell}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Playback is R29; until then a video shows a placeholder tile. */
function VideoTile() {
  return (
    <div
      role="img"
      aria-label="Video"
      className="flex size-full items-center justify-center bg-surface-strong text-muted-foreground"
    >
      <Play aria-hidden="true" style={{ width: '20%', height: '20%' }} />
    </div>
  );
}

function Body({ el, assets }: { el: SlideElement; assets: Assets }) {
  switch (el.type) {
    case 'text':
      return <TextBox el={el} />;
    case 'shape':
      return <Shape el={el} />;
    case 'line':
      return <Line el={el} />;
    case 'image':
      return <Picture el={el} assets={assets} />;
    case 'code':
      return <Code el={el} />;
    case 'table':
      return <Grid el={el} />;
    case 'video':
      return <VideoTile />;
  }
}

/** Editing hooks for `mode="edit"`; the editor owns selection, gestures and the overlay it draws. */
export interface BoardEditing {
  /** Replaces the element's body (the selected text box mounts TipTap here). */
  renderBody?: (el: SlideElement) => ReactNode | undefined;
  onElementPointerDown?: (e: ReactPointerEvent<HTMLDivElement>, el: SlideElement) => void;
  onBackgroundPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  /** Accessible name and focus handling for each element, so the board can be worked from the keyboard. */
  elementLabel?: (el: SlideElement) => string;
  onElementFocus?: (el: SlideElement) => void;
  /** Drawn above the elements, inside the board's coordinate space (selection frame, handles, guides). */
  overlay?: ReactNode;
  boardRef?: Ref<HTMLDivElement>;
  onScale?: (scale: number) => void;
}

/**
 * One slide on its logical board (1000 x H units, R21 spec 1.1), scaled to fit its parent with a CSS transform.
 * The parent sets the size; the board is centred and never cropped. `mode="edit"` adds the editor's hooks.
 */
export function SlideBoard({
  slide,
  aspect,
  mode = 'view',
  assets = {},
  label = 'Slide',
  editing,
}: {
  slide: BoardSlide;
  aspect: Aspect;
  mode?: 'view' | 'edit';
  assets?: Assets;
  label?: string;
  editing?: BoardEditing;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const height = boardHeight(aspect);
  const onScale = editing?.onScale;
  const edit = mode === 'edit' ? editing : undefined;

  useLayoutEffect(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => {
      const s = fitScale(node.clientWidth, node.clientHeight, aspect);
      setScale(s);
      onScale?.(s);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [aspect, onScale]);

  const credits = creditsOf(slide);
  return (
    <div ref={box} className="flex size-full items-center justify-center" data-mode={mode}>
      <div
        role="group"
        aria-roledescription="slide"
        aria-label={label}
        className="relative shrink-0 overflow-hidden rounded-[inherit]"
        style={{
          width: BOARD_WIDTH * scale,
          height: height * scale,
          visibility: scale ? 'visible' : 'hidden',
        }}
      >
        <div
          ref={edit?.boardRef}
          className="absolute top-0 left-0 origin-top-left"
          style={{ width: BOARD_WIDTH, height, transform: `scale(${scale})` }}
        >
          <div className="absolute inset-0" onPointerDown={edit?.onBackgroundPointerDown}>
            <Background fill={slide.background} assets={assets} />
          </div>
          {inReadingOrder(slide.elements).map(({ el, z }) => (
            <div
              key={el.id}
              data-element={el.type}
              data-id={edit ? el.id : undefined}
              tabIndex={edit ? 0 : undefined}
              role={edit ? 'group' : undefined}
              aria-roledescription={edit ? 'element' : undefined}
              aria-label={edit?.elementLabel?.(el)}
              onPointerDown={edit?.onElementPointerDown && ((e) => edit.onElementPointerDown?.(e, el))}
              onFocus={edit?.onElementFocus && ((e) => e.target === e.currentTarget && edit.onElementFocus?.(el))}
              className={edit ? 'absolute touch-none outline-none' : 'absolute'}
              style={{
                left: el.x,
                top: el.y,
                width: el.w,
                height: el.h,
                zIndex: z,
                opacity: el.opacity,
                transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
              }}
            >
              {edit?.renderBody?.(el) ?? <Body el={el} assets={assets} />}
            </div>
          ))}
          {edit?.overlay}
        </div>
        {credits.length > 0 && (
          <p className="absolute bottom-1.5 left-1.5 max-w-[90%] truncate rounded-sm bg-board-credit px-1.5 py-0.5 text-caption text-board-credit-foreground">
            Photo by{' '}
            {credits.map((c, i) => (
              <span key={c.name}>
                {i > 0 && ', '}
                <a href={c.url} target="_blank" rel="noreferrer noopener" className="font-semibold underline">
                  {c.name}
                </a>
              </span>
            ))}{' '}
            on{' '}
            <a
              href="https://unsplash.com/?utm_source=notalah&utm_medium=referral"
              target="_blank"
              rel="noreferrer noopener"
              className="font-semibold underline"
            >
              Unsplash
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
