import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { insertNotifications } from '../../src/features/notifications/repository';
import { notify } from '../../src/features/notifications/service';
import { purgeAll } from '../../src/lib/purge';
import { pool } from '../../src/lib/pool';
import { asUser, befriend, insertNote, insertUser, truncateAll, walkPages } from '../helpers';

beforeEach(truncateAll);
afterAll(() => pool.end());

const api = {
  get: (who: number, url: string) => request(app).get(url).set(asUser(who)),
  put: (who: number, url: string, body: object = {}) => request(app).put(url).set(asUser(who)).send(body),
  post: (who: number, url: string, body: object = {}) => request(app).post(url).set(asUser(who)).send(body),
  del: (who: number, url: string) => request(app).delete(url).set(asUser(who)),
};

interface Item {
  id: number;
  type: string;
  read: boolean;
  actor: { id: number; displayName: string } | null;
  note: { id: number; title: string } | null;
  commentId: number | null;
  requestId: number | null;
  requestStatus: string | null;
}

const inbox = async (who: number): Promise<Item[]> => (await api.get(who, '/api/notifications?limit=100').expect(200)).body.notifications;
const types = async (who: number) => (await inbox(who)).map((n) => n.type);
const unread = async (who: number) => (await api.get(who, '/api/notifications/unread-count').expect(200)).body.unreadCount;
const lecturer = (displayName = 'Dr Lee') =>
  insertUser({ displayName, role: 'lecturer', lecturerStatus: 'approved', staffId: `S${Math.random()}`.slice(0, 12) });
const ageAll = (minutes: number) =>
  pool.query(`UPDATE "NOTIFICATION_T" SET ntf_created_at = ntf_created_at - make_interval(mins => $1)`, [minutes]);

async function editBody(owner: number, note: number, over: object = {}) {
  const n = (await api.get(owner, `/api/notes/${note}`)).body.note;
  return {
    title: n.title,
    slides: n.slides.map((s: { content: string }) => s.content),
    moduleId: n.module?.id ?? null,
    hashtags: n.hashtags.length ? n.hashtags : ['notes'],
    status: n.status,
    visibility: n.visibility,
    ...over,
  };
}

