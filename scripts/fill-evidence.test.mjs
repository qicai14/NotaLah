import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { collect, fill } from './fill-evidence.mjs';

const xml = readFileSync(path.join(import.meta.dirname, 'fixtures/junit-sample.xml'), 'utf8');
const row = (id, desc = 'd') => `| ${id} | ${desc} | data | expected | | |`;

describe('fill-evidence', () => {
  it('groups tests by leading TC ID', () => {
    expect(collect([xml])).toEqual({
      'AUTH-TC1': { passed: 1, failed: 0, skipped: 0 },
      'AUTH-TC2': { passed: 2, failed: 0, skipped: 0 },
      'MSG-TC1': { passed: 0, failed: 1, skipped: 0 },
      'RANK-TC12': { passed: 1, failed: 0, skipped: 0 },
      'STO-TC12': { passed: 0, failed: 0, skipped: 1 },
    });
  });

  it('fills Actual and Pass: all-pass, several tests, a failure, a retired row, and reports blanks', () => {
    const md = [
      '## t',
      row('AUTH-TC1'),
      row('AUTH-TC2'),
      row('MSG-TC1'),
      row('NOTE-TC47', 'x (retired in R21c)'),
      row('ENG-TC9'),
    ].join('\r\n');
    const r = fill(md, collect([xml]));
    const lines = r.md.split('\r\n');
    expect(lines[1]).toBe('| AUTH-TC1 | d | data | expected | 1 test passed | Pass |');
    expect(lines[2]).toMatch(/\| All 2 tests passed \| Pass \|$/);
    expect(lines[3]).toMatch(/\| 1 of 1 test failed \| Fail \|$/);
    expect(lines[4]).toMatch(/\| Retired, not run \| N\/A \|$/);
    expect(lines[5]).toBe(row('ENG-TC9'));
    expect(r.blank).toEqual(['ENG-TC9']);
    expect(r.filled).toBe(4);
  });

  it('keeps human evidence, fills a blank Pass only from JUnit, marks skipped opt-in rows, leaves the rest blank', () => {
    const md = [
      '| SRCH-TC23 | d | data | expected | measured 742 ms | Fail |',
      '| UI-TC2 | d | data | expected | axe clean | |',
      '| AUTH-TC1 | d | data | expected | measured by hand | |',
      '| STO-TC12 | Live smoke (opt-in) | data | expected | | |',
      '| STO-TC13 | plain row | data | expected | | |',
      '| AUTH-TC2 | d | data | expected | 1 test passed | Pass |',
    ].join('\n');
    const r = fill(md, { ...collect([xml]), 'STO-TC13': { passed: 0, failed: 0, skipped: 1 } });
    const l = r.md.split('\n');
    expect(l[0]).toBe('| SRCH-TC23 | d | data | expected | measured 742 ms | Fail |');
    expect(l[1]).toBe('| UI-TC2 | d | data | expected | axe clean | |');
    expect(l[2]).toBe('| AUTH-TC1 | d | data | expected | measured by hand | Pass |');
    expect(l[3]).toMatch(/\| Skipped \(opt-in live test\) \| N\/A \|$/);
    expect(l[5]).toMatch(/\| All 2 tests passed \| Pass \|$/);
    expect(r.blank).toEqual(['UI-TC2', 'STO-TC13']);
  });
});
