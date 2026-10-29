import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { RATE_LIMITS } from '../../features/auth/rateLimit';
import { LOAD_PASSWORD, SEED, WORDS, loadEmail } from './data';
import { type Sample, summarise } from './stats';

const { values: opt } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://127.0.0.1:4000' },
    user: { type: 'string', default: String(SEED.lecturers + 1) },
    warmup: { type: 'string', default: '5' },
    n: { type: 'string', default: '100' },
    gap: { type: 'string', default: String(RATE_LIMITS.windowMs / RATE_LIMITS.reads) },
  },
});
const BASE = opt.base!;
const WARMUP = Number(opt.warmup);
const N = Number(opt.n);
const GAP_MS = Number(opt.gap);
const TARGET_MS = 300;
const PROXY_SECRET = process.env.LOAD_PROXY_SECRET;

let cookie = '';
const headers = () => {
  const h: Record<string, string> = { 'X-Requested-With': 'notalah' };
  if (cookie) h.Cookie = cookie;
  if (PROXY_SECRET) h['X-Proxy-Secret'] = PROXY_SECRET;
  return h;
};

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { ...headers(), 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: loadEmail(Number(opt.user)), password: LOAD_PASSWORD }),
});
cookie = (login.headers.getSetCookie()[0] ?? '').split(';')[0];
if (!login.ok || !cookie)
  throw new Error(`login failed (${login.status}): check the seed, the proxy secret and --base`);

const q = (params: Record<string, string>) => new URLSearchParams(params).toString();
const word = (i: number) => WORDS[i % WORDS.length];
const ENDPOINTS: [string, (i: number) => string][] = [
  [
    'search.module',
    (i) => `/api/search?${q({ q: `LD${String(1 + (i % SEED.extraModules)).padStart(3, '0')}-3-2`, tab: 'notes' })}`,
  ],
  ['search.hashtag', (i) => `/api/search?${q({ q: `#${word(i)}`, tab: 'notes' })}`],
  ['search.keyword', (i) => `/api/search?${q({ q: word(i), tab: 'notes' })}`],
  ['search.lecturer', (i) => `/api/search?${q({ q: word(i), tab: 'notes', lecturer: 'any' })}`],
  ['search.top', (i) => `/api/search?${q({ q: word(i) })}`],
  ['feed.foryou', () => '/api/feed'],
  ['feed.following', () => '/api/feed?tab=following'],
];

async function probe(url: string): Promise<Sample> {
  const t0 = performance.now();
  const ok = await fetch(BASE + url, { headers: headers(), signal: AbortSignal.timeout(30_000) })
    .then(async (res) => (await res.arrayBuffer(), res.ok))
    .catch(() => false);
  const sample = { ms: performance.now() - t0, ok };
  await sleep(GAP_MS);
  return sample;
}

const f = (n: number) => (Number.isNaN(n) ? '-' : n.toFixed(0));
const lines = ['| Endpoint | Count | Errors | p50 ms | p95 ms | max ms |', '|---|---|---|---|---|---|'];
const failed: string[] = [];
for (const [label, url] of ENDPOINTS) {
  for (let i = 0; i < WARMUP; i++) await probe(url(i));
  const samples: Sample[] = [];
  for (let i = 0; i < N; i++) samples.push(await probe(url(WARMUP + i)));
  const s = summarise(samples);
  if (!(s.p95 < TARGET_MS) || s.errors > 0) failed.push(label);
  lines.push(`| ${label} | ${s.count} | ${s.errors} | ${f(s.p50)} | ${f(s.p95)} | ${f(s.max)} |`);
}
console.log(
  `Sequential probe of ${BASE} as ${loadEmail(Number(opt.user))}: ${WARMUP} warm-up then ${N} measured per endpoint, ${GAP_MS} ms apart\n`,
);
console.log(lines.join('\n'));
console.log(
  `\np95 under ${TARGET_MS} ms with no errors: **${failed.length ? `FAIL (${failed.join(', ')})` : 'PASS'}**`,
);
if (failed.length) process.exitCode = 1;