describe('Notification triggers', () => {
  it('NTF-TC1: a mention reaches thread participants and the commenter\'s friends only', async () => {
    const author = await insertUser({ displayName: 'Ann Author' });
    const root = await insertUser({ displayName: 'Ben Root' });
    const replier = await insertUser({ displayName: 'Cat Replier' });
    const commenter = await insertUser({ displayName: 'Dan Commenter' });
    const friend = await insertUser({ displayName: 'Eve Friend' });
    const stranger = await insertUser({ displayName: 'Fay Stranger' });
    const otherThread = await insertUser({ displayName: 'Gus Other' });
    const unnamed = await insertUser({ displayName: 'Hal Unnamed' });
    await befriend(commenter, friend);
    await befriend(commenter, unnamed);
    const note = await insertNote(author);
    const top = (await api.post(root, `/api/notes/${note}/comments`, { body: 'Question' }).expect(201)).body.comment.id;
    await api.post(replier, `/api/notes/${note}/comments`, { body: 'Same question', parentId: top }).expect(201);
    await api.post(otherThread, `/api/notes/${note}/comments`, { body: 'Another thread' }).expect(201);

    const body = '@Ann Author @Ben Root @Cat Replier @Eve Friend @Fay Stranger @Gus Other @Dan Commenter thanks';
    const mentions = [author, root, replier, friend, stranger, otherThread, unnamed, commenter, 999999];
    const reply = await api.post(commenter, `/api/notes/${note}/comments`, { body, parentId: top, mentions }).expect(201);

    for (const who of [author, root, replier, friend]) {
      const [n] = await inbox(who);
      expect(n).toMatchObject({ type: 'mention', read: false, actor: { id: commenter, displayName: 'Dan Commenter' },
        note: { id: note, title: 'A note' }, commentId: reply.body.comment.id });
    }
    for (const who of [stranger, otherThread, unnamed, commenter]) expect(await types(who)).toEqual([]);
  });

  it('NTF-TC2: mentions skip users who cannot see the note, and bad mention lists are refused', async () => {
    const author = await insertUser({ displayName: 'Ann' });
    const commenter = await insertUser({ displayName: 'Ben' });
    const outsider = await insertUser({ displayName: 'Cy' });
    await befriend(author, commenter);
    await befriend(commenter, outsider); // a friend of the commenter, not of the author
    const note = await insertNote(author, { visibility: 'contacts' });
    await api.post(commenter, `/api/notes/${note}/comments`, { body: '@Ann @Cy look', mentions: [author, outsider] }).expect(201);
    expect(await types(author)).toEqual(['mention']);
    expect(await types(outsider)).toEqual([]);

    for (const mentions of ['1', [0], [1.5], Array.from({ length: 11 }, (_, i) => i + 1)]) {
      expect((await api.post(commenter, `/api/notes/${note}/comments`, { body: 'x', mentions })).status).toBe(400);
    }
  });

  it('NTF-TC3: a Super Like notifies the author once', async () => {
    const author = await insertUser();
    const lect = await lecturer();
    const note = await insertNote(author);
    await api.post(lect, `/api/notes/${note}/verify`).expect(201);
    await api.post(lect, `/api/notes/${note}/verify`).expect(200);
    await api.del(lect, `/api/notes/${note}/verify`).expect(200);
    await api.post(lect, `/api/notes/${note}/verify`).expect(201); // withdrawn and given again within the window
    const items = await inbox(author);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: 'super_like', actor: { id: lect }, note: { id: note } });
  });

  it('NTF-TC4: a new follower notifies once per dedupe window', async () => {
    const a = await insertUser();
    const b = await insertUser();
    await api.post(a, `/api/users/${b}/follow`).expect(201);
    await api.post(a, `/api/users/${b}/follow`).expect(200);
    await api.del(a, `/api/users/${b}/follow`).expect(200);
    await api.post(a, `/api/users/${b}/follow`).expect(201);
    expect(await types(b)).toEqual(['follow']);
    await ageAll(61);
    await api.del(a, `/api/users/${b}/follow`).expect(200);
    await api.post(a, `/api/users/${b}/follow`).expect(201);
    expect(await types(b)).toEqual(['follow', 'follow']);
    expect(await types(a)).toEqual([]);
  });

  it('NTF-TC5: lecturer approval and rejection notify the applicant without naming the admin', async () => {
    const admin = await insertUser({ role: 'admin' });
    const yes = await insertUser({ lecturerStatus: 'pending', staffId: 'S1' });
    const no = await insertUser({ lecturerStatus: 'pending', staffId: 'S2' });
    await api.post(admin, `/api/admin/lecturer-applications/${yes}/approve`).expect(200);
    await api.post(admin, `/api/admin/lecturer-applications/${no}/reject`, { reason: 'Not staff' }).expect(200);
    expect(await inbox(yes)).toMatchObject([{ type: 'lecturer_approved', actor: null }]);
    expect(await inbox(no)).toMatchObject([{ type: 'lecturer_rejected', actor: null }]);
  });

  it('NTF-TC6: hiding a note notifies its author; dismissing does not', async () => {
    const admin = await insertUser({ role: 'admin' });
    const author = await insertUser();
    const reporter = await insertUser();
    const hidden = await insertNote(author, { title: 'Hidden one' });
    const kept = await insertNote(author);
    for (const n of [hidden, kept]) await api.post(reporter, `/api/notes/${n}/report`, { reason: 'spam' }).expect(201);
    await api.post(admin, `/api/admin/reports/${kept}/resolve`, { outcome: 'dismiss', remark: 'Fine' }).expect(200);
    await api.post(admin, `/api/admin/reports/${hidden}/resolve`, { outcome: 'hide', remark: 'Spam' }).expect(200);
    expect(await inbox(author)).toMatchObject([{ type: 'note_hidden', actor: null, note: { id: hidden, title: 'Hidden one' } }]);
  });

  it('NTF-TC7: a message request is stored with its id and status', async () => {
    const a = await insertUser();
    const b = await insertUser();
    const sent = await api.post(a, '/api/messages', { toUserId: b, body: 'Hi' }).expect(202);
    expect(await inbox(b)).toMatchObject([{ type: 'message_request', actor: { id: a }, requestId: sent.body.request.id, requestStatus: 'pending' }]);
    await api.post(b, `/api/message-requests/${sent.body.request.id}/accept`).expect(200);
    expect((await inbox(b))[0].requestStatus).toBe('accepted');
  });

  it('NTF-TC8: collaboration requests and their decisions notify the other side', async () => {
    const owner = await insertUser();
    const asker = await insertUser();
    const second = await insertUser();
    const note = await insertNote(owner);
    const r1 = (await api.post(asker, `/api/notes/${note}/requests`, { message: 'Can I help?' }).expect(201)).body.id;
    const r2 = (await api.post(second, `/api/notes/${note}/requests`).expect(201)).body.id;
    expect(await inbox(owner)).toMatchObject([
      { type: 'collab_request', actor: { id: second }, note: { id: note }, requestId: r2, requestStatus: 'pending' },
      { type: 'collab_request', actor: { id: asker }, requestId: r1 },
    ]);
    await api.post(owner, `/api/notes/${note}/requests/${r1}`, { decision: 'approve' }).expect(200);
    await api.post(owner, `/api/notes/${note}/requests/${r2}`, { decision: 'decline' }).expect(200);
    expect(await inbox(asker)).toMatchObject([{ type: 'collab_approved', actor: { id: owner }, requestId: r1, requestStatus: 'approved' }]);
    expect(await inbox(second)).toMatchObject([{ type: 'collab_declined', requestId: r2, requestStatus: 'declined' }]);
  });

  it('NTF-TC9: a content edit tells each voided verifier once until they re-confirm', async () => {
    const owner = await insertUser();
    const l1 = await lecturer();
    const l2 = await lecturer();
    const note = await insertNote(owner);
    for (const l of [l1, l2]) await api.post(l, `/api/notes/${note}/verify`).expect(201);
    await api.put(owner, `/api/notes/${note}`, await editBody(owner, note, { hashtags: ['retagged'] })).expect(200);
    expect(await types(l1)).toEqual([]); // hashtags are not content (D46)
    await api.put(owner, `/api/notes/${note}`, await editBody(owner, note, { title: 'Edited' })).expect(200);
    await api.put(owner, `/api/notes/${note}`, await editBody(owner, note, { title: 'Edited twice' })).expect(200);
    for (const l of [l1, l2]) expect(await inbox(l)).toMatchObject([{ type: 'edited_since_verification', actor: { id: owner }, note: { id: note } }]);
    await api.post(l1, `/api/notes/${note}/verify`).expect(200); // re-confirms the latest version
    await api.put(owner, `/api/notes/${note}`, await editBody(owner, note, { title: 'Edited again' })).expect(200);
    expect(await types(l1)).toEqual(['edited_since_verification', 'edited_since_verification']);
    expect(await types(l2)).toEqual(['edited_since_verification']);
  });
});

