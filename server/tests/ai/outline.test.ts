import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { app } from '../../src/app';
import { AI } from '../../src/features/ai/config';
import { OUTLINE_PROMPT } from '../../src/features/ai/prompts';
import { METRICS } from '../../src/features/usage/config';
import { consume, periodKey } from '../../src/features/usage/service';
import { env, parseEnv } from '../../src/lib/env';
import { logger } from '../../src/lib/logger';
import { pool } from '../../src/lib/pool';
import { asUser, CSRF, insertUser, truncateAll } from '../helpers';

const saved = { url: env.AI_BASE_URL, key: env.AI_API_KEY, model: env.AI_MODEL, off: env.AI_DISABLED };
beforeEach(async () => {
  await truncateAll();
  Object.assign(env, { AI_BASE_URL: 'https://ai.test/v1/', AI_API_KEY: 'test-key', AI_MODEL: 'test-model' });
  env.AI_DISABLED = false;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  Object.assign(env, { AI_BASE_URL: saved.url, AI_API_KEY: saved.key, AI_MODEL: saved.model });
  env.AI_DISABLED = saved.off;
});
afterAll(() => pool.end());

const SECRET = 'Photosynthesis turns light into sugar in the chloroplast';
const good = {
  slides: [
    { layout: 'title', title: 'Photosynthesis' },
    { layout: 'title-body', title: 'Steps', bullets: ['Light reactions', 'Calvin cycle'] },
  ],
};
const bad = { slides: [{ layout: 'title-body', title: 'x'.repeat(40), bullets: ['a'] }] };
const completion = (content: unknown, tokens = 100) =>
  Response.json({
    choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }],
    usage: { total_tokens: tokens },
  });
type Reply = () => Response | Promise<Response>;
const stub = (...replies: Reply[]) => {
  const fn = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
  replies.forEach((r) => fn.mockImplementationOnce(async () => r()));
  fn.mockImplementation(async () => completion(good));
  vi.stubGlobal('fetch', fn);
  return fn;
};
const sent = (fn: ReturnType<typeof stub>, n = 0) => JSON.parse(fn.mock.calls[n][1].body as string);
const outline = (uid: number | null, body: object = { text: SECRET }) => {
  const req = request(app).post('/api/ai/outline');
  return (uid === null ? req.set(CSRF) : req.set(asUser(uid))).send(body);
};
const count = async (metric: string) =>
  Number(
    (
      await pool.query(`SELECT ucn_count FROM "USAGE_COUNTER_T" WHERE ucn_metric = $1 AND ucn_period = $2`, [
        metric,
        periodKey('day'),
      ])
    ).rows[0]?.ucn_count ?? 0,
  );

