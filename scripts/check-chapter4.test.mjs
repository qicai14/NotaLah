import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { build, problems } from './check-chapter4.mjs';

const dir = path.join(path.resolve(import.meta.dirname, '..'), 'docs/chapter4');

const temps = [];
const tempDir = () => {
  const d = mkdtempSync(path.join(os.tmpdir(), 'chapter4-'));
  temps.push(d);
  return d;
};

describe('check-chapter4', () => {
  afterEach(() => {
    for (const d of temps.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it('passes on the real repo', () => {
    expect(problems(dir)).toEqual([]);
  });

  it('fails for a hand-edited copy and names the line', () => {
    const copy = path.join(tempDir(), 'CHAPTER4.md');
    writeFileSync(
      copy,
      readFileSync(path.join(dir, 'CHAPTER4.md'), 'utf8').replace(/\r\n/g, '\n').replace('\n\n', '\n\nhand edit\n'),
    );
    expect(problems(dir, copy).join('\n')).toMatch(/line 3.*build_chapter\.py/);
  });

  it('numbers captions and resolves references; a bad stem is a build problem', () => {
    const d = tempDir();
    const parts = [
      '4.1_introduction',
      '4.2.1_use_cases',
      '4.2.3_class_activity_sequence',
      '4.3_database_design',
      '4.4_interface_design',
      '4.5_test_cases',
    ];
    parts.forEach((p) => writeFileSync(path.join(d, `${p}.md`), ''));
    const write = (body) => writeFileSync(path.join(d, '4.1_introduction.md'), body.replace(/\n/g, '\r\n'));
    write(
      'Table [[next]] lists it.\n\n![Figure 4.x: A](png/a.png)\n\n*Figure 4.x: A*\n\nSee Figure [[a]].\n\n*Table 4.x: T*\n',
    );
    const out = build(d);
    expect(out).toContain('Table 4.1 lists it.');
    expect(out).toContain('*Figure 4.1: A*');
    expect(out).toContain('See Figure 4.1.');
    expect(out).not.toContain('\r');
    write('See Figure [[nope]].\n');
    expect(problems(d, path.join(d, 'x.md')).join('\n')).toMatch(/cannot build/);
  });
});
