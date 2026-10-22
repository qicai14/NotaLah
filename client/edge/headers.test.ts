import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vite-plus/test';

const read = (file: string) => readFileSync(path.resolve(import.meta.dirname, '..', file), 'utf8');

it('DEP-TC23: Pages headers forbid framing, allow only the inline theme script, and cache hashed assets for a year', () => {
  const headers = read('public/_headers');
  const csp = /Content-Security-Policy: (.+)/.exec(headers)![1];
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  expect(headers).toContain('X-Frame-Options: DENY');
  expect(headers).toContain('X-Content-Type-Options: nosniff');

  const scripts = [...read('index.html').matchAll(/<script>([\s\S]*?)<\/script>/g)];
  expect(scripts).toHaveLength(1);
  const hash = createHash('sha256').update(scripts[0]![1]!).digest('base64');
  expect(csp).toContain(`'sha256-${hash}'`);

  // Pages joins a header set by two matching rules, so Cache-Control must appear only on /assets/*.
  expect(headers.match(/^\s+Cache-Control:/gm)).toHaveLength(1);
  expect(headers).toMatch(/\/assets\/\*\n\s+Cache-Control: public, max-age=31536000, immutable/);
});
