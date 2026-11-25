// CRAP gate (R26 cage, issue #151). CRAP = CC^2 * (1 - coverage)^3 + CC per function (unclebob/crapper), computed
// from a vitest v8 `coverage-final.json`: CC = 1 + sum(paths - 1) over the branches inside the function, coverage =
// covered share of its statements. Fails when a function touched by the diff scores above the cap.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const crap = (cc, coverage) => cc * cc * (1 - coverage) ** 3 + cc;

const inside = (l, fn) => l.start.line >= fn.start && l.end.line <= fn.end;

export function functionsOf(cov) {
  return Object.values(cov.fnMap).map((f) => {
    const fn = { start: f.loc.start.line, end: f.loc.end.line };
    const cc =
      1 + Object.values(cov.branchMap).reduce((n, b) => n + (inside(b.loc, fn) ? b.locations.length - 1 : 0), 0);
    const stmts = Object.entries(cov.statementMap).filter(([, l]) => inside(l, fn));
    const hit = stmts.filter(([id]) => cov.s[id] > 0).length;
    const coverage = stmts.length ? hit / stmts.length : 1;
    return { name: f.name, ...fn, cc, coverage, crap: crap(cc, coverage) };
  });
}

export function changedLines(diffText) {
  const out = new Map();
  let set = null;
  for (const line of diffText.split('\n')) {
    if (line.startsWith('+++ b/')) out.set(line.slice(6), (set = new Set()));
    else if (line.startsWith('+++ ')) set = null;
    else if (set && line.startsWith('@@')) {
      const m = line.match(/\+(\d+)(?:,(\d+))?/);
      const n = m[2] === undefined ? 1 : Number(m[2]);
      for (let i = 0; i < n; i++) set.add(Number(m[1]) + i);
    }
  }
  return out;
}

export function evaluate(files, changed, root, cap) {
  const bad = [];
  for (const cov of files) {
    const rel = path.relative(root, cov.path).split(path.sep).join('/');
    const lines = changed.get(rel);
    if (!lines) continue;
    for (const f of functionsOf(cov))
      if (f.crap > cap && [...lines].some((l) => l >= f.start && l <= f.end)) bad.push({ file: rel, ...f });
  }
  return bad;
}

if (import.meta.main) {
  const [coverageFile, cap = '30'] = process.argv.slice(2);
  const root = process.cwd();
  const base = process.env.BASE_REF || 'origin/main';
  const diff = execFileSync(
    'git',
    ['diff', '--no-color', '--no-renames', '-U0', `${base}...HEAD`, '--', 'server/src', 'shared/src'],
    {
      encoding: 'utf8',
      maxBuffer: 1 << 28,
    },
  );
  const files = Object.values(JSON.parse(readFileSync(coverageFile, 'utf8')));
  const bad = evaluate(files, changedLines(diff), root, Number(cap));
  for (const f of bad)
    console.error(
      `CRAP ${f.crap.toFixed(1)} > ${cap}: ${f.file}:${f.start} ${f.name} (CC ${f.cc}, coverage ${(f.coverage * 100).toFixed(0)}%)`,
    );
  if (bad.length) process.exit(1);
  console.log(`crap gate: ok (cap ${cap})`);
}
