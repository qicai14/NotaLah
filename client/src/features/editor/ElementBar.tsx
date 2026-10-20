import {
  CODE_LANGS,
  type CodeLang,
  type El,
  FONT_IDS,
  FONT_NAMES,
  type FontId,
  LIMITS,
  round1,
  type SlideElement,
} from '@notalah/shared';
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignHorizontalSpaceAround,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  Copy,
  Crop,
  FlipHorizontal2,
  FlipVertical2,
  Italic,
  List,
  ListOrdered,
  Lock,
  LockOpen,
  Minus,
  Moon,
  Move,
  Plus,
  SquareDashed,
  Strikethrough,
  Sun,
  TableProperties,
  TextCursorInput,
  TextQuote,
  Trash2,
  Underline,
} from 'lucide-react';
import { type ReactNode, useEffect, useReducer } from 'react';
import { FONT_STACK } from '@/components/board/geometry';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { arrange, selectedElements } from './arrange';
import { type BoxList, type BoxMark, styleWholeBox, wholeBoxHas } from './wholeBox';
import { CODE_LANG_NAMES, resizeTable } from './elements';
import { offsetCopy, patchElement, useEditor } from './store';

const field =
  'h-9 rounded-md border border-input bg-background px-2 text-body-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25';

/** The curated fonts only (the schema rejects any other); each name is drawn in its own face. */
function FontSelect({
  value,
  onChange,
  className,
}: {
  value: FontId;
  onChange: (f: FontId) => void;
  className: string;
}) {
  return (
    <select
      aria-label="Font"
      value={value}
      onChange={(e) => onChange(e.target.value as FontId)}
      className={cn(field, className)}
      style={{ fontFamily: FONT_STACK[value] }}
    >
      {FONT_IDS.map((f) => (
        <option key={f} value={f} style={{ fontFamily: FONT_STACK[f] }}>
          {FONT_NAMES[f]}
        </option>
      ))}
    </select>
  );
}

function Tool({
  label,
  onClick,
  pressed,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      // Keep focus (and TipTap's text selection) where it is.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn('rounded-md', pressed && 'bg-surface-strong text-primary')}
    >
      {children}
    </Button>
  );
}

