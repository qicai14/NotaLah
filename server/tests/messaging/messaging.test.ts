import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vite-plus/test';
import { app } from '../../src/app';
import { pool } from '../../src/lib/pool';
import { asUser, befriend, insertNote, insertUser, truncateAll, walkPages } from '../helpers';

beforeEach(truncateAll);
afterAll(() => pool.end());

const api = {
  get: (who: number, url: string) => request(app).get(url).set(asUser(who)),
  post: (who: number, url: string, body: object = {}) => request(app).post(url).set(asUser(who)).send(body),
  patch: (who: number, url: string, body: object = {}) => request(app).patch(url).set(asUser(who)).send(body),
  del: (who: number, url: string) => request(app).delete(url).set(asUser(who)),
};
const dm = (from: number, to: number, body = 'hello', extra: object = {}) =>
  api.post(from, '/api/messages', { toUserId: to, body, ...extra });
const send = (from: number, conv: number, body = 'hi', extra: object = {}) =>
  api.post(from, `/api/conversations/${conv}/messages`, { body, ...extra });
const count = async (table: string) => Number((await pool.query(`SELECT COUNT(*) AS n FROM "${table}"`)).rows[0].n);
/** `n` users created in order, so their ids ascend. */
async function users(n: number): Promise<number[]> {
  const ids: number[] = [];
  for (let i = 0; i < n; i++) ids.push(await insertUser({ displayName: `User ${i}` }));
  return ids;
}

/** Two friends with an open direct conversation; returns its id. */
async function friendsChat(a: number, b: number): Promise<number> {
  await befriend(a, b);
  const res = await dm(a, b);
  expect(res.status).toBe(201);
  return res.body.conversationId;
}

/** A group owned by `owner` with `members` (all befriended with the owner first). */
async function group(owner: number, members: number[], name = 'FYP Team'): Promise<number> {
  for (const m of members) await befriend(owner, m);
  const res = await api.post(owner, '/api/conversations', { name, memberIds: members });
  expect(res.status).toBe(201);
  return res.body.conversation.id;
}

