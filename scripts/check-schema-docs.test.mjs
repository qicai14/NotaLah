import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { problems } from './check-schema-docs.mjs';

const root = path.resolve(import.meta.dirname, '..');
const doc = path.join(root, 'docs/chapter4/4.3_database_design.md');
const migrations = path.join(root, 'server/db/migrations');

function copyOf(edit) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'schema-docs-'));
  const docCopy = path.join(dir, 'doc.md');
  const migCopy = path.join(dir, 'migrations');
  cpSync(migrations, migCopy, { recursive: true });
  writeFileSync(docCopy, edit(readFileSync(doc, 'utf8')));
  return { docCopy, migCopy };
}

describe('check-schema-docs (TC-SCHEMA-01)', () => {
  it('passes on the real repo', () => {
    expect(problems(doc, migrations)).toEqual([]);
  });

  it('fails when a documented column is renamed', () => {
    const { docCopy, migCopy } = copyOf((t) => t.replace('usr_bio', 'usr_biography'));
    const found = problems(docCopy, migCopy).join('\n');
    expect(found).toContain('USER_T.usr_bio');
    expect(found).toContain('USER_T.usr_biography');
  });

  it('fails when a migration column is missing from the doc', () => {
    const { docCopy, migCopy } = copyOf((t) => t.replace(/^\| \| usr_bio \|.*\n/m, ''));
    expect(problems(docCopy, migCopy).join('\n')).toContain('USER_T.usr_bio');
  });

  it('fails on a data type or size mismatch', () => {
    const { docCopy, migCopy } = copyOf((t) =>
      t.replace('| usr_email | VARCHAR | 255 |', '| usr_email | VARCHAR | 250 |'),
    );
    expect(problems(docCopy, migCopy).join('\n')).toContain('USER_T.usr_email');
  });
});
