import { describe, expect, it } from 'vite-plus/test';
import { analyzeDiff, hasJustification } from './check-test-edits.mjs';

// Built from parts so this file itself never contains a literal skip or only call.
const SKIP = ['sk', 'ip'].join('');
const ONLY = ['on', 'ly'].join('');

const diff = (file, lines) =>
  `diff --git a/${file} b/${file}\n--- a/${file}\n+++ b/${file}\n@@ -1,3 +1,3 @@\n${lines.join('\n')}\n`;

describe('analyzeDiff (cage guard, test-edit rules)', () => {
  it('passes a diff that only adds tests', () => {
    const d = diff('server/tests/a.test.ts', ["+it('AUTH-TC1 x', () => {", '+  expect(1).toBe(1);', '+});']);
    expect(analyzeDiff(d)).toEqual([]);
  });

  it('flags a removed assertion', () => {
    const d = diff('server/tests/a.test.ts', ['-  expect(res.status).toBe(200);', '+  // fine']);
    expect(analyzeDiff(d)).toEqual([
      expect.objectContaining({ rule: 'removed-assertion', file: 'server/tests/a.test.ts' }),
    ]);
  });

  it('allows an assertion that is rewritten with the same count', () => {
    const d = diff('server/tests/a.test.ts', ['-  expect(a).toBe(1);', '+  expect(a).toBe(2);']);
    expect(analyzeDiff(d)).toEqual([]);
  });

  it('flags added skip and only', () => {
    const d = diff('client/src/a.test.tsx', [
      `+it.${SKIP}('x', () => {});`,
      `+describe.${ONLY}('y', () => {});`,
      `+x${'it'}('z', () => {});`,
    ]);
    expect(analyzeDiff(d).map((v) => v.rule)).toEqual(['skip-or-only', 'skip-or-only', 'skip-or-only']);
  });

  it('flags a deleted test file', () => {
    const d =
      'diff --git a/server/tests/a.test.ts b/server/tests/a.test.ts\ndeleted file mode 100644\n--- a/server/tests/a.test.ts\n+++ /dev/null\n@@ -1,2 +0,0 @@\n-expect(1).toBe(1);\n';
    expect(analyzeDiff(d).map((v) => v.rule)).toContain('deleted-test-file');
  });

  it('flags removed test cases (it/test lines) not matched by additions', () => {
    const d = diff('server/tests/a.test.ts', ["-it('AUTH-TC2 y', () => {})"]);
    expect(analyzeDiff(d).map((v) => v.rule)).toContain('removed-test');
  });

  it('ignores non-test files', () => {
    const d = diff('server/src/a.ts', ['-  expect(x).toBe(1);', `+it.${SKIP}('x')`]);
    expect(analyzeDiff(d)).toEqual([]);
  });
});

describe('hasJustification', () => {
  it('needs a test id and a reason', () => {
    expect(hasJustification('Test-change: AUTH-TC4 removed, covered by AUTH-TC9')).toBe(true);
    expect(hasJustification('Test-change: removed it')).toBe(false);
    expect(hasJustification('nothing here')).toBe(false);
    expect(hasJustification('Test-change: AUTH-TC4')).toBe(false);
  });
});
