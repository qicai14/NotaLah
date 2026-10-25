// Keeps the AI instruction files in sync: AGENTS.md is the source of truth for every tool, and each CLAUDE.md
// must import the AGENTS.md beside it (Claude Code reads CLAUDE.md, Codex/Copilot/Antigravity read AGENTS.md).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SKIP = new Set(['node_modules', '.git', 'dist', 'coverage', '.vite']);
const CODEX_LIMIT = 32 * 1024; // Codex stops reading the AGENTS.md chain past 32 KiB

export function problems(root) {
  const out = [];
  const walk = (dir) => {
    const names = readdirSync(dir);
    const has = (f) => names.includes(f);
    const rel = path.relative(root, dir) || '.';
    if (has('CLAUDE.md') && !/^@AGENTS\.md\s*$/m.test(readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8')))
      out.push(`${rel}/CLAUDE.md does not import @AGENTS.md`);
    if (has('CLAUDE.md') !== has('AGENTS.md')) out.push(`${rel}: CLAUDE.md and AGENTS.md must exist together`);
    for (const n of names) {
      const p = path.join(dir, n);
      if (!SKIP.has(n) && !n.startsWith('.') && statSync(p).isDirectory()) walk(p);
    }
  };
  walk(root);
  const rootAgents = path.join(root, 'AGENTS.md');
  if (!existsSync(rootAgents)) out.push('root AGENTS.md is missing');
  else if (statSync(rootAgents).size > CODEX_LIMIT / 4) out.push('root AGENTS.md is over 8 KiB: keep it lean');
  return out;
}

if (import.meta.main) {
  const found = problems(path.resolve(import.meta.dirname, '..'));
  for (const p of found) console.error(`agents-sync: ${p}`);
  process.exit(found.length ? 1 : 0);
}
