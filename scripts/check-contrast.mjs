// UI-TC1: every token text/background pair and UI-border pair in client/src/index.css, in both themes.
// Run from the repo root: node scripts/check-contrast.mjs. Prints a Markdown table; exits 1 if a pair is under its limit.
import { readFileSync } from 'node:fs';

const TEXT = 4.5;
const UI = 3;

const css = readFileSync('client/src/index.css', 'utf8');
const tokens = (re) =>
  Object.fromEntries([...css.match(re)[1].matchAll(/--([\w-]+):\s*(#[0-9a-f]{6});/gi)].map((m) => [m[1], m[2]]));
const themes = [tokens(/:root \{([\s\S]*?)\n\}/), tokens(/\.dark \{([\s\S]*?)\n\}/)];

const channel = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
console.assert(Math.abs(ratio('#000000', '#ffffff') - 21) < 1e-9, 'black on white must be 21:1');

const pairs = (fg, bgs, min = TEXT) => bgs.map((bg) => [fg, bg, min]);
const grounds = ['background', 'surface', 'card', 'popover', 'rail', 'secondary', 'accent'];
const all = [
  ...pairs('foreground', [...grounds, 'surface-strong', 'muted', 'editor-canvas']),
  ...pairs('muted-foreground', [...grounds, 'surface-strong', 'muted']),
  ...pairs('card-foreground', ['card']),
  ...pairs('popover-foreground', ['popover']),
  ...pairs('secondary-foreground', ['secondary']),
  ...pairs('accent-foreground', ['accent']),
  ...pairs('primary-foreground', ['primary']),
  ...pairs('destructive-foreground', ['destructive']),
  ...pairs('primary', ['background', 'surface', 'card', 'popover', 'rail', 'accent']),
  ...pairs('primary', ['surface-strong'], UI), // only the pressed icon in ElementBar
  ...pairs('destructive', ['background', 'surface', 'card', 'popover']),
  ...pairs('success', ['background', 'surface', 'card', 'popover']),
  ...pairs('like', ['background', 'surface', 'card'], UI), // the filled heart, an icon
  ...pairs('input', ['background', 'surface', 'popover', 'card'], UI),
  ...pairs('ring', ['background', 'surface', 'card', 'popover', 'surface-strong'], UI),
  ...pairs('editor-guide', ['slide'], UI),
];

let failed = 0;
console.log('| Pair | Min | Light | Dark | Result |\n|---|---|---|---|---|');
for (const [fg, bg, min] of all) {
  const [light, dark] = themes.map((t) => ratio(t[fg], t[bg]));
  const pass = light >= min && dark >= min;
  if (!pass) failed++;
  console.log(`| ${fg} on ${bg} | ${min} | ${light.toFixed(2)} | ${dark.toFixed(2)} | ${pass ? 'pass' : 'FAIL'} |`);
}
console.log(`\n${all.length} pairs, ${failed} under the limit`);
process.exit(failed ? 1 : 0);