function Colour({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label
      className="relative flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-accent"
      title={label}
    >
      <span className="sr-only">{label}</span>
      <span className="size-5 rounded-full border border-border" style={{ background: value }} aria-hidden="true" />
      <input
        type="color"
        value={value.slice(0, 7)}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}

function Num({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  className,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  return (
    <label className="flex items-center gap-1.5 text-caption text-muted-foreground">
      <span className={className}>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={round1(value)}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (e.target.value !== '' && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className={cn(field, 'w-16 tabular-nums text-foreground')}
      />
    </label>
  );
}

const Sep = () => <span className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden="true" />;

/** Exact position, size and angle: the keyboard and single-pointer alternative to dragging (WCAG 2.5.7). */
function PositionPopover({ el, update }: { el: SlideElement; update: (p: Partial<SlideElement>) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="rounded-md">
          <Move aria-hidden="true" />
          Position
        </Button>
      </PopoverTrigger>
      <PopoverContent className="grid w-64 grid-cols-2 gap-3 rounded-xl p-4 shadow-(--shadow-float)">
        <Num label="X" value={el.x} min={-1000} max={2778} onChange={(x) => update({ x })} className="w-6" />
        <Num label="Y" value={el.y} min={-1000} max={2778} onChange={(y) => update({ y })} className="w-6" />
        <Num label="W" value={el.w} min={8} max={4000} onChange={(w) => update({ w })} className="w-6" />
        <Num label="H" value={el.h} min={8} max={4000} onChange={(h) => update({ h })} className="w-6" />
        <Num
          label="Angle"
          value={el.rotation}
          min={0}
          max={359}
          onChange={(rotation) => update({ rotation })}
          className="w-6"
        />
        <Num
          label="Opacity"
          value={Math.round(el.opacity * 100)}
          min={0}
          max={100}
          onChange={(o) => update({ opacity: o / 100 })}
          className="w-6"
        />
      </PopoverContent>
    </Popover>
  );
}

const ALIGN = [
  ['left', 'Align left', AlignStartVertical],
  ['center', 'Align centres', AlignCenterVertical],
  ['right', 'Align right', AlignEndVertical],
  ['top', 'Align top', AlignStartHorizontal],
  ['middle', 'Align middles', AlignCenterHorizontal],
  ['bottom', 'Align bottom', AlignEndHorizontal],
] as const;

/**
 * Align and distribute. Several elements line up on their shared frame; one element lines up on the slide.
 * Distribute needs three or more.
 */
function ArrangePopover({ several }: { several: boolean }) {
  const count = useEditor((s) => s.selection.length);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="rounded-md">
          <AlignHorizontalSpaceAround aria-hidden="true" />
          Arrange
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-72 flex-col gap-3 rounded-xl p-4 shadow-(--shadow-float)">
        <p className="text-body-sm font-semibold">{several ? 'Align to each other' : 'Align to slide'}</p>
        <div className="grid grid-cols-6 gap-1">
          {ALIGN.map(([to, label, Icon]) => (
            <Tool key={to} label={label} onClick={() => arrange(to)}>
              <Icon />
            </Tool>
          ))}
        </div>
        {several && (
          <>
            <p className="text-body-sm font-semibold">Space evenly</p>
            <div className="flex gap-1">
              <Button type="button" variant="secondary" size="sm" disabled={count < 3} onClick={() => arrange('x')}>
                <AlignHorizontalDistributeCenter aria-hidden="true" />
                Across
              </Button>
              <Button type="button" variant="secondary" size="sm" disabled={count < 3} onClick={() => arrange('y')}>
                <AlignVerticalDistributeCenter aria-hidden="true" />
                Down
              </Button>
            </div>
            {count < 3 && <p className="text-caption text-muted-foreground">Select three or more to space them.</p>}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Opens a code block or table for typing, as a second tap or Enter on it does. */
function OpenButton({ id, label, locked }: { id: string; label: string; locked: boolean }) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled={locked}
      onClick={() => useEditor.getState().setEditing(id)}
      className="rounded-md"
    >
      <TextCursorInput aria-hidden="true" />
      {label}
    </Button>
  );
}

function Stepper({
  what,
  one,
  n,
  max,
  set,
}: {
  what: string;
  one: string;
  n: number;
  max: number;
  set: (v: number) => void;
}) {
  return (
    <span className="flex items-center gap-0.5" role="group" aria-label={what}>
      <Tool label={`Remove a ${one}`} disabled={n <= 1} onClick={() => set(n - 1)}>
        <Minus />
      </Tool>
      <span className="min-w-16 text-center text-caption text-muted-foreground tabular-nums" aria-live="polite">
        {n} {n === 1 ? one : what.toLowerCase()}
      </span>
      <Tool label={`Add a ${one}`} disabled={n >= max} onClick={() => set(n + 1)}>
        <Plus />
      </Tool>
    </span>
  );
}

function TableTools({ el, update }: { el: El<'table'>; update: (p: Partial<SlideElement>) => void }) {
  const rows = el.cells.length;
  const cols = el.cells[0].length;
  const resize = (r: number, c: number) => {
    const cells = resizeTable(el.cells, r, c);
    if (cells) update({ cells });
  };
  return (
    <>
      <Stepper what="Rows" one="row" n={rows} max={LIMITS.tableRows} set={(r) => resize(r, cols)} />
      <Stepper what="Columns" one="column" n={cols} max={LIMITS.tableCols} set={(c) => resize(rows, c)} />
      <Tool label="Header row" pressed={el.headerRow} onClick={() => update({ headerRow: !el.headerRow })}>
        <TableProperties />
      </Tool>
      <Sep />
      <FontSelect value={el.font} onChange={(font) => update({ font })} className="w-36" />
      <Num label="Size" value={el.size} min={8} max={120} onChange={(size) => update({ size })} className="sr-only" />
      <Colour label="Text colour" value={el.color} onChange={(color) => update({ color })} />
      <Colour label="Border colour" value={el.borderColor} onChange={(borderColor) => update({ borderColor })} />
      <OpenButton id={el.id} label="Edit cells" locked={el.locked} />
      <Sep />
    </>
  );
}

const pct = (n: number) => Math.round(n * 100);
/** The photo's own height-to-width ratio, recovered from the frame and the crop, so cropping never stretches it. */
const photoRatio = (el: El<'image'>) => (el.h / el.w) * (el.crop.w / el.crop.h);

/** Crop trims each side; the frame's height follows so the photo keeps its proportions. */
function CropPopover({ el, update }: { el: El<'image'>; update: (p: Partial<SlideElement>) => void }) {
  const c = el.crop;
  const trims = { left: c.x, top: c.y, right: 1 - c.x - c.w, bottom: 1 - c.y - c.h };
  const set = (side: keyof typeof trims, value: number) => {
    const t = { ...trims, [side]: value / 100 };
    const w = Math.max(0.1, 1 - t.left - t.right);
    const h = Math.max(0.1, 1 - t.top - t.bottom);
    const crop = { x: Math.min(t.left, 1 - w), y: Math.min(t.top, 1 - h), w, h };
    const height = round1(el.w * photoRatio(el) * (h / w));
    useEditor.getState().preview((d) => patchElement(d, useEditor.getState().activeSlide, el.id, { crop, h: height }));
  };
  return (
    <Popover onOpenChange={(o) => !o && useEditor.getState().commit()}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="rounded-md">
          <Crop aria-hidden="true" />
          Crop
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-64 flex-col gap-3 rounded-xl p-4 shadow-(--shadow-float)">
        {(['left', 'right', 'top', 'bottom'] as const).map((side) => (
          <label key={side} className="flex flex-col gap-1 text-body-sm">
            <span className="flex justify-between">
              <span className="font-semibold capitalize">Trim {side}</span>
              <span className="text-muted-foreground tabular-nums">{pct(trims[side])}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={45}
              value={pct(trims[side])}
              onChange={(e) => set(side, Number(e.target.value))}
              className="accent-primary"
            />
          </label>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => update({ crop: { x: 0, y: 0, w: 1, h: 1 }, h: round1(el.w * photoRatio(el)) })}
        >
          Reset crop
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function AltPopover({ el }: { el: El<'image'> }) {
  return (
    <Popover onOpenChange={(o) => !o && useEditor.getState().commit()}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="rounded-md">
          <TextQuote aria-hidden="true" />
          Alt text
          {!el.alt && <span className="size-1.5 rounded-full bg-destructive" aria-label="(missing)" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-80 flex-col gap-2 rounded-xl p-4 shadow-(--shadow-float)">
        <label htmlFor="alt-text" className="text-body-sm font-semibold">
          Describe this image
        </label>
        <textarea
          id="alt-text"
          rows={3}
          maxLength={LIMITS.altText}
          value={el.alt}
          placeholder="What a reader who cannot see it needs to know"
          onChange={(e) => {
            const alt = e.target.value;
            useEditor.getState().preview((d) => patchElement(d, useEditor.getState().activeSlide, el.id, { alt }));
          }}
          className="w-full resize-none rounded-md border border-input bg-surface px-3 py-2 text-body-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25"
        />
        <p className="text-caption text-muted-foreground tabular-nums">
          {el.alt.length} / {LIMITS.altText}. Screen readers read this out, and search uses it.
        </p>
      </PopoverContent>
    </Popover>
  );
}

function ImageTools({ el, update }: { el: El<'image'>; update: (p: Partial<SlideElement>) => void }) {
  return (
    <>
      <CropPopover el={el} update={update} />
      <Tool label="Flip horizontally" pressed={el.flipX} onClick={() => update({ flipX: !el.flipX })}>
        <FlipHorizontal2 />
      </Tool>
      <Tool label="Flip vertically" pressed={el.flipY} onClick={() => update({ flipY: !el.flipY })}>
        <FlipVertical2 />
      </Tool>
      <Num label="Corner" value={el.radius} min={0} max={500} onChange={(radius) => update({ radius })} />
      <AltPopover el={el} />
      <Sep />
    </>
  );
}

/** The contextual bar above the canvas (wireframes 20 and 23): what it shows follows the selected element. */
export function ElementBar() {
  const count = useEditor((s) => s.selection.length);
  const el = useEditor((s) =>
    s.selection.length === 1
      ? (s.deck.slides[s.activeSlide].elements.find((e) => e.id === s.selection[0]) ?? null)
      : null,
  );
  const tt = useEditor((s) => s.textEditor);
  // Re-render on every TipTap transaction (including selection moves) so the mark buttons show their state.
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!tt) return;
    tt.on('transaction', bump);
    return () => void tt.off('transaction', bump);
  }, [tt]);
  const { updateElement, deleteElement, addElement, addElements, deleteSelected, apply, activeSlide } =
    useEditor.getState();

  if (count > 1) {
    return (
      <div role="toolbar" aria-label="Selection" className="flex min-w-max items-center gap-1 px-2">
        <span className="px-2 text-body-sm font-semibold tabular-nums">{count} selected</span>
        <Sep />
        <ArrangePopover several />
        <Tool label="Duplicate (Ctrl+D)" onClick={() => addElements(selectedElements().map(offsetCopy))}>
          <Copy />
        </Tool>
        <Tool label="Delete" onClick={deleteSelected}>
          <Trash2 />
        </Tool>
        <span className="ml-2 hidden text-caption text-muted-foreground lg:inline">Shift-click to add or remove</span>
      </div>
    );
  }
  if (!el) {
    return (
      <p className="px-3 text-body-sm text-muted-foreground">
        Select an element to edit it, or add one from the panel.
      </p>
    );
  }
  const update = (p: Partial<SlideElement>) => updateElement(el.id, p);
  const reorder = (to: 'front' | 'back') =>
    apply((d) => ({
      ...d,
      slides: d.slides.map((s, i) => {
        if (i !== activeSlide) return s;
        const rest = s.elements.filter((e) => e.id !== el.id);
        return { ...s, elements: to === 'front' ? [...rest, el] : [el, ...rest] };
      }),
    }));
  // An open box styles the selected text; a closed one styles all of its text at once (D43).
  const whole = el.type === 'text' && !tt;
  const html = el.type === 'text' ? el.html : '';
  const scope = whole ? ' (whole box)' : '';
  const toggle = (name: BoxMark | BoxList, pressed: boolean) => {
    if (el.type !== 'text') return;
    if (tt) {
      const c = tt.chain().focus();
      ({
        bold: () => c.toggleBold(),
        italic: () => c.toggleItalic(),
        underline: () => c.toggleUnderline(),
        strike: () => c.toggleStrike(),
        bulletList: () => c.toggleBulletList(),
        orderedList: () => c.toggleOrderedList(),
      })
        [name]()
        .run();
      return;
    }
    // Bold on a closed box is its weight; turning it off also clears bold runs inside, so the box really reads plain.
    if (name === 'bold') {
      update(pressed ? { weight: 400, html: styleWholeBox(html, 'bold', false) } : { weight: 700 });
    } else update({ html: styleWholeBox(html, name, !pressed) });
  };
  const isOn = (name: BoxMark | BoxList) => {
    if (el.type !== 'text') return false;
    if (tt) return tt.isActive(name);
    return name === 'bold' ? el.weight === 700 || wholeBoxHas(html, 'bold') : wholeBoxHas(html, name);
  };
  const styleTool = (name: BoxMark | BoxList, label: string, icon: ReactNode) => {
    const pressed = isOn(name);
    return (
      <Tool label={label + scope} pressed={pressed} onClick={() => toggle(name, pressed)}>
        {icon}
      </Tool>
    );
  };

  return (
    <div role="toolbar" aria-label="Element" className="flex min-w-max items-center gap-1 px-2">
      {el.type === 'text' && (
        <>
          <span
            className={cn(
              'mr-1 flex h-7 shrink-0 items-center gap-1 rounded-sm px-2 text-caption font-semibold whitespace-nowrap',
              whole ? 'bg-surface text-muted-foreground' : 'bg-primary/10 text-primary',
            )}
            title={whole ? 'Press Enter or tap the box again to style part of the text' : undefined}
          >
            {whole ? (
              <SquareDashed className="size-3.5" aria-hidden="true" />
            ) : (
              <TextCursorInput className="size-3.5" aria-hidden="true" />
            )}
            {whole ? 'Whole box' : 'Selected text'}
          </span>
          <FontSelect value={el.font} onChange={(font) => update({ font })} className="w-44" />
          <Num
            label="Size"
            value={el.size}
            min={8}
            max={400}
            onChange={(size) => update({ size })}
            className="sr-only"
          />
          <Colour label="Text colour" value={el.color} onChange={(color) => update({ color })} />
          <Sep />
          {styleTool('bold', 'Bold', <Bold />)}
          {styleTool('italic', 'Italic', <Italic />)}
          {styleTool('underline', 'Underline', <Underline />)}
          {styleTool('strike', 'Strikethrough', <Strikethrough />)}
          {styleTool('bulletList', 'Bulleted list', <List />)}
          {styleTool('orderedList', 'Numbered list', <ListOrdered />)}
          <Sep />
          {(
            [
              ['left', 'Align left', AlignLeft],
              ['center', 'Align centre', AlignCenter],
              ['right', 'Align right', AlignRight],
              ['justify', 'Justify', AlignJustify],
            ] as const
          ).map(([a, label, Icon]) => (
            <Tool key={a} label={label} pressed={el.align === a} onClick={() => update({ align: a })}>
              <Icon />
            </Tool>
          ))}
          <Sep />
        </>
      )}
      {el.type === 'shape' && (
        <>
          <Colour label="Fill colour" value={el.fill ?? '#ffffff'} onChange={(fill) => update({ fill })} />
          <Colour
            label="Border colour"
            value={el.stroke ?? '#111827'}
            onChange={(stroke) => update({ stroke, strokeWidth: el.strokeWidth || 4 })}
          />
          <Num
            label="Border"
            value={el.strokeWidth}
            min={0}
            max={40}
            onChange={(strokeWidth) => update({ strokeWidth })}
          />
          {el.shape === 'rect' && (
            <Num label="Corner" value={el.radius} min={0} max={500} onChange={(radius) => update({ radius })} />
          )}
          <Sep />
        </>
      )}
      {el.type === 'code' && (
        <>
          <select
            aria-label="Code language"
            value={el.language}
            onChange={(e) => update({ language: e.target.value as CodeLang })}
            className={cn(field, 'w-32')}
          >
            {CODE_LANGS.map((l) => (
              <option key={l} value={l}>
                {CODE_LANG_NAMES[l]}
              </option>
            ))}
          </select>
          <Num
            label="Size"
            value={el.size}
            min={8}
            max={120}
            onChange={(size) => update({ size })}
            className="sr-only"
          />
          <Tool
            label={el.theme === 'dark' ? 'Light code theme' : 'Dark code theme'}
            onClick={() => update({ theme: el.theme === 'dark' ? 'light' : 'dark' })}
          >
            {el.theme === 'dark' ? <Sun /> : <Moon />}
          </Tool>
          <OpenButton id={el.id} label="Edit code" locked={el.locked} />
          <Sep />
        </>
      )}
      {el.type === 'table' && <TableTools el={el} update={update} />}
      {el.type === 'image' && <ImageTools el={el} update={update} />}
      {el.type === 'line' && (
        <>
          <Colour label="Line colour" value={el.stroke} onChange={(stroke) => update({ stroke })} />
          <Num
            label="Weight"
            value={el.strokeWidth}
            min={1}
            max={40}
            onChange={(strokeWidth) => update({ strokeWidth })}
          />
          <select
            aria-label="Line style"
            value={el.dash}
            onChange={(e) => update({ dash: e.target.value as 'solid' })}
            className={cn(field, 'w-24')}
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
          <Sep />
        </>
      )}
      <PositionPopover el={el} update={update} />
      <ArrangePopover several={false} />
      <Tool label="Bring to front" onClick={() => reorder('front')}>
        <ArrowUpToLine />
      </Tool>
      <Tool label="Send to back" onClick={() => reorder('back')}>
        <ArrowDownToLine />
      </Tool>
      <Tool label={el.locked ? 'Unlock' : 'Lock'} pressed={el.locked} onClick={() => update({ locked: !el.locked })}>
        {el.locked ? <Lock /> : <LockOpen />}
      </Tool>
      <Tool label="Duplicate (Ctrl+D)" onClick={() => addElement(offsetCopy(el))}>
        <Copy />
      </Tool>
      <Tool label="Delete" disabled={el.locked} onClick={() => deleteElement(el.id)}>
        <Trash2 />
      </Tool>
    </div>
  );
}
