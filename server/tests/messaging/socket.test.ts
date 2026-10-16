import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import { io as connect, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { attachSocket } from '../../src/features/messaging/socket';
import { env } from '../../src/lib/env';
import { pool } from '../../src/lib/pool';
import { asUser, befriend, insertNote, insertUser, truncateAll } from '../helpers';

const server = createServer(app);
const io = attachSocket(server);
let url = '';
const open: Socket[] = [];

beforeAll(
  () =>
    new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', () => {
        url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
        resolve();
      }),
    ),
);
beforeEach(truncateAll);
afterEach(() => open.splice(0).forEach((s) => s.disconnect()));
afterAll(async () => {
  await new Promise((resolve) => io.close(resolve)); // also closes the HTTP server
  await pool.end();
});

const cookieOf = (id: number) => asUser(id).Cookie;

/** A socket with the given cookie and Origin; resolves once connected, rejects with the server's refusal. */
function socketAs(cookie: string | null, origin: string | null = env.CLIENT_ORIGIN): Promise<Socket> {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  if (origin) headers.Origin = origin;
  const s = connect(url, { transports: ['websocket'], extraHeaders: headers, reconnection: false, forceNew: true });
  open.push(s);
  return new Promise((resolve, reject) => {
    // The server joins conversation rooms just after connect (one query), so let that settle before a test acts.
    s.once('connect', () => setTimeout(() => resolve(s), 50));
    s.once('connect_error', reject);
  });
}