describe('AI outline draft (R28)', () => {
  it('AI-TC6: a signed-in active user gets a validated outline from one OpenAI-compatible call', async () => {
    const fetchMock = stub(() => completion(good, 1234));
    const uid = await insertUser();
    const res = await outline(uid);
    expect(res.status).toBe(200);
    expect(res.body.outline).toEqual(good);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://ai.test/v1/chat/completions');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer test-key');
    expect(init.redirect).toBe('error');
    const body = sent(fetchMock);
    expect(body.model).toBe('test-model');
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(['system', 'user']);
    expect(body.messages[1].content).toBe(SECRET);
    expect(await count('ai_requests')).toBe(1);
    expect(await count('ai_tokens')).toBe(1234);
    expect(await count(`ai_tokens:${uid}`)).toBe(1234);
  });

  it('AI-TC7: with no key, no base URL or the kill switch on, the route is 404; production needs an https base URL', async () => {
    const base = { DATABASE_URL: 'postgres://x', JWT_SECRET: 'x'.repeat(16) };
    expect(() => parseEnv({ ...base, NODE_ENV: 'production', AI_BASE_URL: 'http://ai.example/v1' })).toThrow(
      'AI_BASE_URL must be an https:// URL in production',
    );
    expect(parseEnv({ ...base, AI_BASE_URL: 'http://localhost:11434/v1' }).AI_BASE_URL).toBe(
      'http://localhost:11434/v1',
    );
    const fetchMock = stub();
    const uid = await insertUser();
    env.AI_API_KEY = undefined;
    expect((await outline(uid)).status).toBe(404);
    env.AI_API_KEY = 'test-key';
    env.AI_BASE_URL = undefined;
    expect((await outline(uid)).status).toBe(404);
    env.AI_BASE_URL = 'https://ai.test/v1';
    env.AI_DISABLED = true;
    const off = await outline(null);
    expect(off.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('AI-TC8: a guest and a restricted or suspended account are refused', async () => {
    const fetchMock = stub();
    expect((await outline(null)).status).toBe(401);
    expect((await outline(await insertUser({ status: 'restricted' }))).status).toBe(403);
    expect([401, 403]).toContain((await outline(await insertUser({ status: 'suspended' }))).status);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('AI-TC9: text over 8,000 characters, blank text and a full Note are refused before any call', async () => {
    const fetchMock = stub();
    const uid = await insertUser();
    const long = await outline(uid, { text: 'a'.repeat(8_001) });
    expect(long.status).toBe(400);
    expect(long.body.errors.text).toBe('Text must be at most 8,000 characters');
    expect((await outline(uid, { text: '   ' })).status).toBe(400);
    expect((await outline(uid, { text: SECRET, currentSlides: 30 })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await outline(uid, { text: 'a'.repeat(8_000) })).status).toBe(200);
  });

  it('AI-TC10: the outline is cut to the room left on the Note', async () => {
    const many = { slides: Array.from({ length: 15 }, (_, i) => ({ layout: 'title', title: `Part ${i}` })) };
    stub(() => completion(many));
    const res = await outline(await insertUser(), { text: SECRET, currentSlides: 27 });
    expect(res.status).toBe(200);
    expect(res.body.outline.slides).toHaveLength(3);
  });

  it('AI-TC11: the 21st call in a day is refused with a friendly message', async () => {
    vi.stubEnv('RATE_LIMIT_UNDER_TEST', 'aiday');
    const fetchMock = stub();
    const uid = await insertUser();
    expect((await outline(uid)).status).toBe(200);
    await pool.query(`UPDATE "RATE_LIMIT_T" SET rlt_hits = 19 WHERE rlt_key = $1`, [`aiday:user:${uid}`]);
    expect((await outline(uid)).status).toBe(200);
    const limited = await outline(uid);
    expect(limited.status).toBe(429);
    expect(limited.body.error).toBe("You have used today's 20 AI requests. Try again tomorrow.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await outline(await insertUser())).status).toBe(200);
  });

  it('AI-TC12: the 6th call within a minute is refused', async () => {
    vi.stubEnv('RATE_LIMIT_UNDER_TEST', 'ai');
    stub();
    const uid = await insertUser();
    for (let i = 0; i < 5; i++) expect((await outline(uid)).status).toBe(200);
    const limited = await outline(uid);
    expect(limited.status).toBe(429);
    expect(limited.body.error).toBe('Too many AI requests. Try again in a minute.');
  });

  it('AI-TC13: the app-wide cap is 80% of the free tier, and at the cap AI help is resting with no call', async () => {
    expect(METRICS.ai_requests).toEqual({ period: 'day', cap: 800 });
    expect(METRICS.ai_tokens).toEqual({ period: 'day', cap: 160_000 });
    const fetchMock = stub();
    const uid = await insertUser();
    await consume('ai_requests', METRICS.ai_requests.cap);
    const capped = await outline(uid);
    expect(capped.status).toBe(503);
    expect(capped.body.error).toBe('AI help is resting until tomorrow');
    expect(await count(`ai_tokens:${uid}`)).toBe(0);
    await pool.query(`DELETE FROM "USAGE_COUNTER_T"`);
    await consume('ai_tokens', METRICS.ai_tokens.cap - 100);
    expect((await outline(uid)).body.error).toBe('AI help is resting until tomorrow');
    expect(await count(`ai_tokens:${uid}`)).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('AI-TC14: a provider rate limit is a friendly 503, not retried, and any 4xx hands the reserved tokens back', async () => {
    const fetchMock = stub(() => new Response(`rate limited: ${SECRET}`, { status: 429 }));
    const uid = await insertUser();
    const res = await outline(uid);
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('AI help is busy right now. Try again in a minute');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await count('ai_requests')).toBe(1);
    expect(await count('ai_tokens')).toBe(0);
    expect(await count(`ai_tokens:${uid}`)).toBe(0);
    stub(() => new Response('bad request', { status: 400 }));
    expect((await outline(uid)).status).toBe(502);
    expect(await count('ai_requests')).toBe(2);
    expect(await count('ai_tokens')).toBe(0);
    expect(await count(`ai_tokens:${uid}`)).toBe(0);
  });

  it('AI-TC15: an invalid first outline is retried once with the validation error, counted before each call', async () => {
    const counted: number[] = [];
    const fetchMock = stub(
      async () => {
        counted.push(await count('ai_requests'));
        return completion(bad);
      },
      async () => {
        counted.push(await count('ai_requests'));
        return completion(good);
      },
    );
    const res = await outline(await insertUser());
    expect(res.status).toBe(200);
    expect(res.body.outline).toEqual(good);
    expect(counted).toEqual([1, 2]);
    const retry = sent(fetchMock, 1).messages;
    expect(retry.map((m: { role: string }) => m.role)).toEqual(['system', 'user', 'assistant', 'user']);
    expect(retry[3].content).toContain('Title must be at most 24 characters');
  });

  it('AI-TC16: a second invalid outline gives the plain message after two counted calls', async () => {
    const fetchMock = stub(
      () => completion('not json at all'),
      () => completion(bad),
    );
    const res = await outline(await insertUser());
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: "Couldn't tidy this, try shorter text" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await count('ai_requests')).toBe(2);
    expect(await count('ai_tokens')).toBe(200);
  });

  it('AI-TC17: the provider call is stopped after 30 seconds and errors never echo provider text', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    // The deadline fires while the call is in flight, so its reservation is kept.
    const fetchMock = stub(() => Promise.reject(new DOMException('timed out', 'TimeoutError')));
    const uid = await insertUser();
    const res = await outline(uid);
    expect(timeout).toHaveBeenCalledWith(30_000);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('AI help is unavailable right now. Try again later');
    timeout.mockRestore();
    stub(() => new Response(`upstream failed on: ${SECRET}`, { status: 500 }));
    const down = await outline(uid);
    expect(down.status).toBe(502);
    expect(JSON.stringify(down.body)).not.toContain('Photosynthesis');
    // A timeout or 5xx may still have used tokens, so both reservations are kept.
    expect(await count('ai_tokens')).toBeGreaterThan(2 * 4_000);
    expect(await count(`ai_tokens:${uid}`)).toBe(await count('ai_tokens'));
  });

  it("AI-TC20: a user's daily token share stops them long before the app-wide cap", async () => {
    expect(AI.userTokensPerDay).toBe(METRICS.ai_tokens.cap / 10);
    const fetchMock = stub();
    fetchMock.mockImplementation(async () => completion(good, 9_000));
    const uid = await insertUser();
    expect((await outline(uid)).status).toBe(200);
    expect((await outline(uid)).status).toBe(200);
    const spent = await outline(uid);
    expect(spent.status).toBe(429);
    expect(spent.body.error).toBe("You have used today's AI allowance. Try again tomorrow.");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await count('ai_requests')).toBe(2);
    expect(await count('ai_tokens')).toBe(18_000);
    expect(await count('ai_tokens')).toBeLessThan(METRICS.ai_tokens.cap);
    expect((await outline(await insertUser())).status).toBe(200);
  });

  it('AI-TC18: no database client is checked out or in a transaction during the provider call', async () => {
    const seen: { busy: number; idleInTx: number }[] = [];
    const check = async () => {
      const busy = pool.totalCount - pool.idleCount;
      const { rows } = await pool.query(
        `SELECT COUNT(*)::INT AS n FROM pg_stat_activity
         WHERE datname = current_database() AND state LIKE 'idle in transaction%'`,
      );
      seen.push({ busy, idleInTx: rows[0].n });
      return completion(seen.length === 1 ? bad : good);
    };
    stub(check, check);
    expect((await outline(await insertUser())).status).toBe(200);
    expect(seen).toEqual([
      { busy: 0, idleInTx: 0 },
      { busy: 0, idleInTx: 0 },
    ]);
  });

  it('AI-TC19: logs hold counts and latency only, never the student text or the reply', async () => {
    const info = vi.spyOn(logger, 'info');
    const warn = vi.spyOn(logger, 'warn');
    const error = vi.spyOn(logger, 'error');
    stub(
      () => completion(bad),
      () => completion(good, 50),
    );
    expect((await outline(await insertUser())).status).toBe(200);
    const logged = info.mock.calls.filter(([, msg]) => String(msg).startsWith('ai outline'));
    expect(logged).toHaveLength(1);
    expect(logged[0][0]).toEqual({
      inputChars: SECRET.length,
      attempts: 2,
      tokens: 150,
      latencyMs: expect.any(Number),
      slides: 2,
    });
    // The request log line (pino-http) serialises only id, method and path; its raw req is not what is written.
    const own = JSON.stringify([
      ...info.mock.calls.filter(([obj]) => !(obj && typeof obj === 'object' && 'res' in obj)),
      ...warn.mock.calls,
      ...error.mock.calls,
    ]);
    expect(own).not.toContain('Photosynthesis');
    expect(own).not.toContain('Calvin');
    expect(error).not.toHaveBeenCalled();
  });

  it('AI-TC56: a maximum-length outline reserves its real size, and two such calls fit in one daily share', async () => {
    const uid = await insertUser();
    const reserved: number[] = [];
    stub(async () => {
      reserved.push(await count(`ai_tokens:${uid}`));
      return completion(good);
    });
    expect((await outline(uid, { text: 'a'.repeat(AI.outlineChars) })).status).toBe(200);
    const estimate = Math.ceil((OUTLINE_PROMPT.length + AI.outlineChars) / 4) + AI.outlineMaxTokens;
    expect(reserved).toEqual([estimate]);
    expect(2 * estimate).toBeLessThanOrEqual(AI.userTokensPerDay);
    expect(estimate).toBeLessThan(8_000); // Groq's free tokens a minute
  });

  it('AI-TC57: one 30-second deadline covers the retry, so no second call is sent after it', async () => {
    const deadline = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
    const fetchMock = stub(() => {
      // An invalid reply that arrives just as the 30 seconds run out.
      deadline.abort(new DOMException('timed out', 'TimeoutError'));
      return completion('not json at all', 100);
    });
    const uid = await insertUser();
    const res = await outline(uid);
    expect(res.status).toBe(502);
    expect(res.body.error).toBe('AI help is unavailable right now. Try again later');
    expect(timeout).toHaveBeenCalledTimes(1);
    expect(timeout).toHaveBeenCalledWith(30_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].signal).toBe(deadline.signal);
    expect(await count('ai_requests')).toBe(1);
    expect(await count(`ai_tokens:${uid}`)).toBe(100);
  });
});
