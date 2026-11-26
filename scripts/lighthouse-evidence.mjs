// Lighthouse accessibility evidence for the R26 UAT pages (#81). Run it with `vp run test:lighthouse`, which starts the
// seeded E2E stack first (see docs/testing/lighthouse.md). Writes docs/testing/lighthouse.json. Needs Node 24.2+ (import.meta.main).
//
// Signed-in pages get the session cookie from a real login against the API, passed to Lighthouse as a header.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const origin = process.env.LH_ORIGIN ?? 'http://localhost:5173';
// The seed default lives in server/src/scripts/uat/data.ts; read it from there so it is not repeated here.
const password =
  process.env.UAT_PASSWORD ??
  /DEFAULT_UAT_PASSWORD = '([^']+)'/.exec(readFileSync(path.join(root, 'server/src/scripts/uat/data.ts'), 'utf8'))?.[1];

// Pages named after the UAT tasks they belong to (docs/chapter4/4.5_test_cases.md section 4.5.2).
export const PAGES = [
  { id: 'login', as: null, url: '/login' },
  { id: 'S3-feed-guest', as: null, url: '/' },
  { id: 'S4-search', as: null, url: '/search' },
  { id: 'S2-editor', as: 'uat.student1@mail.apu.edu.my', url: '/notes/new' },
  { id: 'S5-messages', as: 'uat.student1@mail.apu.edu.my', url: '/messages' },
  { id: 'L2-feed-lecturer', as: 'uat.lecturer@mail.apu.edu.my', url: '/' },
  { id: 'A2-reports', as: 'uat.admin@mail.apu.edu.my', url: '/admin/reports' },
];

async function sessionCookie(email) {
  const res = await fetch(`${origin}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'notalah' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login ${email}: ${res.status}`);
  return res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
}

export function summarise(lhr) {
  const audits = Object.values(lhr.audits).filter((a) =>
    lhr.categories.accessibility.auditRefs.some((r) => r.id === a.id),
  );
  return {
    finalUrl: new URL(lhr.finalDisplayedUrl).pathname,
    accessibility: Math.round(lhr.categories.accessibility.score * 100),
    failed: audits.filter((a) => a.score === 0).map((a) => a.id),
  };
}

if (import.meta.main) {
  const { chromium } = await import('@playwright/test');
  const chrome = chromium.executablePath();
  const cli = path.join(root, 'node_modules/lighthouse/cli/index.js');
  const out = mkdtempSync(path.join(os.tmpdir(), 'lh-'));
  const results = {};
  try {
    for (const page of PAGES) {
      const file = path.join(out, `${page.id}.json`);
      const args = [
        cli,
        origin + page.url,
        '--only-categories=accessibility',
        '--output=json',
        `--output-path=${file}`,
        '--quiet',
        '--chrome-flags=--headless=new --no-sandbox',
      ];
      if (page.as) args.push(`--extra-headers=${JSON.stringify({ Cookie: await sessionCookie(page.as) })}`);
      execFileSync(process.execPath, args, {
        env: { ...process.env, CHROME_PATH: chrome },
        stdio: ['ignore', 'ignore', 'inherit'],
      });
      results[page.id] = {
        url: page.url,
        signedInAs: page.as ? page.as.split('@')[0] : null,
        ...summarise(JSON.parse(readFileSync(file, 'utf8'))),
      };
      console.log(
        page.id.padEnd(18),
        String(results[page.id].accessibility).padStart(3),
        results[page.id].finalUrl,
        results[page.id].failed.join(', ') || '-',
      );
      if (page.as && results[page.id].finalUrl !== page.url)
        throw new Error(`${page.id} was redirected to ${results[page.id].finalUrl}: not signed in`);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
  mkdirSync(path.join(root, 'docs/testing'), { recursive: true });
  writeFileSync(
    path.join(root, 'docs/testing/lighthouse.json'),
    JSON.stringify(
      {
        measured: new Date().toISOString(),
        lighthouse: JSON.parse(readFileSync(path.join(root, 'node_modules/lighthouse/package.json'), 'utf8')).version,
        results,
      },
      null,
      2,
    ) + '\n',
  );
}