/** The next `event` on the socket, or a rejection after `ms`. */
const next = <T = Record<string, unknown>>(s: Socket, event: string, ms = 1000) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ${event} within ${ms} ms`)), ms);
    s.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

/** True when no `event` arrives on the socket within `ms`. */
const silent = (s: Socket, event: string, ms = 300) =>
  next(s, event, ms).then(
    () => false,
    () => true,
  );

const post = (who: number, path: string, body: object = {}) => request(app).post(path).set(asUser(who)).send(body);

describe('Socket.io gateway', () => {
  it('MSG-TC1: a connection without a valid cookie is refused', async () => {
    const id = await insertUser();
    const expired = jwt.sign({ role: 'student' }, env.JWT_SECRET, {
      algorithm: 'HS256',
      subject: String(id),
      expiresIn: -10,
    });
    const forged = jwt.sign({ role: 'student' }, 'not-the-secret-at-all', { algorithm: 'HS256', subject: String(id) });
    for (const cookie of [null, `parp_token=${expired}`, `parp_token=${forged}`]) {
      await expect(socketAs(cookie)).rejects.toThrow('Unauthorized');
    }
    await expect(socketAs(cookieOf(id))).resolves.toBeTruthy();
  });

  it('MSG-TC11: a handshake from another Origin, or with none, is refused', async () => {
    const id = await insertUser();
    for (const origin of ['https://evil.example', null]) {
      await expect(socketAs(cookieOf(id), origin)).rejects.toThrow();
    }
  });

  it('MSG-TC22: a suspended or deleted user cannot connect, and suspension cuts open sockets', async () => {
    for (const status of ['suspended', 'deleted'] as const) {
      await expect(socketAs(cookieOf(await insertUser({ status })))).rejects.toThrow('Unauthorized');
    }
    const [admin, u] = [await insertUser({ role: 'admin' }), await insertUser()];
    const s = await socketAs(cookieOf(u));
    const gone = next(s, 'disconnect');
    expect((await post(admin, `/api/admin/users/${u}/suspend`, { reason: 'Spam' })).status).toBe(200);
    expect(await gone).toBe('io server disconnect');
  });

  it('MSG-TC4: a non-friend message from a post becomes a pending request, delivered live to the recipient', async () => {
    const [a, b] = [await insertUser({ displayName: 'Alice' }), await insertUser()];
    const note = await insertNote(a, { title: 'Kernels' });
    const sb = await socketAs(cookieOf(b));
    const live = next<{ request: Record<string, unknown> }>(sb, 'request:new');
    const res = await post(a, '/api/messages', { toUserId: b, body: 'About your post', noteId: note });
    expect(res.status).toBe(202);
    expect((await live).request).toMatchObject({
      id: res.body.request.id,
      sender: { id: a, displayName: 'Alice' },
      body: 'About your post',
      note: { id: note, title: 'Kernels' },
    });
    const rows = (await pool.query(`SELECT mrq_status, mrq_pst_id FROM "MESSAGE_REQUEST_T"`)).rows;
    expect(rows).toEqual([{ mrq_status: 'pending', mrq_pst_id: note }]);
    expect((await pool.query(`SELECT 1 FROM "CONVERSATION_T"`)).rowCount).toBe(0);
  });

  it('MSG-TC6: accepting opens the conversation with the held message and note, notifies the sender, adds no follow', async () => {
    const [a, b] = [await insertUser(), await insertUser()];
    const note = await insertNote(a);
    const { body } = await post(a, '/api/messages', { toUserId: b, body: 'Held', noteId: note });
    const sa = await socketAs(cookieOf(a));
    const notified = next(sa, 'request:accepted');
    const res = await post(b, `/api/message-requests/${body.request.id}/accept`);
    expect(res.status).toBe(200);
    expect(await notified).toEqual({ requestId: body.request.id, conversationId: res.body.conversationId });
    const hist = await request(app).get(`/api/conversations/${res.body.conversationId}/messages`).set(asUser(b));
    expect(hist.body.messages).toEqual([
      expect.objectContaining({
        body: 'Held',
        sender: expect.objectContaining({ id: a }),
        note: expect.objectContaining({ id: note }),
      }),
    ]);
    expect((await pool.query(`SELECT 1 FROM "FOLLOW_T"`)).rowCount).toBe(0);
    // the open conversation now takes messages both ways, live, without a new request
    const live = next<{ message: { body: string } }>(sa, 'message:new');
    expect((await post(b, `/api/conversations/${res.body.conversationId}/messages`, { body: 'Reply' })).status).toBe(
      201,
    );
    expect((await live).message.body).toBe('Reply');
    expect((await post(a, '/api/messages', { toUserId: b, body: 'Again' })).status).toBe(201);
  });

  it('MSG-TC8: friends message directly and the recipient gets message:new within 1 s', async () => {
    const [a, b] = [await insertUser(), await insertUser()];
    await befriend(a, b);
    const sb = await socketAs(cookieOf(b));
    const started = Date.now();
    const live = next<{ conversationId: number; message: { body: string } }>(sb, 'message:new');
    const res = await post(a, '/api/messages', { toUserId: b, body: 'hello' });
    expect(res.status).toBe(201);
    const got = await live;
    expect(Date.now() - started).toBeLessThan(1000);
    expect(got).toMatchObject({ conversationId: res.body.conversationId, message: { body: 'hello' } });
    expect((await pool.query(`SELECT 1 FROM "MESSAGE_REQUEST_T"`)).rowCount).toBe(0);
  });

  it('MSG-TC10: a group is created with owner and members, and a leaver stops receiving its messages', async () => {
    const [a, b, c] = [await insertUser(), await insertUser(), await insertUser()];
    await befriend(a, b);
    await befriend(a, c);
    const [sb, sc] = [await socketAs(cookieOf(b)), await socketAs(cookieOf(c))];
    const created = await post(a, '/api/conversations', { name: 'FYP Team', memberIds: [b, c] });
    expect(created.status).toBe(201);
    const g = created.body.conversation;
    expect(g).toMatchObject({ type: 'group', name: 'FYP Team', ownerId: a });
    expect(g.members.map((m: { id: number }) => m.id).sort()).toEqual([a, b, c].sort());
    const both = [next(sb, 'message:new'), next(sc, 'message:new')];
    await post(a, `/api/conversations/${g.id}/messages`, { body: 'Welcome' });
    await Promise.all(both);
    const removed = next(sc, 'conversation:removed');
    expect((await request(app).delete(`/api/conversations/${g.id}/members/${c}`).set(asUser(c))).status).toBe(200);
    await removed;
    const toB = next(sb, 'message:new');
    const quiet = silent(sc, 'message:new');
    await post(a, `/api/conversations/${g.id}/messages`, { body: 'After' });
    await toB;
    expect(await quiet).toBe(true);
  });

  it('MSG-TC23: typing is relayed to other members, throttled, never stored, and not across a block', async () => {
    const [a, b] = [await insertUser(), await insertUser()];
    await befriend(a, b);
    const { body } = await post(a, '/api/messages', { toUserId: b, body: 'hi' });
    const [sa, sb] = [await socketAs(cookieOf(a)), await socketAs(cookieOf(b))];
    const typing = next(sb, 'typing');
    sa.emit('typing', { conversationId: body.conversationId });
    expect(await typing).toEqual({ conversationId: body.conversationId, userId: a });
    const echoed = silent(sa, 'typing');
    const throttled = silent(sb, 'typing');
    sa.emit('typing', { conversationId: body.conversationId });
    sa.emit('typing', { conversationId: 99999 }); // not a member: ignored
    expect([await echoed, await throttled]).toEqual([true, true]);
    await post(b, `/api/users/${a}/block`);
    const sa2 = await socketAs(cookieOf(a)); // fresh throttle window
    const blocked = silent(sb, 'typing');
    sa2.emit('typing', { conversationId: body.conversationId });
    expect(await blocked).toBe(true);
  });

  it('MSG-TC24: read receipts and deletions reach the other members live', async () => {
    const [a, b] = [await insertUser(), await insertUser()];
    await befriend(a, b);
    const { body } = await post(a, '/api/messages', { toUserId: b, body: 'read me' });
    const sa = await socketAs(cookieOf(a));
    const read = next(sa, 'conversation:read');
    await post(b, `/api/conversations/${body.conversationId}/read`);
    expect(await read).toEqual({ conversationId: body.conversationId, userId: b, messageId: body.message.id });
    const sb = await socketAs(cookieOf(b));
    const deleted = next(sb, 'message:deleted');
    await request(app).delete(`/api/messages/${body.message.id}`).set(asUser(a));
    expect(await deleted).toEqual({ conversationId: body.conversationId, messageId: body.message.id });
  });

  it('MSG-TC25: a note card sent live is checked for each reader', async () => {
    const [a, b, c, author] = [await insertUser(), await insertUser(), await insertUser(), await insertUser()];
    for (const m of [b, c, author]) await befriend(a, m);
    await befriend(b, author);
    const note = await insertNote(author, { visibility: 'contacts', title: 'Friends only' });
    const { body } = await post(a, '/api/conversations', { name: 'G', memberIds: [b, c] });
    const [sb, sc] = [await socketAs(cookieOf(b)), await socketAs(cookieOf(c))];
    const [toB, toC] = [next<{ message: object }>(sb, 'message:new'), next<{ message: object }>(sc, 'message:new')];
    await post(a, `/api/conversations/${body.conversation.id}/messages`, { body: 'look', noteId: note });
    expect((await toB).message).toMatchObject({ note: { id: note, title: 'Friends only' }, noteUnavailable: false });
    expect((await toC).message).toMatchObject({ note: null, noteUnavailable: true });
  });
});
