import { boardHeight, type Fill, type SlideElement } from '@parp/shared';
import {
  ChevronDown,
  ChevronUp,
  Circle,
  Diamond,
  Film,
  ImageIcon,
  Info,
  Layers,
  Lock,
  MoveRight,
  Palette,
  Shapes,
  Square,
  Triangle,
  Type,
  Upload,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { inputClass } from '@/components/Field';
import { cn } from '@/lib/utils';
import type { ModuleRef } from '@/types';
import { HashtagInput } from '../notes/HashtagInput';
import { elementLabel, makeCode, makeLine, makeShape, makeTable, makeText, SHAPES, TEXT_PRESETS } from './elements';
import { PhotosPanel, UploadsPanel } from './MediaPanels';
import { mapSlide, useEditor } from './store';

export type PanelId = 'text' | 'elements' | 'uploads' | 'photos' | 'background' | 'layers' | 'details';

export const PANELS: { id: PanelId; label: string; icon: typeof Type }[] = [
  { id: 'text', label: 'Text', icon: Type },
  { id: 'elements', label: 'Elements', icon: Shapes },
  { id: 'uploads', label: 'Uploads', icon: Upload },
  { id: 'photos', label: 'Photos', icon: ImageIcon },
  { id: 'background', label: 'Background', icon: Palette },
  { id: 'layers', label: 'Layers', icon: Layers },
  { id: 'details', label: 'Details', icon: Info },
];

export const THEMES = [
  ['plain', 'Plain'],
  ['lecture', 'Lecture summary'],
  ['revision', 'Revision sheet'],
  ['howto', 'Step-by-step guide'],
] as const;

/** Background swatches; slide colours belong to the deck, not the app theme. */
const SWATCHES = [
  '#ffffff',
  '#f3f4f6',
  '#fff8e1',
  '#e8f0fe',
  '#e6f4ea',
  '#fde7ef',
  '#15171c',
  '#1e2a78',
  '#0b4f3a',
  '#5b1a32',
];
const GRADIENTS: Fill[] = [
  { kind: 'gradient', from: '#2b37e3', to: '#8a93ff', angle: 135 },
  { kind: 'gradient', from: '#ffe14d', to: '#ff8a4d', angle: 135 },
  { kind: 'gradient', from: '#0b7a4b', to: '#4ad295', angle: 160 },
  { kind: 'gradient', from: '#15171c', to: '#3a3e4b', angle: 180 },
];

const tile =
  'flex items-center justify-center rounded-md bg-surface text-foreground transition-colors duration-(--duration-fast) hover:bg-surface-strong active:scale-[0.97]';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-body-sm font-semibold text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function TextPanel({ onAdd }: { onAdd?: () => void }) {
  const add = (k: keyof typeof TEXT_PRESETS) => {
    useEditor.getState().addElement(makeText(k, boardHeight(useEditor.getState().deck.aspect)));
    onAdd?.();
  };
  return (
    <Section title="Default text styles">
      <button
        type="button"
        className={cn(tile, 'h-16 justify-start px-4 text-title font-bold')}
        onClick={() => add('heading')}
      >
        Add a heading
      </button>
      <button
        type="button"
        className={cn(tile, 'h-12 justify-start px-4 text-title-sm font-semibold')}
        onClick={() => add('subheading')}
      >
        Add a subheading
      </button>
      <button type="button" className={cn(tile, 'h-10 justify-start px-4 text-body-sm')} onClick={() => add('body')}>
        Add body text
      </button>
    </Section>
  );
}

const SHAPE_ICONS = { rect: Square, ellipse: Circle, triangle: Triangle, diamond: Diamond, arrow: MoveRight } as const;

function ElementsPanel({ onAdd }: { onAdd?: () => void }) {
  const h = () => boardHeight(useEditor.getState().deck.aspect);
  const add = (el: SlideElement) => {
    useEditor.getState().addElement(el);
    onAdd?.();
  };
  return (
    <>
      <Section title="Shapes">
        <div className="grid grid-cols-3 gap-2">
          {SHAPES.map(({ shape, label }) => {
            const Icon = SHAPE_ICONS[shape];
            return (
              <button
                key={shape}
                type="button"
                aria-label={`Add ${label.toLowerCase()}`}
                title={label}
                className={cn(tile, 'aspect-square')}
                onClick={() => add(makeShape(shape, h()))}
              >
                <Icon className="size-8 fill-primary/80 text-primary" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </Section>
      <Section title="Blocks">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={cn(tile, 'h-24 flex-col items-start justify-start gap-1 p-3 text-left')}
            onClick={() => add(makeCode(h()))}
          >
            <span className="text-body-sm font-semibold">Code block</span>
            <span className="font-mono text-caption text-muted-foreground">SELECT * FROM</span>
          </button>
          <button
            type="button"
            className={cn(tile, 'h-24 flex-col items-start justify-start gap-1 p-3 text-left')}
            onClick={() => add(makeTable(h()))}
          >
            <span className="text-body-sm font-semibold">Table</span>
            <span className="text-caption text-muted-foreground">Up to 20 rows and 8 columns</span>
          </button>
          <div
            aria-disabled="true"
            className="col-span-2 flex h-14 items-center gap-3 rounded-md border border-dashed border-input px-3 text-muted-foreground"
          >
            <Film className="size-5 shrink-0" aria-hidden="true" />
            <span className="flex flex-col">
              <span className="text-body-sm font-semibold">Video</span>
              <span className="text-caption">Short clips arrive with video uploads.</span>
            </span>
          </div>
        </div>
      </Section>
      <Section title="Lines">
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={cn(tile, 'h-12 text-body-sm')} onClick={() => add(makeLine(h()))}>
            Line
          </button>
          <button type="button" className={cn(tile, 'h-12 text-body-sm')} onClick={() => add(makeLine(h(), true))}>
            Arrow
          </button>
        </div>
      </Section>
    </>
  );
}

function BackgroundPanel() {
  const current = useEditor((s) => s.deck.slides[s.activeSlide].background);
  const set = (fill: Fill) => {
    const { apply, activeSlide } = useEditor.getState();
    apply((d) => mapSlide(d, activeSlide, (s) => ({ ...s, background: fill })));
  };
  const same = (f: Fill) => JSON.stringify(f) === JSON.stringify(current);
  return (
    <>
      <Section title="Colour">
        <div className="grid grid-cols-5 gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Background ${c}`}
              aria-pressed={same({ kind: 'color', color: c })}
              className="aspect-square rounded-full border border-border aria-pressed:ring-2 aria-pressed:ring-primary aria-pressed:ring-offset-2 aria-pressed:ring-offset-background"
              style={{ background: c }}
              onClick={() => set({ kind: 'color', color: c })}
            />
          ))}
          <label className="relative flex aspect-square cursor-pointer items-center justify-center rounded-full border border-dashed border-input text-caption text-muted-foreground">
            <span aria-hidden="true">+</span>
            <span className="sr-only">Custom background colour</span>
            <input
              type="color"
              className="absolute inset-0 cursor-pointer opacity-0"
              value={current.kind === 'color' ? current.color.slice(0, 7) : '#ffffff'}
              onChange={(e) => set({ kind: 'color', color: e.target.value })}
            />
          </label>
        </div>
      </Section>
      <Section title="Gradient">
        <div className="grid grid-cols-4 gap-2">
          {GRADIENTS.map((g, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Gradient ${i + 1}`}
              aria-pressed={same(g)}
              className="aspect-square rounded-md border border-border aria-pressed:ring-2 aria-pressed:ring-primary aria-pressed:ring-offset-2 aria-pressed:ring-offset-background"
              style={{
                background: g.kind === 'gradient' ? `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})` : undefined,
              }}
              onClick={() => set(g)}
            />
          ))}
        </div>
      </Section>
    </>
  );
}

/** Elements top layer first: select one, or move it up and down the stack without dragging. */
function LayersPanel() {
  const elements = useEditor((s) => s.deck.slides[s.activeSlide].elements);
  const selection = useEditor((s) => s.selection);
  if (!elements.length) {
    return <p className="text-body-sm text-muted-foreground">This slide is empty. Add text or an element first.</p>;
  }
  const shift = (from: number, to: number) => {
    const { apply, activeSlide } = useEditor.getState();
    apply((d) =>
      mapSlide(d, activeSlide, (s) => {
        const els = [...s.elements];
        const [moved] = els.splice(from, 1);
        els.splice(to, 0, moved);
        return { ...s, elements: els };
      }),
    );
  };
  const order = elements.map((el, z) => ({ el, z })).reverse();
  return (
    <ol aria-label="Layers, top first" className="flex flex-col gap-1">
      {order.map(({ el, z }) => (
        <li key={el.id} className="flex items-center gap-1">
          <button
            type="button"
            aria-pressed={selection.includes(el.id)}
            onClick={(e) =>
              e.shiftKey || e.ctrlKey || e.metaKey
                ? useEditor.getState().toggleSelect(el.id)
                : useEditor.getState().select(el.id)
            }
            className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md px-3 text-left text-body-sm hover:bg-surface aria-pressed:bg-surface-strong aria-pressed:font-semibold"
          >
            <span className="truncate">{elementLabel(el)}</span>
            {el.locked && <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label="Locked" />}
          </button>
          <button
            type="button"
            aria-label={`Move ${elementLabel(el)} up`}
            disabled={z === elements.length - 1}
            onClick={() => shift(z, z + 1)}
            className="flex size-8 items-center justify-center rounded-md hover:bg-surface disabled:opacity-40"
          >
            <ChevronUp className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={`Move ${elementLabel(el)} down`}
            disabled={z === 0}
            onClick={() => shift(z, z - 1)}
            className="flex size-8 items-center justify-center rounded-md hover:bg-surface disabled:opacity-40"
          >
            <ChevronDown className="size-4" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ol>
  );
}

export interface Details {
  moduleId: string;
  hashtags: string[];
  errors: Record<string, string>;
  modules: ModuleRef[] | undefined;
  modulesError: string | null;
  setModuleId: (v: string) => void;
  /** Co-authors cannot move a note to another module (D44). */
  moduleLocked?: boolean;
  setHashtags: (v: string[]) => void;
}

function DetailsPanel({ d }: { d: Details }) {
  const theme = useEditor((s) => s.deck.theme);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="module" className="text-body-sm font-semibold">
          Module
        </label>
        <select
          id="module"
          value={d.moduleId}
          onChange={(e) => d.setModuleId(e.target.value)}
          disabled={d.moduleLocked}
          aria-invalid={d.errors.moduleId ? true : undefined}
          aria-describedby={d.errors.moduleId ? 'module-error' : undefined}
          className={inputClass}
        >
          <option value="">Select a module</option>
          {d.modules?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.code} — {m.name}
            </option>
          ))}
        </select>
        {d.errors.moduleId && (
          <p id="module-error" role="alert" className="text-body-sm font-medium text-destructive">
            {d.errors.moduleId}
          </p>
        )}
        {d.modulesError && (
          <p role="alert" className="text-body-sm font-medium text-destructive">
            {d.modulesError}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="theme" className="text-body-sm font-semibold">
          Template
        </label>
        <select
          id="theme"
          value={theme}
          onChange={(e) => {
            const v = e.target.value as typeof theme;
            useEditor.getState().apply((dk) => ({ ...dk, theme: v }));
          }}
          className={inputClass}
        >
          {THEMES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <HashtagInput value={d.hashtags} onChange={d.setHashtags} error={d.errors.hashtags} />
    </div>
  );
}

/** `onAdd` lets the phone sheet close once something has been added, so the new element is visible at once. */
export function PanelBody({ id, details, onAdd }: { id: PanelId; details: Details; onAdd?: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      {id === 'text' && <TextPanel onAdd={onAdd} />}
      {id === 'elements' && <ElementsPanel onAdd={onAdd} />}
      {id === 'uploads' && <UploadsPanel onAdd={onAdd} />}
      {id === 'photos' && <PhotosPanel onAdd={onAdd} />}
      {id === 'background' && <BackgroundPanel />}
      {id === 'layers' && <LayersPanel />}
      {id === 'details' && <DetailsPanel d={details} />}
    </div>
  );
}
