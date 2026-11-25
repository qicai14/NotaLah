// Test-edit guard (R26 cage, issue #151). Fails a PR that weakens its own safety net: removes assertions or tests,
// adds .skip/.only, or deletes test files, unless the PR body has `Test-change: <TC id> <reason>`.
import { execFileSync } from 'node:child_process';

const TEST_FILE = /(^|\/)(tests?\/|[^/]+\.(test|spec)\.[cm]?[jt]sx?$)/;
const ASSERT = /\b(expect|assert)\s*[.(]/;
const TEST_DECL = /^\s*(it|test)(\.\w+)?\s*\(/;
const SKIP_ONLY =
  /\b(it|test|describe)\.(skip|only|todo|fixme|fail|skipIf|runIf)\b|\b(x(it|describe|test)|f(it|describe))\s*\(/;

export function analyzeDiff(diffText) {
  const out = [];
  let file = null;
  let isTest = false;
  let deleted = false;
  let stat = null;
  const flush = () => {
    if (stat && isTest) {
      if (stat.removedAsserts > stat.addedAsserts)
        out.push({
          rule: 'removed-assertion',
          file,
          detail: `${stat.removedAsserts} removed, ${stat.addedAsserts} added`,
        });
      if (stat.removedTests > stat.addedTests && !deleted)
        out.push({ rule: 'removed-test', file, detail: `${stat.removedTests} removed, ${stat.addedTests} added` });
    }
  };
  for (const line of diffText.split('\n')) {
    if (line.startsWith('diff --git ')) {
      flush();
      file = line.match(/ b\/(.+)$/)?.[1]?.replace(/"$/, '') ?? null;
      isTest = !!file && TEST_FILE.test(file);
      deleted = false;
      stat = { removedAsserts: 0, addedAsserts: 0, removedTests: 0, addedTests: 0 };
    } else if (!stat || !isTest) {
      continue;
    } else if (line.startsWith('deleted file mode')) {
      deleted = true;
      out.push({ rule: 'deleted-test-file', file, detail: 'file deleted' });
    } else if (line.startsWith('+++') || line.startsWith('---')) {
      continue;
    } else if (line.startsWith('+')) {
      const t = line.slice(1);
      if (SKIP_ONLY.test(t)) out.push({ rule: 'skip-or-only', file, detail: t.trim() });
      if (ASSERT.test(t)) stat.addedAsserts++;
      if (TEST_DECL.test(t)) stat.addedTests++;
    } else if (line.startsWith('-')) {
      const t = line.slice(1);
      if (ASSERT.test(t)) stat.removedAsserts++;
      if (TEST_DECL.test(t)) stat.removedTests++;
    }
  }
  flush();
  return out;
}

export function hasJustification(body) {
  return /^Test-change:.*\b[A-Z]+-TC\d+\b[ \t]+\S.{2,}/m.test(body ?? '');
}

if (import.meta.main) {
  const base = process.env.BASE_REF || 'origin/main';
  const diffText = execFileSync('git', ['diff', '--no-color', '-U0', `${base}...HEAD`], {
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  });
  const found = analyzeDiff(diffText);
  if (found.length && !hasJustification(process.env.PR_BODY)) {
    for (const v of found) console.error(`${v.rule}: ${v.file} (${v.detail})`);
    console.error('Add "Test-change: <TC id> <reason>" to the PR body to justify these test edits.');
    process.exit(1);
  }
  console.log(found.length ? `test-edit guard: ${found.length} flagged, justified in PR body` : 'test-edit guard: ok');
}
