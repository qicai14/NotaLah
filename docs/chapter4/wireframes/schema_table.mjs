// Renders the schema table in ../4.3_database_design.md to ../diagrams/png/schema_table_N.png
// (split into pages that fit an A4 report page). Usage: node schema_table.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const md = readFileSync(new URL('../4.3_database_design.md', import.meta.url), 'utf8');
const rows = md.split('\n').filter((l) => /^\| (\w+_T)? *\| \w+ \|/.test(l) && !l.includes('Field name'))
  .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Break pages only at table boundaries, about 38 rows per page.
const pages = [[]];
for (const r of rows) {
  if (r[0] && pages.at(-1).length > 32) pages.push([]);
  pages.at(-1).push(r);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 400 }, deviceScaleFactor: 2 });
for (const [i, p] of pages.entries()) {
  const body = p.map((r) => `<tr class="${r[0] ? 'first' : ''}">${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  await page.setContent(`<style>body{margin:0;font:12px Arial}table{border-collapse:collapse;width:1100px}
    td,th{border:1px solid #444;padding:3px 6px;vertical-align:top}th{background:#ddd}tr.first td{border-top:2px solid #000}
    td:first-child{font-weight:bold}</style><table><tr><th>Table name</th><th>Field name</th><th>Data type</th><th>Size</th><th>Constraint</th><th>Description</th></tr>${body}</table>`);
  await page.locator('table').screenshot({ path: fileURLToPath(new URL(`../diagrams/png/schema_table_${i + 1}.png`, import.meta.url)) });
}
await browser.close();
console.log(`${rows.length} rows on ${pages.length} pages`);
