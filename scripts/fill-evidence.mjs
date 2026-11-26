import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Reads Vitest JUnit XML (TEST_JUNIT=1 vp run --no-cache -r test) and fills the Actual and Pass columns of 4.5, keyed on TC ID.
const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

export function collect(xmls) {
  const tcs = {};
  for (const xml of xmls)
    for (const m of xml.matchAll(/<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g)) {
      const id = decode(m[1].match(/\bname="([^"]*)"/)?.[1] ?? '').match(/(?:^| > )([A-Z]+-TC\d+)\b/)?.[1];
      if (!id) continue;
      const body = m[3] ?? '';
      const kind = /<(failure|error)\b/.test(body) ? 'failed' : /<skipped\b/.test(body) ? 'skipped' : 'passed';
      const t = (tcs[id] ??= { passed: 0, failed: 0, skipped: 0 });
      t[kind]++;
    }
  return tcs;
}

// An Actual this script wrote itself can be rewritten; anything else is human evidence and is kept.
const AUTO = /^((All )?\d+ tests? passed|\d+ of \d+ tests? failed|Retired, not run|Skipped \(opt-in live test\))$/;

export function fill(md, tcs) {
  const blank = [];
  let filled = 0;
  const out = md.split('\n').map((line) => {
    const id = line.match(/^\| ([A-Z]+-TC\d+) \|/)?.[1];
    if (!id) return line;
    const m = line.match(/\|([^|]*)\|([^|]*)\|(\s*)$/);
    const [actual, pass] = [m[1].trim(), m[2].trim()];
    const t = tcs[id];
    let cells;
    if (t && (t.passed || t.failed)) {
      const n = t.passed + t.failed;
      const s = `${n} test${n > 1 ? 's' : ''}`;
      cells = t.failed ? [`${t.failed} of ${s} failed`, 'Fail'] : [`${n > 1 ? 'All ' : ''}${s} passed`, 'Pass'];
    } else if (/retired/i.test(line)) cells = ['Retired, not run', 'N/A'];
    // Skipped by design: an opt-in live test is neither a failure nor a pass.
    else if (t?.skipped && /opt-in/i.test(line)) cells = ['Skipped (opt-in live test)', 'N/A'];
    // Manual or measured rows keep their evidence; a blank Pass is never guessed.
    else if (actual && pass) return line;
    else return (blank.push(id), line);
    if (actual && !AUTO.test(actual)) {
      if (pass) return line;
      cells[0] = actual;
    }
    filled++;
    return line.replace(/\|[^|]*\|[^|]*\|(\s*)$/, (_, ws) => `| ${cells[0]} | ${cells[1]} |${ws}`);
  });
  return { md: out.join('\n'), filled, blank };
}

if (import.meta.main) {
  const root = path.resolve(import.meta.dirname, '..');
  const file = path.join(root, 'docs/chapter4/4.5_test_cases.md');
  const xmls = process.argv.slice(2).map((f) => readFileSync(f, 'utf8'));
  if (!xmls.length) throw new Error('usage: node scripts/fill-evidence.mjs <junit.xml>...');
  const { md, filled, blank } = fill(readFileSync(file, 'utf8'), collect(xmls));
  writeFileSync(file, md);
  console.log(`filled ${filled} rows; ${blank.length} left blank${blank.length ? `: ${blank.join(', ')}` : ''}`);
  process.exit(blank.length ? 1 : 0);
}
