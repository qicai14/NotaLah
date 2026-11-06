import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { app } from '../../src/app';
import { signToken } from '../../src/features/auth/passport';
import type { AuthUser } from '../../src/features/users/repository';
import { env } from '../../src/lib/env';
import { pool } from '../../src/lib/pool';
import { asUser, CSRF, insertNote, insertUser, textSlide, truncateAll } from '../helpers';

const saved = { url: env.AI_BASE_URL, key: env.AI_API_KEY, model: env.AI_MODEL, off: env.AI_DISABLED };
beforeEach(async () => {
  await truncateAll();
  Object.assign(env, { AI_BASE_URL: 'https://ai.test/v1/', AI_API_KEY: 'test-key', AI_MODEL: 'test-model' });
  env.AI_DISABLED = false;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.assign(env, { AI_BASE_URL: saved.url, AI_API_KEY: saved.key, AI_MODEL: saved.model });
  env.AI_DISABLED = saved.off;
});
afterAll(() => pool.end());

const outline = { slides: [{ layout: 'title', title: 'Photosynthesis' }] };
const completion = (content: unknown) =>
  Response.json({ choices: [{ message: { content: JSON.stringify(content) } }], usage: { total_tokens: 100 } });
const reply = (content: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => completion(content)),
  );

/** An AI token for `uid`, from a real /api/ai/rewrite reply. */
async function aiToken(uid: number): Promise<string> {
  reply({ text: 'Clearer words' });
  const res = await request(app)
    .post('/api/ai/rewrite')
    .set(asUser(uid))
    .send({ text: 'Some words', action: 'rewrite' });
  expect(res.status).toBe(200);
  return res.body.aiToken as string;
}

const draft = (over: object = {}) => ({ title: 'Cells', slides: [textSlide('<p>one</p>')], status: 'draft', ...over });
const create = (uid: number, over: object = {}) => request(app).post('/api/notes').set(asUser(uid)).send(draft(over));
const update = (uid: number, id: number, over: object = {}) =>
  request(app).put(`/api/notes/${id}`).set(asUser(uid)).send(draft(over));
const labelled = async (id: number) =>
  (await pool.query(`SELECT pst_ai_assisted_at FROM "POST_T" WHERE pst_id = $1`, [id])).rows[0].pst_ai_assisted_at;