describe('Messages', () => {
  it('MSG-TC2: a blank or over-length message is refused and nothing is stored', async () => {
    const [a, b] = await users(2);
    await befriend(a, b);
    for (const body of ['', '   ', '\u0000\u0007', 'x'.repeat(2001)]) {
      const res = await dm(a, b, body);
      expect(res.status).toBe(400);
      expect(res.body.errors.body).toMatch(/Message (is required|must be at most 2000 characters)/);
    }
    expect((await dm(a, b, 'x'.repeat(2000))).status).toBe(201);
    expect(await count('MESSAGE_T')).toBe(1);
  });

  it('MSG-TC3: messaging yourself is refused', async () => {
    const [a] = await users(1);
    const res = await dm(a, a);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('You cannot message yourself');
    expect(await count('MESSAGE_REQUEST_T')).toBe(0);
  });

  it('MSG-TC5: a second request while one is pending is refused, in either direction', async () => {
    const [a, b] = await users(2);
    expect((await dm(a, b)).status).toBe(202);
    for (const [from, to] of [
      [a, b],
      [b, a],
    ]) {
      const res = await dm(from, to, 'again');
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('A message request between you is already pending');
    }
    expect(await count('MESSAGE_REQUEST_T')).toBe(1);
  });

  it('MSG-TC7: declining creates no conversation or follow and empties the inbox', async () => {
    const [a, b] = await users(2);
    const { body } = await dm(a, b, 'hi there');
    const inbox = await api.get(b, '/api/message-requests');
    expect(inbox.body.requests).toEqual([
      {
        id: body.request.id,
        sender: { id: a, displayName: 'User 0' },
        body: 'hi there',
        note: null,
        noteUnavailable: false,
        createdAt: expect.any(String),
      },
    ]);
    expect((await api.post(a, `/api/message-requests/${body.request.id}/decline`)).status).toBe(404); // only the recipient answers
    expect((await api.post(b, `/api/message-requests/${body.request.id}/decline`)).status).toBe(204);
    expect((await api.post(b, `/api/message-requests/${body.request.id}/accept`)).status).toBe(404);
    expect((await pool.query(`SELECT mrq_status FROM "MESSAGE_REQUEST_T"`)).rows).toEqual([{ mrq_status: 'declined' }]);
    expect([await count('CONVERSATION_T'), await count('FOLLOW_T')]).toEqual([0, 0]);
    expect((await api.get(b, '/api/message-requests')).body.requests).toEqual([]);
  });

  it('MSG-TC9: invalid group input is refused with a message for each case', async () => {
    const [a, b, c, stranger] = await users(4);
    await befriend(a, b);
    await befriend(a, c);
    const create = (body: object) => api.post(a, '/api/conversations', body);
    expect((await create({ name: '', memberIds: [b, c] })).body.errors).toEqual({ name: 'Name is required' });
    expect((await create({ name: 'G', memberIds: [b] })).body.errors).toEqual({ memberIds: 'Add at least 2 friends' });
    expect((await create({ name: 'G', memberIds: [b, b] })).body.errors).toEqual({
      memberIds: 'Each member can be added once',
    });
    expect((await create({ name: 'G', memberIds: [a, b] })).body.errors).toEqual({
      memberIds: 'You are already in the group',
    });
    const res = await create({ name: 'G', memberIds: [b, stranger] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('You can only add your friends');
    expect(await count('CONVERSATION_T')).toBe(0);
  });

  it('MSG-TC12: a suspended or deleted user cannot be messaged', async () => {
    const [a] = await users(1);
    for (const status of ['suspended', 'deleted'] as const) {
      const b = await insertUser({ status });
      await befriend(a, b);
      const res = await dm(a, b);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User not found');
    }
    // an existing chat with someone later suspended stays readable but takes no new messages
    const c = await insertUser();
    const conv = await friendsChat(a, c);
    await pool.query(`UPDATE "USER_T" SET usr_status = 'suspended' WHERE usr_id = $1`, [c]);
    expect((await send(a, conv)).status).toBe(403);
    expect((await api.get(a, `/api/conversations/${conv}/messages`)).body.messages).toHaveLength(1);
  });

  it('MSG-TC13: a block either way stops messages, requests, accepting and hides the direct chat', async () => {
    const [a, b, c, d] = await users(4);
    const conv = await friendsChat(a, b);
    const { body } = await dm(c, a);
    await befriend(c, d);
    expect((await api.post(b, `/api/users/${a}/block`)).status).toBe(201);
    expect((await api.post(a, `/api/users/${c}/block`)).status).toBe(201);
    for (const [from, to] of [
      [a, b],
      [b, a],
      [a, c],
      [c, a],
    ])
      expect((await dm(from, to)).status).toBe(404);
    for (const who of [a, b]) {
      expect((await send(who, conv)).status).toBe(404);
      expect((await api.get(who, `/api/conversations/${conv}/messages`)).status).toBe(404);
      expect((await api.get(who, '/api/conversations')).body.conversations).toEqual([]);
    }
    expect((await api.get(a, '/api/message-requests')).body.requests).toEqual([]);
    expect((await api.post(a, `/api/message-requests/${body.request.id}/accept`)).status).toBe(404);
    // a member cannot add someone in a block with any member
    const g = await group(d, [c, await insertUser()]);
    await befriend(d, a);
    const res = await api.post(d, `/api/conversations/${g}/members`, { userId: a });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('These users cannot be in the same group');
    // unblocking restores the chat and its history
    await api.del(b, `/api/users/${a}/block`);
    expect((await api.get(a, `/api/conversations/${conv}/messages`)).body.messages).toHaveLength(1);
    expect((await send(b, conv)).status).toBe(201);
  });

  it('MSG-TC14: a restricted user can read, answer requests and leave, but not send or create groups', async () => {
    const [r, b, c, d] = await users(4);
    const conv = await friendsChat(b, r);
    const g = await group(b, [r, c]);
    await befriend(r, c);
    await befriend(r, d);
    const { body } = await dm(await insertUser(), r);
    await pool.query(`UPDATE "USER_T" SET usr_status = 'restricted' WHERE usr_id = $1`, [r]);
    const restricted = 'Your account is restricted and cannot perform this action';
    for (const res of [
      await send(r, conv),
      await dm(r, c),
      await api.post(r, '/api/conversations', { name: 'G', memberIds: [c, d] }),
      await api.post(r, `/api/conversations/${g}/members`, { userId: d }),
    ]) {
      expect(res.status).toBe(403);
      expect(res.body.error).toBe(restricted);
    }
    expect((await api.get(r, `/api/conversations/${conv}/messages`)).status).toBe(200);
    expect((await api.post(r, `/api/conversations/${conv}/read`)).status).toBe(200);
    expect((await api.post(r, `/api/message-requests/${body.request.id}/accept`)).status).toBe(200);
    expect((await api.del(r, `/api/conversations/${g}/members/${r}`)).status).toBe(200);
    // others can still message a restricted user
    expect((await send(b, conv)).status).toBe(201);
  });

  it('MSG-TC15: only a note the sender can see is attached, and the card is re-checked for each reader', async () => {
    const [a, b, author] = await users(3);
    const conv = await friendsChat(a, b);
    const draft = await insertNote(author, { status: 'draft' });
    expect((await send(a, conv, 'see', { noteId: draft })).body).toEqual({ error: 'Note not found' });
    expect((await send(a, conv, 'see', { noteId: 999999 })).status).toBe(400);
    const friendsOnly = await insertNote(author, { visibility: 'contacts', title: 'Friends only' });
    await befriend(a, author);
    const res = await send(a, conv, 'see', { noteId: friendsOnly });
    expect(res.status).toBe(201);
    expect(res.body.message.note).toEqual({ id: friendsOnly, title: 'Friends only' });
    const hist = async (who: number) => (await api.get(who, `/api/conversations/${conv}/messages`)).body.messages[0];
    expect(await hist(b)).toMatchObject({ note: null, noteUnavailable: true }); // b is not the author's friend
    expect(await hist(a)).toMatchObject({ note: { id: friendsOnly }, noteUnavailable: false });
    await pool.query(`UPDATE "POST_T" SET pst_status = 'deleted' WHERE pst_id = $1`, [friendsOnly]);
    expect(await hist(a)).toMatchObject({ note: null, noteUnavailable: true });
  });

  it('MSG-TC16: a reply must point at a live message in the same conversation', async () => {
    const [a, b, c] = await users(3);
    const conv = await friendsChat(a, b);
    const other = await friendsChat(a, c);
    const first = (await api.get(a, `/api/conversations/${conv}/messages`)).body.messages[0].id;
    const elsewhere = (await api.get(a, `/api/conversations/${other}/messages`)).body.messages[0].id;
    const bad = await send(b, conv, 'reply', { replyToId: elsewhere });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('You can only reply to a message in this conversation');
    const ok = await send(b, conv, 'reply', { replyToId: first });
    expect(ok.status).toBe(201);
    expect(ok.body.message.replyTo).toEqual({ id: first, senderId: a, body: 'hello' });
    await api.del(a, `/api/messages/${first}`);
    expect((await send(b, conv, 'again', { replyToId: first })).status).toBe(400);
    const hist = (await api.get(b, `/api/conversations/${conv}/messages`)).body.messages;
    expect(hist[0].replyTo).toEqual({ id: first, senderId: a, body: null });
  });

  it('MSG-TC17: only the sender soft-deletes a message, which keeps no body or note', async () => {
    const [a, b] = await users(2);
    const conv = await friendsChat(a, b);
    const note = await insertNote(a);
    const id = (await send(a, conv, 'secret', { noteId: note })).body.message.id;
    expect((await api.del(b, `/api/messages/${id}`)).status).toBe(404);
    expect((await api.del(a, `/api/messages/${id}`)).status).toBe(204);
    expect((await api.del(a, `/api/messages/${id}`)).status).toBe(404);
    const [latest] = (await api.get(b, `/api/conversations/${conv}/messages`)).body.messages;
    expect(latest).toMatchObject({ id, body: null, deleted: true, note: null, noteUnavailable: false });
    expect((await pool.query(`SELECT msg_body, msg_pst_id FROM "MESSAGE_T" WHERE msg_id = $1`, [id])).rows[0]).toEqual({
      msg_body: '',
      msg_pst_id: null,
    });
    expect((await api.get(b, '/api/conversations')).body.conversations[0].lastMessage).toMatchObject({
      id,
      body: null,
      deleted: true,
    });
  });

  it('MSG-TC18: the conversation list shows the last message, unread counts and read receipts', async () => {
    const [a, b, c] = await users(3);
    const first = await friendsChat(a, b);
    const second = await friendsChat(a, c);
    await send(b, first, 'one');
    const two = (await send(b, first, 'two')).body.message.id;
    const list = (await api.get(a, '/api/conversations')).body;
    expect(list.conversations.map((x: { id: number }) => x.id)).toEqual([first, second]);
    expect(list.conversations[0]).toMatchObject({
      type: 'direct',
      unreadCount: 2,
      lastMessage: { id: two, senderId: b, body: 'two' },
    });
    expect(list.conversations[1].unreadCount).toBe(0); // own messages are never unread
    const read = await api.post(a, `/api/conversations/${first}/read`, { messageId: two - 1 });
    expect(read.body).toEqual({ lastReadMessageId: two - 1 });
    expect((await api.get(a, `/api/conversations/${first}`)).body.conversation.unreadCount).toBe(1);
    await api.post(a, `/api/conversations/${first}/read`);
    await api.post(a, `/api/conversations/${first}/read`, { messageId: 1 }); // never moves backwards
    const conv = (await api.get(b, `/api/conversations/${first}`)).body.conversation;
    expect(conv.members).toContainEqual({ id: a, displayName: 'User 0', lastReadMessageId: two });
    expect((await api.get(a, `/api/conversations/${first}`)).body.conversation.unreadCount).toBe(0);
    expect((await api.post(c, `/api/conversations/${first}/read`)).status).toBe(404);
  });

  it('MSG-TC19: history pages 50 at a time, newest first, without gaps', async () => {
    const [a, b] = await users(2);
    const conv = await friendsChat(a, b);
    await pool.query(
      `INSERT INTO "MESSAGE_T" (msg_cnv_id, msg_sender_id, msg_body) SELECT $1, $2, 'm' || g FROM generate_series(1, 119) g`,
      [conv, a],
    );
    const pages = await walkPages<{ id: number }>(
      (cursor) => api.get(b, `/api/conversations/${conv}/messages${cursor ? `?cursor=${cursor}` : ''}`),
      'messages',
    );
    expect(pages.map((p) => p.length)).toEqual([50, 50, 20]);
    const ids = pages.flat().map((m) => m.id);
    expect(ids).toEqual([...ids].sort((x, y) => y - x));
    expect(new Set(ids).size).toBe(120);
    expect((await api.get(b, `/api/conversations/${conv}/messages?cursor=x`)).status).toBe(400);
  });

  it('MSG-TC20: members add their own friends up to 30, never twice', async () => {
    const [owner, b, c, d, stranger] = await users(5);
    const g = await group(owner, [b, c]);
    await befriend(b, d);
    const add = (who: number, userId: number) => api.post(who, `/api/conversations/${g}/members`, { userId });
    expect((await add(b, stranger)).body.error).toBe('You can only add your friends');
    expect((await add(stranger, d)).status).toBe(404); // not a member
    const added = await add(b, d);
    expect(added.status).toBe(201);
    expect(added.body.conversation.members.map((m: { id: number }) => m.id)).toEqual([owner, b, c, d]);
    expect((await add(b, d)).status).toBe(409);
    expect((await api.get(d, `/api/conversations/${g}`)).body.conversation.unreadCount).toBe(0);
    const more = await users(26);
    for (const m of more) await befriend(owner, m);
    for (const m of more.slice(0, 26)) expect((await add(owner, m)).status).toBe(201);
    const extra = await insertUser();
    await befriend(owner, extra);
    const full = await add(owner, extra);
    expect(full.status).toBe(409);
    expect(full.body.error).toBe('A group has at most 30 members');
    // a direct chat is not a group
    expect(
      (await api.post(owner, `/api/conversations/${await friendsChat(owner, extra)}/members`, { userId: b })).status,
    ).toBe(404);
  });

  it('MSG-TC21: the owner renames and removes; when the owner leaves the earliest member takes over', async () => {
    const [owner, b, c] = await users(3);
    const g = await group(owner, [b, c]);
    expect((await api.patch(b, `/api/conversations/${g}`, { name: 'Mine' })).status).toBe(403);
    expect((await api.del(b, `/api/conversations/${g}/members/${c}`)).body.error).toBe(
      'Only the group owner can do this',
    );
    const renamed = await api.patch(owner, `/api/conversations/${g}`, { name: '  Study Group ' });
    expect(renamed.body.conversation.name).toBe('Study Group');
    expect((await api.patch(owner, `/api/conversations/${g}`, { name: 'x'.repeat(81) })).status).toBe(400);
    expect((await api.del(owner, `/api/conversations/${g}/members/${owner}`)).body).toEqual({ ownerId: b });
    expect((await api.get(owner, `/api/conversations/${g}`)).status).toBe(404);
    expect((await api.del(b, `/api/conversations/${g}/members/${c}`)).body).toEqual({ ownerId: b });
    expect((await api.del(b, `/api/conversations/${g}/members/${c}`)).status).toBe(404);
    expect((await api.del(b, `/api/conversations/${g}/members/${b}`)).body).toEqual({ ownerId: null });
    expect(await count('CONVERSATION_T')).toBe(0);
  });

  it('MSG-TC26: two concurrent adds to a group of 29 leave exactly 30 members', async () => {
    const [owner, ...rest] = await users(31);
    const g = await group(owner, rest.slice(0, 28));
    const [x, y] = rest.slice(28);
    await befriend(owner, x);
    await befriend(owner, y);
    // Hold the group row so both adds are queued on its lock at once, then release it.
    const holder = await pool.connect();
    await holder.query('BEGIN');
    await holder.query(`SELECT 1 FROM "CONVERSATION_T" WHERE cnv_id = $1 FOR UPDATE`, [g]);
    // .then() sends each request now; a supertest request is lazy until awaited.
    const adds = [x, y].map((userId) => api.post(owner, `/api/conversations/${g}/members`, { userId }).then((r) => r));
    await new Promise((resolve) => setTimeout(resolve, 300));
    await holder.query('COMMIT');
    holder.release();
    const results = await Promise.all(adds);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409]);
    expect(
      (await pool.query(`SELECT COUNT(*)::INT AS n FROM "CONV_MEMBER_T" WHERE cmb_cnv_id = $1`, [g])).rows[0].n,
    ).toBe(30);
  });

  it('MSG-TC27: a direct message between new friends accepts the pending request and keeps history in order', async () => {
    const [a, b] = await users(2);
    const note = await insertNote(a);
    expect((await dm(a, b, 'held', { noteId: note })).status).toBe(202);
    await befriend(a, b);
    const res = await dm(b, a, 'later');
    expect(res.status).toBe(201);
    expect((await pool.query(`SELECT mrq_status FROM "MESSAGE_REQUEST_T"`)).rows).toEqual([{ mrq_status: 'accepted' }]);
    const hist = (await api.get(a, `/api/conversations/${res.body.conversationId}/messages`)).body.messages;
    expect(hist.map((m: { body: string }) => m.body)).toEqual(['later', 'held']);
    expect(hist[1]).toMatchObject({ sender: { id: a }, note: { id: note } });
    expect(new Date(hist[1].createdAt) <= new Date(hist[0].createdAt)).toBe(true);
    expect((await api.get(b, '/api/message-requests')).body.requests).toEqual([]);
  });
});
