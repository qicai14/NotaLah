import { FONT_IDS, type FontId, round1, type SlideElement } from '@parp/shared';
import {
  AlignCenter,
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
  Strikethrough,
  Trash2,
  Underline,
} from 'lucide-react';
import { type ReactNode, useEffect, useReducer } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
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

/** The contextual bar above the canvas (wireframes 20 and 23): what it shows follows the selected element. */
export function ElementBar() {
  const el = useEditor((s) => s.deck.slides[s.activeSlide].elements.find((e) => e.id === s.selection) ?? null);
  const tt = useEditor((s) => s.textEditor);
  // Re-render on every TipTap transaction (including selection moves) so the mark buttons show their state.
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!tt) return;
    tt.on('transaction', bump);
    return () => void tt.off('transaction', bump);
  }, [tt]);
  const { updateElement, deleteElement, addElement, apply, activeSlide } = useEditor.getState();

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
  const mark = (name: string, run: () => void) => (
    <Tool label={name} disabled={!tt} pressed={tt?.isActive(name.toLowerCase()) ?? false} onClick={run}>
      {name === 'Bold' ? (
        <Bold />
      ) : name === 'Italic' ? (
        <Italic />
      ) : name === 'Underline' ? (
        <Underline />
      ) : (
        <Strikethrough />
      )}
    </Tool>
  );

  return (
    <div role="toolbar" aria-label="Element" className="flex min-w-max items-center gap-1 px-2">
      {el.type === 'text' && (
        <>
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
          {mark('Bold', () => tt?.chain().focus().toggleBold().run())}
          {mark('Italic', () => tt?.chain().focus().toggleItalic().run())}
          {mark('Underline', () => tt?.chain().focus().toggleUnderline().run())}
          {mark('Strike', () => tt?.chain().focus().toggleStrike().run())}
          <Tool
            label="Bulleted list"
            disabled={!tt}
            pressed={tt?.isActive('bulletList')}
            onClick={() => tt?.chain().focus().toggleBulletList().run()}
          >
            <List />
          </Tool>
          <Tool
            label="Numbered list"
            disabled={!tt}
            pressed={tt?.isActive('orderedList')}
            onClick={() => tt?.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered />
          </Tool>
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
