import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { app } from '../../src/app';
import { periodKey } from '../../src/features/usage/service';
import { env } from '../../src/lib/env';
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
const quiz = { questions: [1, 2, 3].map((n) => ({ q: `Question ${n}?`, a: `Answer ${n}` })) };
const completion = (content: unknown, tokens = 100) =>
  Response.json({ choices: [{ message: { content: JSON.stringify(content) } }], usage: { total_tokens: tokens } });
type Reply = () => Response | Promise<Response>;
const stub = (...replies: Reply[]) => {
  const fn = vi.fn<(url: string, init: RequestInit) => Promise<Response>>();
  replies.forEach((r) => fn.mockImplementationOnce(async () => r()));
  fn.mockImplementation(async () => completion({ text: 'Plain words' }));
  vi.stubGlobal('fetch', fn);
  return fn;
};
const sent = (fn: ReturnType<typeof stub>) => JSON.parse(fn.mock.calls[0][1].body as string);
const rewrite = (uid: number | null, body: object = { text: SECRET, action: 'rewrite' }) => {
  const req = request(app).post('/api/ai/rewrite');
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

describe('AI text-box actions (R28)', () => {
  it('AI-TC30: rewrite and shorten return {text}, quiz returns {questions:[{q,a}]}, each from one call with its own prompt', async () => {
    const uid = await insertUser();
    const prompts: string[] = [];
    for (const [action, reply] of [
      ['rewrite', { text: 'Clearer words' }],
      ['shorten', { text: 'Short' }],
      ['quiz', quiz],
    ] as const) {
      const fetchMock = stub(() => completion(reply, 321));
      const res = await rewrite(uid, { text: SECRET, action });
      expect(res.status).toBe(200);
      expect(res.body).toEqual(reply);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const messages = sent(fetchMock).messages;
      expect(messages.map((m: { role: string }) => m.role)).toEqual(['system', 'user']);
      expect(messages[1].content).toBe(SECRET);
      prompts.push(messages[0].content);
    }
    expect(new Set(prompts).size).toBe(3);
    expect(await count('ai_requests')).toBe(3);
    expect(await count(`ai_tokens:${uid}`)).toBe(3 * 321);
  });

  it('AI-TC31: with the AI off the route is 404; a guest and a restricted account are refused', async () => {
    const fetchMock = stub();
    const uid = await insertUser();
    env.AI_API_KEY = undefined;
    expect((await rewrite(uid)).status).toBe(404);
    env.AI_API_KEY = 'test-key';
    env.AI_DISABLED = true;
    expect((await rewrite(null)).status).toBe(404);
    env.AI_DISABLED = false;
    expect((await rewrite(null)).status).toBe(401);
    expect((await rewrite(await insertUser({ status: 'restricted' }))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('AI-TC32: text over 2,000 characters, blank text and an unknown action are refused before any call', async () => {
    const fetchMock = stub();
    const uid = await insertUser();
    const long = await rewrite(uid, { text: 'a'.repeat(2_001), action: 'shorten' });
    expect(long.status).toBe(400);
    expect(long.body.errors.text).toBe('Text must be at most 2,000 characters');
    expect((await rewrite(uid, { text: '  ', action: 'rewrite' })).status).toBe(400);
    expect((await rewrite(uid, { text: SECRET, action: 'translate' })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await rewrite(uid, { text: 'a'.repeat(2_000), action: 'shorten' })).status).toBe(200);
  });

  it('AI-TC33: the counters are up before the provider call is sent', async () => {
    const uid = await insertUser();
    const seen: number[] = [];
    stub(async () => {
      seen.push(await count('ai_requests'), await count(`ai_tokens:${uid}`));
      return completion({ text: 'ok' });
    });
    expect((await rewrite(uid)).status).toBe(200);
    expect(seen[0]).toBe(1);
    expect(seen[1]).toBeGreaterThan(2_000);
  });

  it('AI-TC34: a provider 429 is a friendly 503 without a retry; a timeout is 502', async () => {
    const uid = await insertUser();
    const fetchMock = stub(() => new Response(`rate limited: ${SECRET}`, { status: 429 }));
    const res = await rewrite(uid);
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('AI help is busy right now. Try again in a minute');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await count(`ai_tokens:${uid}`)).toBe(0);
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation(() => AbortSignal.abort(new DOMException('timed out', 'TimeoutError')));
    stub().mockImplementationOnce(async (_url, init) => {
      init.signal?.throwIfAborted();
      return completion({ text: 'late' });
    });
    expect((await rewrite(uid)).status).toBe(502);
    expect(timeout).toHaveBeenCalledWith(30_000);
  });

  it('AI-TC35: an invalid reply (two quiz questions) is a 422 after one call, and logs hold no text', async () => {
    const info = vi.spyOn(logger, 'info');
    const fetchMock = stub(() => completion({ questions: quiz.questions.slice(0, 2) }, 50));
    const res = await rewrite(await insertUser(), { text: SECRET, action: 'quiz' });
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: "Couldn't do that, try shorter text" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    stub(() => completion({ text: 'Secret reply words' }, 50));
    expect((await rewrite(await insertUser())).status).toBe(200);
    const logged = info.mock.calls.filter(([, msg]) => String(msg).startsWith('ai text'));
    expect(logged.map(([o]) => o)).toEqual([
      { action: 'quiz', inputChars: SECRET.length, tokens: 50, latencyMs: expect.any(Number) },
      { action: 'rewrite', inputChars: SECRET.length, tokens: 50, latencyMs: expect.any(Number) },
    ]);
    const own = JSON.stringify(info.mock.calls.filter(([obj]) => !(obj && typeof obj === 'object' && 'res' in obj)));
    expect(own).not.toContain('Photosynthesis');
    expect(own).not.toContain('Secret reply');
  });
});
