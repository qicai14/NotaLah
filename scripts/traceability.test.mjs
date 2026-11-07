import { describe, expect, it } from 'vite-plus/test';
import { matrix } from './traceability.mjs';

const md = [
  '| TC ID | d | t | e | Actual | Pass |',
  '| AUTH-TC1 | d | t | e | ok | Pass |',
  '| AUTH-TC2 | d | t | e | ok | Fail |',
  '| SRCH-TC10 | d | t | e | ok | Pass |',
  '| UAT-S4 | Student | task | b | t | 20 | Y | c |',
  '| UAT-S5 | Student | task | b | t | | | |',
].join('\n');

describe('traceability', () => {
  it('counts passing TCs by prefix or exact ID and joins the UAT result', () => {
    const r = matrix({ FR1: ['f', ['AUTH-TC1', 'SRCH-TC10'], ['UAT-S4', 'UAT-S5']] }, md);
    expect(r.gaps).toEqual([]);
    expect(r.md).toContain('| FR1 | f | 2 of 2 (AUTH-TC1, SRCH-TC10) | UAT-S4: Y; UAT-S5: pending |');
  });

  it('reports a requirement with no passing TC', () => {
    const r = matrix({ NFR2: ['f', ['UI'], []], FR9: ['f', ['AUTH-TC2'], []] }, md);
    expect(r.gaps).toEqual([
      'NFR2: no passing TC (UI; 0 matched)',
      'FR9: no passing TC (AUTH-TC2; 1 matched)',
      'FR9: failing TC AUTH-TC2',
    ]);
    expect(matrix({ FR2: ['f', ['AUTH'], []] }, md).gaps).toEqual(['FR2: failing TC AUTH-TC2']);
  });
});
