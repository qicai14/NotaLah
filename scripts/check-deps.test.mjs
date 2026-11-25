import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vite-plus/test';

const root = path.resolve(import.meta.dirname, '..');
const config = path.join(root, '.dependency-cruiser.cjs');
const bin = path.join(root, 'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs');

const temps = [];
const project = (files) => {
  files = { 'tsconfig.depcruise.json': readFileSync(path.join(root, 'tsconfig.depcruise.json'), 'utf8'), ...files };
  const dir = mkdtempSync(path.join(os.tmpdir(), 'depcruise-'));
  temps.push(dir);
  for (const d of ['client/src', 'server/src', 'shared/src']) mkdirSync(path.join(dir, d), { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    writeFileSync(path.join(dir, name), body);
  }
  return dir;
};
const cruise = (dir) => {
  const r = spawnSync(process.execPath, [bin, 'client/src', 'server/src', 'shared/src', '--config', config], {
    cwd: dir,
    encoding: 'utf8',
  });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
};

afterEach(() => {
  while (temps.length) rmSync(temps.pop(), { recursive: true, force: true });
});

describe('dependency rules (ADR 0102, #153)', () => {
  it('passes a clean layout', () => {
    const dir = project({
      'shared/src/a.ts': 'export const a = 1;',
      'client/src/b.ts': "import { a } from '../../shared/src/a';\nexport const b = a;",
      'server/src/c.ts': "import { a } from '../../shared/src/a';\nexport const c = a;",
    });
    expect(cruise(dir).status).toBe(0);
  });

  it('fails when the client imports the server', () => {
    const dir = project({
      'server/src/c.ts': 'export const c = 1;',
      'client/src/b.ts': "import { c } from '../../server/src/c';\nexport const b = c;",
    });
    const r = cruise(dir);
    expect(r.status).not.toBe(0);
    expect(r.out).toContain('client-not-server');
  });

  it('fails when shared imports the client', () => {
    const dir = project({
      'client/src/b.ts': 'export const b = 1;',
      'shared/src/a.ts': "import { b } from '../../client/src/b';\nexport const a = b;",
    });
    expect(cruise(dir).out).toContain('shared-is-a-leaf');
  });

  it('fails on a circular import', () => {
    const dir = project({
      'server/src/x.ts': "import { y } from './y';\nexport const x = () => y;",
      'server/src/y.ts': "import { x } from './x';\nexport const y = () => x;",
    });
    expect(cruise(dir).out).toContain('no-circular');
  });

  it('fails when production code imports test code', () => {
    const dir = project({
      'server/tests/helper.ts': 'export const h = 1;',
      'server/src/x.ts': "import { h } from '../tests/helper';\nexport const x = h;",
    });
    expect(cruise(dir).out).toContain('no-test-code-in-production');
  });
});
