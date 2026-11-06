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
});
