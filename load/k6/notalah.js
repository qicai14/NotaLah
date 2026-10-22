// NotaLah live load test (R27, D80). Same read mix as server/src/scripts/load/run.ts, for the pages.dev site.
//   k6 run -e BASE=https://<project>.pages.dev -e PASSWORD=<test password> load/k6/notalah.js
// Reads only (feed, search, note, comments): the live site holds real users' notes, so this script never likes, comments or
// views. NFR1 is about search, so nothing is lost. Defaults stay far under the Pages Function quota (100,000 requests a
// day): see docs/testing/load/README.md.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE;
const PASSWORD = __ENV.PASSWORD;
const VUS = Number(__ENV.VUS || 10);
const DURATION = __ENV.DURATION || '3m';
const THINK = Number(__ENV.THINK || 1.5);
const PREFIX = __ENV.PREFIX || 'loadtest';
const WORDS = ['database', 'network', 'algorithm', 'security', 'testing', 'memory', 'project', 'requirement', 'cloud', 'design'];

export const options = {
  // setup() registers the accounts and then waits out the rate-limit window, so it needs more than the default 60 s.
  setupTimeout: '10m',
  scenarios: { students: { executor: 'constant-vus', vus: VUS, duration: DURATION } },
  thresholds: {
    // NFR1: search within 3 s under normal load.
    'http_req_duration{kind:search}': ['p(95)<3000'],
    http_req_failed: ['rate<0.01'],
  },
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
};

const JSON_HEADERS = { 'Content-Type': 'application/json', 'X-Requested-With': 'notalah' };
const email = (n) => `${PREFIX}${n}@mail.apu.edu.my`;
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
const day = (ago) => new Date(Date.now() - ago * 86400000).toISOString().slice(0, 10);

// Register and login share one limit of 60 per minute per IP (the auth limiter), so the accounts are created here, the
// script waits a full window, and the VUs log in after that (staggered below). Keep VUS at about 25 or fewer.
export function setup() {
  const programme = http.get(`${BASE}/api/programmes`).json('items.0');
  for (let n = 1; n <= VUS; n++) {
    http.post(
      `${BASE}/api/auth/register`,
      JSON.stringify({
        displayName: `Load Test ${n}`,
        email: email(n),
        password: PASSWORD,
        confirmPassword: PASSWORD,
        programme,
        role: 'student',
      }),
      { headers: JSON_HEADERS, responseCallback: http.expectedStatuses(201, 409) },
    );
  }
  sleep(61);
}

let ready = false;
let noteIds = [];
let asOf = null;
let moduleIds = [];

function get(path, kind) {
  return http.get(`${BASE}${path}`, { tags: { kind } });
}

function login() {
  const res = http.post(`${BASE}/api/auth/login`, JSON.stringify({ email: email(__VU), password: PASSWORD }), {
    headers: JSON_HEADERS,
    tags: { kind: 'login' },
  });
  check(res, { 'logged in': (r) => r.status === 200 });
  if (res.status !== 200) return;
  // k6 keeps the auth cookie in this VU's jar from here on.
  const modules = http.get(`${BASE}/api/modules`).json('modules');
  moduleIds = (modules || []).map((m) => m.id);
  ready = true;
}

function remember(res) {
  const items = res.status === 200 ? res.json('items') : null;
  if (items && items.length) noteIds = items.map((i) => i.id);
}

const noteId = () => (noteIds.length ? pick(noteIds) : 1);

const actions = [
  [20, () => {
    const res = get('/api/feed', 'feed');
    if (res.status === 200) asOf = res.json('asOf');
    remember(res);
  }],
  [10, () => get(asOf ? `/api/feed?page=2&asOf=${encodeURIComponent(asOf)}` : '/api/feed?page=2', 'feed')],
  [14, () => remember(get(`/api/search?q=${pick(WORDS)}&tab=notes`, 'search'))],
  [8, () => remember(get(`/api/search?q=${pick(WORDS)}`, 'search'))],
  [8, () => remember(get(`/api/search?q=%23${pick(WORDS)}&tab=notes`, 'search'))],
  [7, () => remember(get(`/api/search?q=${encodeURIComponent('Software Engineering')}&tab=notes`, 'search'))],
  [7, () => {
    const mod = moduleIds.length ? `&module=${pick(moduleIds)}` : '';
    remember(get(`/api/search?q=${pick(WORDS)}&tab=notes&lecturer=any&from=${day(45)}&to=${day(0)}${mod}`, 'search'));
  }],
  [13, () => get(`/api/notes/${noteId()}`, 'note')],
  [5, () => get(`/api/notes/${noteId()}/comments`, 'note')],
];
const total = actions.reduce((a, [w]) => a + w, 0);

export default function () {
  if (!ready) {
    // Stagger the first logins so they spread over the window instead of arriving together.
    if (__ITER === 0) sleep((__VU - 1) * 3);
    login();
    if (!ready) {
      sleep(10);
      return;
    }
  }
  let r = Math.random() * total;
  for (const [w, fn] of actions) {
    if ((r -= w) < 0) {
      fn();
      break;
    }
  }
  sleep(THINK * (0.5 + Math.random()));
}
