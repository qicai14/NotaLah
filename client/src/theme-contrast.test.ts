import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vite-plus/test';

// Read from disk: Vitest empties CSS imports, `?raw` included.
const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8');

const TEXT = 4.5;
const UI = 3;

const tokens = (re: RegExp) => {
  const block = re.exec(css)?.[1] ?? '';
  return new Map([...block.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1], m[2]]));
};
const themes = [
  ['light', tokens(/:root \{([\s\S]*?)\n\}/)],
  ['dark', tokens(/\.dark \{([\s\S]*?)\n\}/)],
] as const;

const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const pairs = (fg: string, bgs: string[], min = TEXT) => bgs.map((bg) => [fg, bg, min] as const);
const grounds = ['background', 'surface', 'card', 'popover', 'rail', 'secondary', 'accent'];
const ALL = [
  ...pairs('foreground', [...grounds, 'surface-strong', 'muted', 'editor-canvas']),
  ...pairs('muted-foreground', [...grounds, 'surface-strong', 'muted']),
  ...pairs('card-foreground', ['card']),
  ...pairs('popover-foreground', ['popover']),
  ...pairs('secondary-foreground', ['secondary']),
  ...pairs('accent-foreground', ['accent']),
  ...pairs('primary-foreground', ['primary']),
  ...pairs('destructive-foreground', ['destructive']),
  ...pairs('primary', ['background', 'surface', 'card', 'popover', 'rail']),
  // Icons only: the pressed icon in ElementBar, and LecturerBadge in a hovered row. No primary text sits on these.
  ...pairs('primary', ['surface-strong', 'accent'], UI),
  ...pairs('destructive', ['background', 'surface', 'card', 'popover']),
  ...pairs('success', ['background', 'surface', 'card', 'popover']),
  ...pairs('like', ['background', 'surface', 'card'], UI), // the filled heart, an icon
  ...pairs('input', ['background', 'surface', 'popover', 'card'], UI),
  ...pairs('ring', ['background', 'surface', 'card', 'popover', 'surface-strong'], UI),
  ...pairs('editor-guide', ['slide'], UI),
];

describe('theme tokens', () => {
  it('UI-TC1: every text and UI-border pair meets its contrast limit in both themes', () => {
    const problems: string[] = [];
    for (const [theme, values] of themes) {
      for (const [fg, bg, min] of ALL) {
        const [a, b] = [values.get(fg), values.get(bg)];
        if (!a || !b) problems.push(`${theme}: --${a ? bg : fg} is missing from index.css`);
        else if (ratio(a, b) < min)
          problems.push(`${theme}: ${fg} on ${bg} is ${ratio(a, b).toFixed(2)}, needs ${min}`);
      }
    }
    expect(problems).toEqual([]);
    expect(ALL).toHaveLength(53);
  });

  it('UI-TC3: hover fills and hairlines stay visible against the surfaces they sit on', () => {
    for (const [, values] of themes) {
      expect(values.get('accent')).not.toBe(values.get('surface'));
      expect(values.get('accent')).not.toBe(values.get('secondary'));
      expect(values.get('accent')).not.toBe(values.get('background'));
      expect(values.get('border')).not.toBe(values.get('surface-strong'));
      expect(values.get('border')).not.toBe(values.get('surface'));
    }
  });
});
