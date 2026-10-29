import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

function splitTop(text, sep) {
  const parts = [];
  let depth = 0;
  let quote = '';
  let cur = '';
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = '';
    } else if (ch === "'" || ch === '"') quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === sep && depth === 0) {
      parts.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

const unquote = (s) => s.replace(/"/g, '');

function normType(base, size = '') {
  let t = base.toUpperCase().replace(/\s+/g, ' ').trim();
  t = t.replace(/^TIMESTAMP WITH TIME ZONE$/, 'TIMESTAMPTZ').replace(/^INT$/, 'INTEGER');
  size = size.replace(/\s+/g, '').trim();
  return size ? `${t}(${size})` : t;
}

function typeOfColumnDef(def) {
  const m = def.match(
    /^(DOUBLE PRECISION|TIMESTAMP(?:TZ)?(?: WITH(?:OUT)? TIME ZONE)?|[A-Za-z_]+)\s*(?:\(([^)]*)\))?\s*(\[\])?/i,
  );
  return normType(m[1], m[2] ?? '') + (m[3] ? '[]' : '');
}

const CONSTRAINT_START = /^(CONSTRAINT|PRIMARY|UNIQUE|CHECK|FOREIGN|EXCLUDE)\b/i;

function applyStatement(schema, stmt) {
  let m = stmt.match(/^CREATE TABLE\s+(?:IF NOT EXISTS\s+)?("?\w+"?)\s*\(([\s\S]*)\)$/i);
  if (m) {
    const cols = new Map();
    for (const item of splitTop(m[2], ',')) {
      if (CONSTRAINT_START.test(item)) continue;
      const [, name, def] = item.match(/^("?\w+"?)\s+([\s\S]*)$/);
      cols.set(unquote(name), typeOfColumnDef(def));
    }
    schema.set(unquote(m[1]), cols);
    return;
  }
  m = stmt.match(/^DROP TABLE\s+(?:IF EXISTS\s+)?([\s\S]*?)(?:\s+CASCADE)?$/i);
  if (m) {
    for (const t of splitTop(m[1], ',')) schema.delete(unquote(t));
    return;
  }
  m = stmt.match(/^ALTER TABLE\s+(?:IF EXISTS\s+)?("?\w+"?)\s+([\s\S]*)$/i);
  if (!m) return;
  const cols = schema.get(unquote(m[1]));
  for (const action of splitTop(m[2], ',')) {
    let a = action.match(/^ADD\s+(?:COLUMN\s+)?(?:IF NOT EXISTS\s+)?(\w+)\s+([\s\S]*)$/i);
    if (a && !CONSTRAINT_START.test(a[0].replace(/^ADD\s+/i, ''))) cols.set(a[1], typeOfColumnDef(a[2]));
    a = action.match(/^DROP COLUMN\s+(?:IF EXISTS\s+)?(\w+)/i);
    if (a) cols.delete(a[1]);
  }
}

export function migrationSchema(dir) {
  const schema = new Map();
  for (const f of readdirSync(dir)
    .filter((n) => n.endsWith('.sql'))
    .sort()) {
    const up = readFileSync(path.join(dir, f), 'utf8').split(/^-- migrate:down/m)[0];
    const sql = up.replace(/--[^\n]*/g, '');
    for (const stmt of splitTop(sql, ';')) applyStatement(schema, stmt.replace(/\s+/g, ' '));
  }
  return schema;
}

export function docSchema(file) {
  const schema = new Map();
  let table = '';
  let inTable = false;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.startsWith('|')) {
      inTable &&= false;
      continue;
    }
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (/^Table name$/i.test(cells[0])) inTable = true;
    else if (inTable && !/^-+$/.test(cells[0] || cells[1])) {
      if (cells[0]) {
        table = cells[0];
        schema.set(table, new Map());
      }
      schema.get(table).set(cells[1], normType(cells[2].replace(/\s*\(identity\)/i, ''), cells[3]));
    }
  }
  return schema;
}

export function problems(docFile, migrationsDir) {
  const out = [];
  const doc = docSchema(docFile);
  const mig = migrationSchema(migrationsDir);
  for (const t of mig.keys()) if (!doc.has(t)) out.push(`${t}: in migrations, missing from the doc`);
  for (const t of doc.keys()) if (!mig.has(t)) out.push(`${t}: in the doc, missing from migrations`);
  for (const [t, cols] of mig) {
    const docCols = doc.get(t);
    if (!docCols) continue;
    for (const [c, type] of cols) {
      if (!docCols.has(c)) out.push(`${t}.${c}: in migrations, missing from the doc`);
      else if (docCols.get(c) !== type) out.push(`${t}.${c}: doc says ${docCols.get(c)}, migrations say ${type}`);
    }
    for (const c of docCols.keys()) if (!cols.has(c)) out.push(`${t}.${c}: in the doc, missing from migrations`);
  }
  return out;
}

if (import.meta.main) {
  const root = path.resolve(import.meta.dirname, '..');
  const [
    docFile = path.join(root, 'docs/chapter4/4.3_database_design.md'),
    dir = path.join(root, 'server/db/migrations'),
  ] = process.argv.slice(2);
  const found = problems(docFile, dir);
  for (const p of found) console.error(`schema-docs: ${p}`);
  process.exit(found.length ? 1 : 0);
}
