import { describe, expect, it } from 'vite-plus/test';
import { changedLines, crap, evaluate, functionsOf } from './crap.mjs';

const loc = (sl, el) => ({ start: { line: sl, column: 0 }, end: { line: el, column: 1 } });

// Two functions: f (lines 1-10, one if, 2 statements, 1 hit) and g (lines 12-14, no branches, 1 statement hit).
const cov = {
  path: '/repo/server/src/a.ts',
  fnMap: { 0: { name: 'f', loc: loc(1, 10), decl: loc(1, 1) }, 1: { name: 'g', loc: loc(12, 14), decl: loc(12, 12) } },
  statementMap: { 0: loc(2, 2), 1: loc(5, 5), 2: loc(13, 13) },
  s: { 0: 1, 1: 0, 2: 3 },
  branchMap: { 0: { type: 'if', loc: loc(3, 6), locations: [loc(3, 4), loc(5, 6)] } },
  b: { 0: [1, 0] },
};

describe('crap', () => {
  it('equals CC when fully covered and grows when uncovered', () => {
    expect(crap(5, 1)).toBe(5);
    expect(crap(5, 0)).toBe(30);
    expect(crap(10, 0.5)).toBeCloseTo(100 * 0.125 + 10);
  });
});

describe('functionsOf', () => {
  it('derives complexity from branches and coverage from statements', () => {
    const fns = functionsOf(cov);
    expect(fns).toEqual([
      { name: 'f', start: 1, end: 10, cc: 2, coverage: 0.5, crap: crap(2, 0.5) },
      { name: 'g', start: 12, end: 14, cc: 1, coverage: 1, crap: 1 },
    ]);
  });
});

describe('changedLines', () => {
  it('reads added line ranges per file from a -U0 diff', () => {
    const d =
      'diff --git a/server/src/a.ts b/server/src/a.ts\n+++ b/server/src/a.ts\n@@ -3,0 +4,2 @@\n+x\n+y\n@@ -9 +11 @@\n+z\n';
    expect([...changedLines(d).get('server/src/a.ts')].sort((a, b) => a - b)).toEqual([4, 5, 11]);
  });
});

describe('evaluate', () => {
  it('flags only changed functions above the cap', () => {
    const lines = new Map([['server/src/a.ts', new Set([5])]]);
    expect(evaluate([cov], lines, '/repo', 1.5).map((f) => f.name)).toEqual(['f']);
    expect(evaluate([cov], lines, '/repo', 30)).toEqual([]);
    const other = new Map([['server/src/a.ts', new Set([13])]]);
    expect(evaluate([cov], other, '/repo', 0.5).map((f) => f.name)).toEqual(['g']);
  });
});
