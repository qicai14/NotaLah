import { mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { LOAD_PASSWORD, SEED, WORDS, loadEmail } from './data';
import { NFR1_LIMIT_MS, type Summary, nfr1Verdict, summarise } from './stats';

const { values: opt } = parseArgs({
  options: {
    base: { type: 'string', default: 'http://127.0.0.1:4104' },
    vus: { type: 'string', default: '50' },
    duration: { type: 'string', default: '60' },
    think: { type: 'string', default: '1000' },
    users: { type: 'string', default: String(SEED.users) },
    label: { type: 'string' },
    out: { type: 'string' },
    notes: { type: 'string', default: String(SEED.notes) },
    'client-ips': { type: 'boolean', default: false },
  },
});
const BASE = opt.base!;
const VUS = Number(opt.vus);
const DURATION_S = Number(opt.duration);
const THINK_MS = Number(opt.think);
const USERS = Number(opt.users);
const PROXY_SECRET = process.env.LOAD_PROXY_SECRET;
const TIMEOUT_MS = 30_000;
const MODULES = SEED.modules;
const NOTES = Number(opt.notes);
const LABEL = opt.label ?? 'run';
// Results go into the repo only for a named run; a plain run writes to the temp folder.
const OUT =
  opt.out ?? (opt.label ? path.resolve(import.meta.dirname, '../../../../docs/testing/load/runs') : os.tmpdir());

interface Rec {
  label: string;
  ms: number;
  ok: boolean;
  status: number;
  bytes: number;
}
const recs: Rec[] = [];
const logins: Rec[] = [];

const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T>(xs: readonly T[]): T => xs[rand(xs.length)];

interface Vu {
  n: number;
  cookie: string;
  asOf?: string;
  noteIds: number[];
}

async function call(vu: Vu, label: string, method: string, url: string, body?: unknown, into = recs): Promise<unknown> {
  const headers: Record<string, string> = { 'X-Requested-With': 'notalah' };
  if (vu.cookie) headers.Cookie = vu.cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (PROXY_SECRET) headers['X-Proxy-Secret'] = PROXY_SECRET;
  // Behind the real proxies the client address is the second entry from the right (TRUST_PROXY=2, D74), so each VU gets its own.
  if (opt['client-ips']) headers['X-Forwarded-For'] = `10.${(vu.n >> 8) & 255}.${vu.n & 255}.1, 10.255.255.254`;
  const t0 = performance.now();
  let status = 0;
  let text = '';
  try {
    const res = await fetch(BASE + url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    status = res.status;
    text = await res.text();
    if (label === 'auth.login' && res.ok) vu.cookie = (res.headers.getSetCookie()[0] ?? '').split(';')[0];
  } catch {
    /* status 0: network error or timeout */
  }
  into.push({ label, ms: performance.now() - t0, ok: status >= 200 && status < 300, status, bytes: text.length });
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const remember = (vu: Vu, json: unknown) => {
  const items = (json as { items?: { id: number }[] } | undefined)?.items;
  if (items?.length) vu.noteIds = items.map((i) => i.id);
};
const noteId = (vu: Vu) => (vu.noteIds.length ? pick(vu.noteIds) : 1 + rand(NOTES));
const day = (ago: number) => new Date(Date.now() - ago * 86_400_000).toISOString().slice(0, 10);

async function feed(vu: Vu, page: number) {
  const q = page > 1 && vu.asOf ? `?page=${page}&asOf=${encodeURIComponent(vu.asOf)}` : '';
  const json = await call(vu, page > 1 ? 'feed.page2' : 'feed.page1', 'GET', `/api/feed${q}`);
  if (page === 1) vu.asOf = (json as { asOf?: string } | undefined)?.asOf;
  remember(vu, json);
}

async function search(vu: Vu, label: string, query: string) {
  remember(vu, await call(vu, label, 'GET', `/api/search?${query}`));
}

const q = (params: Record<string, string>) => new URLSearchParams(params).toString();

/** Weighted mix of what a signed-in student does in a session: mostly reading the feed and searching. */
const SCENARIO: [number, (vu: Vu) => Promise<unknown>][] = [
  [20, (vu) => feed(vu, 1)],
  [10, async (vu) => (vu.asOf ? feed(vu, 2) : feed(vu, 1))],
  [14, (vu) => search(vu, 'search.keyword', q({ q: pick(WORDS), tab: 'notes' }))],
  [8, (vu) => search(vu, 'search.top', q({ q: pick(WORDS) }))],
  [8, (vu) => search(vu, 'search.hashtag', q({ q: `#${pick(WORDS)}`, tab: 'notes' }))],
  [
    7,
    (vu) =>
      search(
        vu,
        'search.module',
        q({ q: `LD${String(1 + rand(SEED.extraModules)).padStart(3, '0')}-3-2`, tab: 'notes' }),
      ),
  ],
  [
    7,
    (vu) =>
      search(
        vu,
        'search.filtered',
        q({
          q: pick(WORDS),
          tab: 'notes',
          lecturer: 'any',
          module: String(1 + rand(MODULES)),
          from: day(45),
          to: day(0),
        }),
      ),
  ],
  [
    13,
    async (vu) => {
      const id = noteId(vu);
      await call(vu, 'note.detail', 'GET', `/api/notes/${id}`);
      await call(vu, 'note.view', 'POST', `/api/notes/${id}/view`);
    },
  ],
  [5, (vu) => call(vu, 'note.comments', 'GET', `/api/notes/${noteId(vu)}/comments`)],
  [5, (vu) => call(vu, 'note.like', 'POST', `/api/notes/${noteId(vu)}/like`)],
  [3, (vu) => call(vu, 'note.comment', 'POST', `/api/notes/${noteId(vu)}/comments`, { body: 'Load test comment' })],
];
const TOTAL_WEIGHT = SCENARIO.reduce((a, [w]) => a + w, 0);

function chooseAction() {
  let r = rand(TOTAL_WEIGHT);
  for (const [w, fn] of SCENARIO) {
    if ((r -= w) < 0) return fn;
  }
  return SCENARIO[0][1];
}

async function login(vu: Vu) {
  await call(
    vu,
    'auth.login',
    'POST',
    '/api/auth/login',
    { email: loadEmail(1 + (vu.n % USERS)), password: LOAD_PASSWORD },
    logins,
  );
  if (!vu.cookie) throw new Error(`login failed for VU ${vu.n}: check the seed, the proxy secret and the base URL`);
}

const vus: Vu[] = Array.from({ length: VUS }, (_, n) => ({ n, cookie: '', noteIds: [] }));
// Logins are bcrypt-heavy and each VU has its own address, so a small pool keeps the start-up from distorting the run.
for (let i = 0; i < vus.length; i += 10) await Promise.all(vus.slice(i, i + 10).map(login));

const startedAt = new Date();
const deadline = performance.now() + DURATION_S * 1000;
const t0 = performance.now();
await Promise.all(
  vus.map(async (vu) => {
    await sleep(rand(THINK_MS));
    while (performance.now() < deadline) {
      await chooseAction()(vu);
      await sleep(THINK_MS * (0.5 + Math.random()));
    }
  }),
);
const elapsedS = (performance.now() - t0) / 1000;

const labels = [...new Set(recs.map((r) => r.label))].sort();
const rows = labels.map((label) => ({ label, ...summarise(recs.filter((r) => r.label === label)) }));
const searchRecs = recs.filter((r) => r.label.startsWith('search.'));
const searchSummary = summarise(searchRecs);
const all = summarise(recs);
const verdict = nfr1Verdict(searchSummary);
const statuses: Record<string, number> = {};
for (const r of recs.filter((x) => !x.ok)) statuses[r.status] = (statuses[r.status] ?? 0) + 1;

const cpus = os.cpus();
const machine = `${cpus[0].model.trim()}, ${cpus.length} threads, ${Math.round(os.totalmem() / 2 ** 30)} GB RAM, ${os.platform()} ${os.release()}, Node ${process.version}`;
const result = {
  label: LABEL,
  notes: NOTES,
  startedAt: startedAt.toISOString(),
  base: BASE,
  vus: VUS,
  durationS: DURATION_S,
  thinkMs: THINK_MS,
  clientIps: opt['client-ips'],
  machine,
  elapsedS,
  requestsPerSecond: recs.length / elapsedS,
  login: summarise(logins),
  all,
  search: searchSummary,
  nfr1: { limitMs: NFR1_LIMIT_MS, ...verdict },
  failedStatuses: statuses,
  endpoints: rows.map((r) => ({
    ...r,
    requestsPerSecond: r.count / elapsedS,
    avgBytes: Math.round(recs.filter((x) => x.label === r.label).reduce((a, x) => a + x.bytes, 0) / r.count),
  })),
};

const f = (n: number) => (Number.isNaN(n) ? '-' : n.toFixed(0));
const line = (name: string, s: Summary, rps: number) =>
  `| ${name} | ${s.count} | ${rps.toFixed(1)} | ${(s.errorRate * 100).toFixed(2)}% | ${f(s.p50)} | ${f(s.p95)} | ${f(s.p99)} | ${f(s.max)} |`;
const md = [
  `# Load run: ${LABEL}`,
  '',
  `- Started ${startedAt.toISOString()}; seeded notes ${NOTES}; ${VUS} virtual users for ${DURATION_S} s (measured ${elapsedS.toFixed(1)} s), mean think time ${THINK_MS} ms`,
  `- Target ${BASE}; per-VU client addresses sent (X-Forwarded-For): ${opt['client-ips'] ? 'yes' : 'no'}; proxy secret sent: ${PROXY_SECRET ? 'yes' : 'no'}`,
  `- Machine (load generator and server on the same host): ${machine}`,
  `- Login phase: ${logins.length} logins, p50 ${f(result.login.p50)} ms, max ${f(result.login.max)} ms (not in the figures below)`,
  '',
  '| Endpoint | Requests | Req/s | Errors | p50 ms | p95 ms | p99 ms | max ms |',
  '|---|---|---|---|---|---|---|---|',
  ...result.endpoints.map((r) => line(r.label, r, r.requestsPerSecond)),
  line('**all search**', searchSummary, searchRecs.length / elapsedS),
  line('**all requests**', all, recs.length / elapsedS),
  '',
  `Failed statuses (0 = network error or ${TIMEOUT_MS / 1000} s timeout): ${JSON.stringify(statuses)}`,
  '',
  `NFR1 (search p95 under ${NFR1_LIMIT_MS} ms, no search errors): **${verdict.pass ? 'PASS' : 'FAIL'}**; every search under ${NFR1_LIMIT_MS} ms: ${verdict.allUnderLimit ? 'yes' : 'no'}`,
  '',
].join('\n');

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, `${LABEL}.json`), JSON.stringify(result, null, 2) + '\n');
writeFileSync(path.join(OUT, `${LABEL}.md`), md);
console.log(md);