describe('AI-assisted label (R28, ADR 0094)', () => {
  it('AI-TC46: outline and every rewrite action reply with an ai-output token for the caller that lasts 24 hours', async () => {
    const uid = await insertUser();
    reply(outline);
    const res = await request(app).post('/api/ai/outline').set(asUser(uid)).send({ text: 'Light into sugar' });
    expect(res.status).toBe(200);
    const tokens = [res.body.aiToken];
    for (const [action, content] of [
      ['rewrite', { text: 'Clearer' }],
      ['shorten', { text: 'Short' }],
      ['quiz', { questions: [1, 2, 3].map((n) => ({ q: `Q${n}?`, a: `A${n}` })) }],
    ] as const) {
      reply(content);
      const r = await request(app).post('/api/ai/rewrite').set(asUser(uid)).send({ text: 'Some words', action });
      expect(r.status).toBe(200);
      tokens.push(r.body.aiToken);
    }
    for (const t of tokens) {
      const p = jwt.decode(t, { json: true });
      expect(p).toMatchObject({ aud: 'ai-output', sub: String(uid) });
      expect(p!.exp! - p!.iat!).toBe(24 * 3600);
    }
  });

  it('AI-TC47: an AI token sent as the session cookie is refused with 401', async () => {
    const uid = await insertUser();
    const token = await aiToken(uid);
    const res = await request(app)
      .get('/api/auth/me')
      .set({ Cookie: `notalah_token=${token}`, ...CSRF });
    expect(res.status).toBe(401);
    // and a write with it is refused, so it cannot save a note either
    const write = await request(app)
      .post('/api/notes')
      .set({ Cookie: `notalah_token=${token}`, ...CSRF })
      .send(draft());
    expect(write.status).toBe(401);
  });

  it('AI-TC48: a session token sent as the AI token does not set the label', async () => {
    const uid = await insertUser();
    const session = signToken({ id: uid, role: 'student' } as AuthUser);
    const res = await create(uid, { aiToken: session });
    expect(res.status).toBe(201);
    expect(res.body.note.aiAssisted).toBe(false);
    expect(await labelled(res.body.note.id)).toBeNull();
    // Signed with the raw session secret but shaped like an AI token: refused because the key differs.
    const rawKey = jwt.sign({}, env.JWT_SECRET, {
      algorithm: 'HS256',
      audience: 'ai-output',
      subject: String(uid),
      expiresIn: '24h',
    });
    const raw = await create(uid, { aiToken: rawKey });
    expect(raw.status).toBe(201);
    expect(raw.body.note.aiAssisted).toBe(false);
  });

  it('AI-TC49: the owner saving with a valid token sets the label on create and on update', async () => {
    const uid = await insertUser();
    const token = await aiToken(uid);
    const created = await create(uid, { aiToken: token });
    expect(created.status).toBe(201);
    expect(created.body.note.aiAssisted).toBe(true);

    const plain = await create(uid);
    expect(plain.body.note.aiAssisted).toBe(false);
    const updated = await update(uid, plain.body.note.id, { aiToken: token });
    expect(updated.status).toBe(200);
    expect(updated.body.note.aiAssisted).toBe(true);
    const got = await request(app).get(`/api/notes/${plain.body.note.id}`).set(asUser(uid));
    expect(got.body.note.aiAssisted).toBe(true);
  });

  it('AI-TC50: an edit collaborator saving with their own token sets the label', async () => {
    const owner = await insertUser();
    const editor = await insertUser();
    const id = await insertNote(owner, { status: 'draft' });
    await pool.query(
      `INSERT INTO "COLLABORATOR_T" (clb_pst_id, clb_usr_id, clb_role, clb_added_by) VALUES ($1, $2, 'edit', $3)`,
      [id, editor, owner],
    );
    const base = (await request(app).get(`/api/notes/${id}`).set(asUser(editor))).body.note;
    const res = await update(editor, id, {
      aiToken: await aiToken(editor),
      title: 'A note',
      moduleId: base.module.id,
      visibility: base.visibility,
      baseUpdatedAt: base.updatedAt,
    });
    expect(res.status).toBe(200);
    expect(res.body.note.aiAssisted).toBe(true);
  });

  it('AI-TC51: no token, a forged token and an expired token save but leave the label off', async () => {
    const uid = await insertUser();
    const forged = jwt.sign({}, 'not-the-derived-key-at-all', {
      audience: 'ai-output',
      subject: String(uid),
      expiresIn: '24h',
    });
    for (const aiToken of [undefined, '', 'garbage', forged, 42]) {
      const res = await create(uid, { aiToken });
      expect(res.status).toBe(201);
      expect(res.body.note.aiAssisted).toBe(false);
    }
    const token = await aiToken(uid);
    const later = Date.now() + 24 * 3600 * 1000 + 1000;
    vi.spyOn(Date, 'now').mockReturnValue(later);
    const res = await create(uid, { aiToken: token });
    expect(res.status).toBe(201);
    expect(res.body.note.aiAssisted).toBe(false);
  });

  it("AI-TC52: a token issued to one user is ignored on another user's save", async () => {
    const owner = await insertUser();
    const other = await insertUser();
    const res = await create(owner, { aiToken: await aiToken(other) });
    expect(res.status).toBe(201);
    expect(res.body.note.aiAssisted).toBe(false);
  });

  it('AI-TC53: once set the label stays after later saves, and the client cannot clear or set it by itself', async () => {
    const uid = await insertUser();
    const res = await create(uid, { aiToken: await aiToken(uid) });
    const id = res.body.note.id as number;
    const first = await labelled(id);
    expect(first).not.toBeNull();
    const again = await update(uid, id, { aiAssisted: false, pst_ai_assisted_at: null });
    expect(again.body.note.aiAssisted).toBe(true);
    expect(await update(uid, id, { aiToken: await aiToken(uid) })).toMatchObject({ status: 200 });
    expect(await labelled(id)).toEqual(first); // the first time is kept
    const spoof = await create(uid, { aiAssisted: true });
    expect(spoof.body.note.aiAssisted).toBe(false);
  });

  it('AI-TC54: the feed order is the same with and without the label, and cards carry the flag', async () => {
    const author = await insertUser();
    const viewer = await insertUser();
    const ids = [];
    for (let i = 0; i < 4; i++) ids.push(await insertNote(author, { title: `Note ${i}` }));
    const order = async () =>
      (
        (await request(app).get('/api/feed').set(asUser(viewer))).body.items as { id: number; aiAssisted: boolean }[]
      ).map(({ id, aiAssisted }) => ({ id, aiAssisted }));
    const before = await order();
    expect(before.every((i) => !i.aiAssisted)).toBe(true);
    await pool.query(`UPDATE "POST_T" SET pst_ai_assisted_at = NOW() WHERE pst_id = ANY($1)`, [[ids[0], ids[2]]]);
    const after = await order();
    expect(after.map((i) => i.id)).toEqual(before.map((i) => i.id));
    expect(
      after
        .filter((i) => i.aiAssisted)
        .map((i) => i.id)
        .sort((a, b) => a - b),
    ).toEqual([ids[0], ids[2]]);
  });
});
