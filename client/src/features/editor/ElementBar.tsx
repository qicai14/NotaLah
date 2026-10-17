import { FONT_IDS, type FontId, round1, type SlideElement } from '@parp/shared';
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
  Italic,
  List,
  ListOrdered,
  Lock,
  LockOpen,
  Move,
  SquareDashed,
  Strikethrough,
  TextCursorInput,
  Trash2,
  Underline,
} from 'lucide-react';
import { type ReactNode, useEffect, useReducer } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { arrange, selectedElements } from './arrange';
import { type BoxList, type BoxMark, styleWholeBox, wholeBoxHas } from './wholeBox';
import { offsetCopy, useEditor } from './store';

const FONT_NAMES: Record<FontId, string> = {
  'source-sans-3': 'Source Sans 3',
  atkinson: 'Atkinson Hyperlegible',
  lora: 'Lora',
  merriweather: 'Merriweather',
  montserrat: 'Montserrat',
  'jetbrains-mono': 'JetBrains Mono',
};

const field =
  'h-9 rounded-md border border-input bg-background px-2 text-body-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25';

function Tool({
  label,
  onClick,
  pressed,
  disabled,
  children,
}: {
  label: string;
  onClick(): void;
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

function Colour({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) {
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
  onChange(v: number): void;
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
function PositionPopover({ el, update }: { el: SlideElement; update(p: Partial<SlideElement>): void }) {
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
          <select
            aria-label="Font"
            value={el.font}
            onChange={(e) => update({ font: e.target.value as FontId })}
            className={cn(field, 'w-44')}
          >
            {FONT_IDS.map((f) => (
              <option key={f} value={f}>
                {FONT_NAMES[f]}
              </option>
            ))}
          </select>
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
