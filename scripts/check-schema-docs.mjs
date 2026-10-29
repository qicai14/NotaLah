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
  let table = unquote(m[1]);
  const cols = schema.get(table);
  if (!cols) throw new Error(`ALTER TABLE on unknown table ${table}`);
  for (const action of splitTop(m[2], ',')) {
    let hit;
    if (/^(ADD\s+(CONSTRAINT|CHECK|PRIMARY KEY|FOREIGN KEY|UNIQUE)|DROP CONSTRAINT|ENABLE|DISABLE)\b/i.test(action))
      continue;
    if (/^ALTER COLUMN\s+\w+\s+(SET|DROP)\s+(NOT NULL|DEFAULT)\b/i.test(action)) continue;
    if ((hit = action.match(/^ADD\s+(?:COLUMN\s+)?(?:IF NOT EXISTS\s+)?(\w+)\s+([\s\S]*)$/i)))
      cols.set(hit[1], typeOfColumnDef(hit[2]));
    else if ((hit = action.match(/^DROP COLUMN\s+(?:IF EXISTS\s+)?(\w+)/i))) cols.delete(hit[1]);
    else if ((hit = action.match(/^ALTER COLUMN\s+(\w+)\s+(?:SET DATA\s+)?TYPE\s+([\s\S]*)$/i)))
      cols.set(hit[1], typeOfColumnDef(hit[2]));
    else if ((hit = action.match(/^RENAME COLUMN\s+(\w+)\s+TO\s+(\w+)$/i))) {
      cols.set(hit[2], cols.get(hit[1]));
      cols.delete(hit[1]);
    } else if ((hit = action.match(/^RENAME TO\s+("?\w+"?)$/i))) {
      schema.delete(table);
      table = unquote(hit[1]);
      schema.set(table, cols);
    } else throw new Error(`unsupported ALTER TABLE action: ${action}`);
  }
}

export function migrationSchema(dir) {
  const schema = new Map();
  for (const f of readdirSync(dir)
    .filter((n) => n.endsWith('.sql'))
    .sort()) {
    const up = readFileSync(path.join(dir, f), 'utf8').split(/^-- migrate:down/m)[0];
    const sql = up.replace(/--[^\n]*/g, '');
    for (const stmt of splitTop(sql, ';')) {
      try {
        applyStatement(schema, stmt.replace(/\s+/g, ' '));
      } catch (e) {
        throw new Error(`${f}: ${e.message} (in: ${stmt.replace(/\s+/g, ' ').slice(0, 80)})`);
      }
    }
  }
  return schema;
}

export function docSchema(file) {
  const schema = new Map();
  let table = '';
  let inTable = false;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.startsWith('|')) {
      inTable = false;
      continue;
    }
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    if (/^Table name$/i.test(cells[0])) inTable = true;
    else if (inTable && !/^-+$/.test(cells[0] || cells[1])) {
      if (!cells[0] && !table) throw new Error(`${file}: schema row ${cells[1]} comes before any table name`);
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
