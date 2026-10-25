// Keeps the AI instruction files in sync and lean. AGENTS.md is the single source for every tool (Codex, Copilot,
// Antigravity read it directly); each CLAUDE.md is exactly `@AGENTS.md`, so Claude Code loads the same text and
// nothing Claude-only can drift in. Relative links in AGENTS.md files and docs/conventions must resolve.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SKIP = new Set(['node_modules', '.git', 'dist', 'coverage', '.vite']);
const ROOT_LIMIT = 4 * 1024; // sent with every request: keep it an index, not a manual

function brokenLinks(file) {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)]
    .map((m) => m[1])
    .filter((t) => !/^[a-z]+:/i.test(t) && !existsSync(path.resolve(path.dirname(file), t)));
}

export function problems(root) {
  const out = [];
  const checked = [];
  const walk = (dir) => {
    const names = readdirSync(dir);
    const has = (f) => names.includes(f);
    const rel = path.relative(root, dir) || '.';
    if (has('CLAUDE.md') && readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8').trim() !== '@AGENTS.md')
      out.push(`${rel}/CLAUDE.md must contain only @AGENTS.md`);
    if (has('CLAUDE.md') !== has('AGENTS.md')) out.push(`${rel}: CLAUDE.md and AGENTS.md must exist together`);
    if (has('AGENTS.md')) checked.push(path.join(dir, 'AGENTS.md'));
    for (const n of names) {
      const p = path.join(dir, n);
      if (!SKIP.has(n) && !n.startsWith('.') && statSync(p).isDirectory()) walk(p);
    }
  };
  walk(root);
  const conventions = path.join(root, 'docs', 'conventions');
  if (existsSync(conventions))
    for (const f of readdirSync(conventions)) if (f.endsWith('.md')) checked.push(path.join(conventions, f));
  for (const f of checked)
    for (const link of brokenLinks(f)) out.push(`${path.relative(root, f)}: broken link ${link}`);
  const rootAgents = path.join(root, 'AGENTS.md');
  if (!existsSync(rootAgents)) out.push('root AGENTS.md is missing');
  else if (statSync(rootAgents).size > ROOT_LIMIT)
    out.push('root AGENTS.md is over 4 KiB: move detail into docs/conventions');
  return out;
}

if (import.meta.main) {
  const found = problems(path.resolve(import.meta.dirname, '..'));
  for (const p of found) console.error(`agents-sync: ${p}`);
  process.exit(found.length ? 1 : 0);
}