describe('Delivery rules', () => {
  it('NTF-TC10: nobody is notified about their own action', async () => {
    const a = await insertUser({ displayName: 'Ann' });
    const note = await insertNote(a);
    await api.post(a, `/api/notes/${note}/comments`, { body: '@Ann note to self', mentions: [a] }).expect(201);
    expect(await insertNotifications({ type: 'follow', actorId: a }, [a])).toEqual([]);
    expect(await types(a)).toEqual([]);
  });

  it('NTF-TC11: blocks stop new notifications and hide earlier ones', async () => {
    const a = await insertUser({ displayName: 'Ann' });
    const b = await insertUser({ displayName: 'Ben' });
    const c = await insertUser({ displayName: 'Cy' });
    await api.post(a, `/api/users/${b}/follow`).expect(201);
    await api.post(c, `/api/users/${b}/follow`).expect(201);
    expect(await unread(b)).toMatchObject({ total: 2, byType: { follow: 2 } });
    await api.post(b, `/api/users/${a}/block`).expect(201);
    expect((await inbox(b)).map((n) => n.actor?.id)).toEqual([c]);
    expect((await unread(b)).total).toBe(1);
    expect(await insertNotifications({ type: 'follow', actorId: a }, [b])).toEqual([]);
    expect(await insertNotifications({ type: 'follow', actorId: b }, [a])).toEqual([]);
    await api.del(b, `/api/users/${a}/block`).expect(200);
    expect((await unread(b)).total).toBe(2);
  });

  it('NTF-TC12: suspended and deleted recipients get nothing; a suspended actor\'s notifications are hidden', async () => {
    const actor = await insertUser();
    const active = await insertUser();
    const restricted = await insertUser({ status: 'restricted' });
    const suspended = await insertUser({ status: 'suspended' });
    const deleted = await insertUser({ status: 'deleted' });
    const stored = await insertNotifications({ type: 'follow', actorId: actor }, [active, restricted, suspended, deleted]);
    expect(stored.map((r) => r.recipientId).sort()).toEqual([active, restricted].sort());
    await pool.query(`UPDATE "USER_T" SET usr_status = 'suspended' WHERE usr_id = $1`, [actor]);
    expect(await inbox(active)).toEqual([]);
  });

  it('NTF-TC13: a failing notification never fails the action that caused it', async () => {
    await expect(notify({ type: 'follow', actorId: null }, () => Promise.reject(new Error('db down')))).resolves.toBeUndefined();
  });
});

