import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vite-plus/test';
import { docSchema, migrationSchema, problems } from './check-schema-docs.mjs';

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

describe('check-schema-docs', () => {
  it('OPS-TC15 passes on the real repo', () => {
    expect(problems(doc, migrations)).toEqual([]);
  });

  it('OPS-TC16 fails when a documented column is renamed', () => {
    const { docCopy, migCopy } = copyOf((t) => t.replace('usr_bio', 'usr_biography'));
    const found = problems(docCopy, migCopy).join('\n');
    expect(found).toContain('USER_T.usr_bio');
    expect(found).toContain('USER_T.usr_biography');
  });

  it('OPS-TC17 fails when a migration column is missing from the doc', () => {
    const { docCopy, migCopy } = copyOf((t) => t.replace(/^\| \| usr_bio \|.*\n/m, ''));
    expect(problems(docCopy, migCopy).join('\n')).toContain('USER_T.usr_bio');
  });

  it('OPS-TC18 fails on a data type or size mismatch', () => {
    const { docCopy, migCopy } = copyOf((t) =>
      t.replace('| usr_email | VARCHAR | 255 |', '| usr_email | VARCHAR | 250 |'),
    );
    expect(problems(docCopy, migCopy).join('\n')).toContain('USER_T.usr_email');
  });
});

function schemaOf(...statements) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'schema-mig-'));
  writeFileSync(
    path.join(dir, '1_t.sql'),
    `-- migrate:up\n${statements.join('\n')}\n-- migrate:down\nDROP TABLE "A_T";`,
  );
  return migrationSchema(dir);
}

describe('migration parser', () => {
  const create = 'CREATE TABLE "A_T" (a_id INTEGER PRIMARY KEY, a_name VARCHAR(10));';

  it('applies a column type change', () => {
    const s = schemaOf(create, 'ALTER TABLE "A_T" ALTER COLUMN a_name SET DATA TYPE VARCHAR(50);');
    expect(s.get('A_T').get('a_name')).toBe('VARCHAR(50)');
  });

  it('applies column and table renames', () => {
    const s = schemaOf(
      create,
      'ALTER TABLE "A_T" RENAME COLUMN a_name TO a_title;',
      'ALTER TABLE "A_T" RENAME TO "B_T";',
    );
    expect([...s.get('B_T').keys()]).toEqual(['a_id', 'a_title']);
    expect(s.has('A_T')).toBe(false);
  });

  it('skips allow-listed constraint actions', () => {
    const s = schemaOf(create, 'ALTER TABLE "A_T" ADD CHECK (a_id > 0), ALTER COLUMN a_name SET NOT NULL;');
    expect(s.get('A_T').size).toBe(2);
  });

  it('throws on an unsupported action, an unknown table and an orphan doc row', () => {
    expect(() => schemaOf(create, 'ALTER TABLE "A_T" SET SCHEMA other;')).toThrow(/1_t\.sql.*unsupported/);
    expect(() => schemaOf('ALTER TABLE "NOPE_T" ADD COLUMN x INTEGER;')).toThrow(/unknown table NOPE_T/);
    const dir = mkdtempSync(path.join(os.tmpdir(), 'schema-doc-'));
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'd.md');
    writeFileSync(
      file,
      '| Table name | Field name | Data type | Size |\n| --- | --- | --- | --- |\n| | x | INTEGER | |\n',
    );
    expect(() => docSchema(file)).toThrow(/before any table/);
  });
});