describe('Inbox endpoints', () => {
  it('NTF-TC14: keyset paging newest first, type filter and invalid input', async () => {
    const me = await insertUser();
    const others = await Promise.all(Array.from({ length: 25 }, () => insertUser()));
    for (const o of others) await insertNotifications({ type: 'follow', actorId: o }, [me]);
    await insertNotifications({ type: 'lecturer_approved', actorId: null }, [me]);
    await pool.query(`UPDATE "NOTIFICATION_T" SET ntf_created_at = NOW()`); // same time: the id breaks the tie

    const pages = await walkPages<Item>((cursor) => api.get(me, `/api/notifications?limit=10${cursor ? `&cursor=${cursor}` : ''}`), 'notifications');
    expect(pages.map((p) => p.length)).toEqual([10, 10, 6]);
    const ids = pages.flat().map((n) => n.id);
    expect(ids).toEqual([...ids].sort((x, y) => y - x));
    expect((await api.get(me, '/api/notifications')).body.notifications).toHaveLength(20);

    const filtered = (await api.get(me, '/api/notifications?type=lecturer_approved,super_like').expect(200)).body;
    expect(filtered).toMatchObject({ notifications: [{ type: 'lecturer_approved' }], nextCursor: null });
    expect((await api.get(me, '/api/notifications?type=likes')).status).toBe(400);
    expect((await api.get(me, '/api/notifications?cursor=abc')).status).toBe(400);
    expect((await request(app).get('/api/notifications')).status).toBe(401);
    expect((await api.get(others[0], '/api/notifications')).body.notifications).toEqual([]);
  });

  it('NTF-TC15: mark read by ids or all, own notifications only', async () => {
    const [me, other, x, y] = await Promise.all([insertUser(), insertUser(), insertUser(), insertUser()]);
    const [n1] = await insertNotifications({ type: 'follow', actorId: x }, [me]);
    await insertNotifications({ type: 'follow', actorId: y }, [me]);
    await insertNotifications({ type: 'lecturer_approved', actorId: null }, [me]);
    const [theirs] = await insertNotifications({ type: 'follow', actorId: x }, [other]);
    expect(await unread(me)).toEqual({ total: 3, byType: { follow: 2, lecturer_approved: 1 } });

    const one = await api.post(me, '/api/notifications/read', { ids: [n1.id, theirs.id] }).expect(200);
    expect(one.body.unreadCount).toEqual({ total: 2, byType: { follow: 1, lecturer_approved: 1 } });
    expect((await inbox(me)).find((n) => n.id === n1.id)?.read).toBe(true);
    expect((await unread(other)).total).toBe(1);

    for (const body of [{ ids: [] }, { ids: ['1'] }, { ids: 5 }, { ids: Array.from({ length: 101 }, (_, i) => i + 1) }]) {
      expect((await api.post(me, '/api/notifications/read', body)).status).toBe(400);
    }
    expect((await api.post(me, '/api/notifications/read').expect(200)).body.unreadCount).toEqual({ total: 0, byType: {} });
    expect((await inbox(me)).every((n) => n.read)).toBe(true);
  });

  it('NTF-TC16: the daily purge removes notifications older than 30 days', async () => {
    const [me, x, y] = await Promise.all([insertUser(), insertUser(), insertUser()]);
    const [old] = await insertNotifications({ type: 'follow', actorId: x }, [me]);
    await insertNotifications({ type: 'follow', actorId: y }, [me]);
    await pool.query(`UPDATE "NOTIFICATION_T" SET ntf_created_at = NOW() - INTERVAL '31 days' WHERE ntf_id = $1`, [old.id]);
    await pool.query(`UPDATE "NOTIFICATION_T" SET ntf_created_at = NOW() - INTERVAL '29 days' WHERE ntf_id <> $1`, [old.id]);
    expect((await purgeAll()).notifications).toBe(1);
    expect((await inbox(me)).map((n) => n.actor?.id)).toEqual([y]);
  });
});
