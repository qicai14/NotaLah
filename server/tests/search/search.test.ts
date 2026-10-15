import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { createNote } from '../../src/features/notes/repository';
import { pool } from '../../src/lib/pool';
import { asUser, befriend, insertUser, truncateAll } from '../helpers';

beforeEach(truncateAll);
afterAll(async () => {
  await pool.query(`DELETE FROM "MODULE_T" WHERE mod_code = 'CT071-3-3'`);
  await pool.end();
});

const search = (query: Record<string, string>, headers: Record<string, string> = {}) =>
  request(app).get('/api/search').query(query).set(headers);
const ids = (items: { id: number }[]) => items.map((i) => i.id);
const lecturer = (displayName = 'Dr Lecturer') =>
  insertUser({ role: 'lecturer', lecturerStatus: 'approved', staffId: `S${Math.random()}`.slice(0, 12), displayName });
const moduleId = async (code: string) =>
  (await pool.query<{ mod_id: number }>(`SELECT mod_id FROM "MODULE_T" WHERE mod_code = $1`, [code])).rows[0].mod_id;

interface Opts {
  title?: string;
  slides?: string[];
  hashtags?: string[];
  module?: string;
  status?: 'draft' | 'published';
  visibility?: 'public' | 'contacts';
  publishedAt?: string;
}

/** A note written through the notes repository, so its search document is built as in production. */
async function note(authorId: number, o: Opts = {}): Promise<number> {
  const status = o.status ?? 'published';
  const id = await createNote(authorId, {
    title: o.title ?? 'Untitled', template: 'plain', slides: o.slides ?? ['<p>Intro</p>'], hashtags: o.hashtags ?? [],
    moduleId: await moduleId(o.module ?? 'CT030-3-2'), status, visibility: status === 'published' ? o.visibility ?? 'public' : null,
  });
  if (o.publishedAt) await pool.query(`UPDATE "POST_T" SET pst_published_at = $2 WHERE pst_id = $1`, [id, o.publishedAt]);
  return id;
}

const like = (userId: number, noteId: number) => pool.query(`INSERT INTO "LIKE_T" (lik_usr_id, lik_pst_id) VALUES ($1, $2)`, [userId, noteId]);
const superLike = (lecturerId: number, noteId: number) =>
  pool.query(`INSERT INTO "VERIFICATION_T" (ver_pst_id, ver_usr_id) VALUES ($1, $2)`, [noteId, lecturerId]);

describe('Search validation', () => {
  it('SRCH-TC1: empty or whitespace query gets 400', async () => {
    for (const q of [{ q: '' }, { q: '   ' }, {}] as Record<string, string>[]) {
      const res = await search(q);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Query is required');
    }
  });

  it('SRCH-TC2: query longer than 100 characters gets 400', async () => {
    const res = await search({ q: 'a'.repeat(101) });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Query too long');
    expect((await search({ q: 'a'.repeat(100) })).status).toBe(200);
  });

  it('SRCH-TC3: SQL metacharacters are plain text', async () => {
    const author = await insertUser();
    await note(author, { title: 'Normal forms', hashtags: ['sql'] });
    for (const tab of ['top', 'people', 'hashtags', 'modules']) {
      const res = await search({ q: `'; DROP TABLE "POST_T"; --`, tab });
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
    }
    expect((await search({ q: '100%_\\' })).body.items).toEqual([]);
    // LIKE wildcards are literal: rows exist that '%' or '_' would otherwise match.
    expect((await search({ q: 'Test', tab: 'people' })).body.items).toHaveLength(1);
    expect((await search({ q: 's', tab: 'hashtags' })).body.items).toHaveLength(1);
    expect((await search({ q: '%', tab: 'people' })).body.items).toEqual([]);
    expect((await search({ q: '_', tab: 'hashtags' })).body.items).toEqual([]);
    expect((await pool.query(`SELECT COUNT(*)::INT AS n FROM "POST_T"`)).rows[0].n).toBe(1);
  });

  it('SRCH-TC13: bad tab, filter, cursor or a term with a date range get 400', async () => {
    const bad = [
      [{ q: 'x', tab: 'videos' }, 'Invalid tab'],
      [{ q: 'x', lecturer: 'some' }, 'Invalid lecturer'],
      [{ q: 'x', lecturer: '0' }, 'Invalid lecturer'],
      [{ q: 'x', term: 'abc' }, 'Invalid term'],
      [{ q: 'x', module: '-1' }, 'Invalid module'],
      [{ q: 'x', module: '1e3' }, 'Invalid module'],
      [{ q: 'x', lecturer: '1.0' }, 'Invalid lecturer'],
      [{ q: 'x', lecturer: '+1' }, 'Invalid lecturer'],
      [{ q: 'x', term: '2147483648' }, 'Invalid term'],
      [{ q: 'x', asOf: 'yesterday' }, 'Invalid asOf'],
      [{ q: 'x', tab: 'people', term: '999' }, 'Term not found'],
      [{ q: 'x', tab: 'modules', term: '999' }, 'Term not found'],
      [{ q: 'x', from: '2026-13-01' }, 'Invalid date'],
      [{ q: 'x', term: '1', from: '2026-10-01' }, 'Choose a term or a date range, not both'],
      [{ q: 'x', term: '999' }, 'Term not found'],
      [{ q: 'x', cursor: 'abc' }, 'Invalid cursor'],
      [{ q: 'x', tab: 'people', cursor: '1_2_3' }, 'Invalid cursor'],
    ] as const;
    for (const [query, error] of bad) expect((await search(query)).body).toEqual({ error });
  });
});

describe('Search matching', () => {
  it('SRCH-TC4: #hashtag returns only published, visible notes with that exact tag', async () => {
    const author = await insertUser();
    const tagged = await note(author, { hashtags: ['normalisation'] });
    await note(author, { hashtags: ['normalisation_extra'] });
    await note(author, { hashtags: ['normalisation'], status: 'draft' });
    const contacts = await note(author, { hashtags: ['normalisation'], visibility: 'contacts' });
    await note(await insertUser({ status: 'suspended' }), { hashtags: ['normalisation'] });
    await note(author, { title: 'Untagged normalisation talk' });

    expect(ids((await search({ q: '#Normalisation' })).body.items)).toEqual([tagged]);
    const friend = await insertUser();
    await befriend(author, friend);
    expect(ids((await search({ q: '#Normalisation', tab: 'notes' }, asUser(friend))).body.items).sort()).toEqual([tagged, contacts].sort());
  });

  it('SRCH-TC5: module code returns that module\'s notes only', async () => {
    await pool.query(`INSERT INTO "MODULE_T" (mod_code, mod_name, mod_programme) VALUES ('CT071-3-3', 'Advanced Topics', 'BSc (Hons) Software Engineering')`);
    const author = await insertUser();
    const inModule = [await note(author, { module: 'CT071-3-3' }), await note(author, { module: 'CT071-3-3', title: 'Second' })];
    await note(author, { module: 'CT071-3-2' });
    await note(author, { module: 'CT030-3-2' });
    expect(ids((await search({ q: 'CT071-3-3' })).body.items).sort()).toEqual(inModule.sort());
    expect(ids((await search({ q: 'ct071-3-3' })).body.items)).toHaveLength(2);
  });

  it('SRCH-TC6: a keyword phrase in slide 2 finds the note', async () => {
    const author = await insertUser();
    const p = await note(author, { title: 'Database design', slides: ['<p>Keys and tables</p>', '<p>Moving to <b>third normal form</b></p>'] });
    await note(author, { title: 'Normal distribution', slides: ['<p>Statistics</p>'] });
    expect(ids((await search({ q: 'third normal form' })).body.items)).toEqual([p]);
    expect(ids((await search({ q: '"third normal form"' })).body.items)).toEqual([p]);
  });

  it('SRCH-TC7: programme finds notes in its modules; people match names containing the term', async () => {
    const author = await insertUser({ displayName: 'Lee Ming' });
    const se = [await note(author, { module: 'CT046-3-M' }), await note(author, { module: 'CT076-3-2' })];
    await note(author, { module: 'CT044-3-2' });
    expect(ids((await search({ q: 'Software Engineering', tab: 'notes' })).body.items).sort()).toEqual(se.sort());

    const contains = await insertUser({ displayName: 'Stanley Ong' });
    const prefix = await insertUser({ displayName: 'Tan Wei Ming' });
    const exact = await insertUser({ displayName: 'Tan' });
    await insertUser({ displayName: 'Tan Suspended', status: 'suspended' });
    await insertUser({ displayName: 'Tan Deleted', status: 'deleted' });
    const res = await search({ q: 'tan', tab: 'people' });
    expect(ids(res.body.items)).toEqual([exact, prefix, contains]);
    expect(res.body.items[0]).toEqual({ id: exact, displayName: 'Tan', role: 'student', programme: 'Software Engineering', avatarUrl: null, isVerifiedLecturer: false });
  });

  it('SRCH-TC8: lecturer=any keeps notes by or Super Liked by a lecturer; lecturer=<id> keeps that lecturer\'s', async () => {
    const student = await insertUser();
    const lecA = await lecturer('Dr A');
    const lecB = await lecturer('Dr B');
    const pending = await insertUser({ role: 'lecturer', lecturerStatus: 'pending', staffId: 'S9' });
    const byA = await note(lecA, { title: 'Joins' });
    const likedByB = await note(student, { title: 'Joins explained' });
    await superLike(lecB, likedByB);
    await note(student, { title: 'Joins again' });
    await note(pending, { title: 'Joins by pending' });
    const suspendedLec = await lecturer('Dr Gone');
    const likedBySuspended = await note(student, { title: 'Joins verified by gone' });
    await superLike(suspendedLec, likedBySuspended);
    await pool.query(`UPDATE "USER_T" SET usr_status = 'suspended' WHERE usr_id = $1`, [suspendedLec]);

    expect(ids((await search({ q: 'joins', lecturer: 'any' })).body.items).sort()).toEqual([byA, likedByB].sort());
    expect(ids((await search({ q: 'joins', lecturer: String(lecA) })).body.items)).toEqual([byA]);
    expect(ids((await search({ q: 'joins', lecturer: String(lecB) })).body.items)).toEqual([likedByB]);
    expect(ids((await search({ q: 'joins', lecturer: String(student) })).body.items)).toEqual([]);
  });

  it('SRCH-TC9: from/to keep notes published on those campus days; from after to gets 400', async () => {
    const author = await insertUser();
    const first = await note(author, { title: 'Indexes', publishedAt: '2026-09-30T20:00:00Z' }); // 1 Oct 04:00 in Malaysia
    const last = await note(author, { title: 'Indexes', publishedAt: '2026-10-13T15:00:00Z' }); // 13 Oct 23:00
    const before = await note(author, { title: 'Indexes', publishedAt: '2026-09-30T15:00:00Z' }); // 30 Sep 23:00
    const after = await note(author, { title: 'Indexes', publishedAt: '2026-10-13T17:00:00Z' }); // 14 Oct 01:00
    const res = await search({ q: 'indexes', from: '2026-10-01', to: '2026-10-13' });
    expect(ids(res.body.items).sort()).toEqual([first, last].sort());
    expect(ids((await search({ q: 'indexes', to: '2026-09-30' })).body.items)).toEqual([before]);
    expect(ids((await search({ q: 'indexes', from: '2026-10-14' })).body.items)).toEqual([after]);
    const bad = await search({ q: 'indexes', from: '2026-10-13', to: '2026-10-01' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('Invalid date range');
  });
});

describe('Search order, paging, tabs and filters', () => {
  it('SRCH-TC11: notes order by text rank blended with E and V, then newest; the same for every viewer', async () => {
    const author = await insertUser();
    const lec = await lecturer();
    // Same text, so T is equal: V decides, then E, then the newer note.
    const plain = await note(author, { title: 'Deadlock' });
    const newerPlain = await note(author, { title: 'Deadlock' });
    const liked = await note(author, { title: 'Deadlock' });
    const verified = await note(author, { title: 'Deadlock' });
    for (let i = 0; i < 3; i++) await like(await insertUser(), liked);
    await like(author, plain); // a self-like never raises E (D47)
    await superLike(lec, verified);
    // The word in the title and both slides (T = 1) beats one mention even with V (T = 0.37 here).
    const strong = await note(author, { title: 'Deadlock', slides: ['<p>deadlock deadlock</p>', '<p>deadlock</p>'] });
    await pool.query(`UPDATE "POST_T" SET pst_published_at = NOW() - INTERVAL '1 hour' WHERE pst_id = $1`, [plain]);

    const guest = ids((await search({ q: 'deadlock' })).body.items);
    expect(guest).toEqual([strong, verified, liked, newerPlain, plain]);
    expect(ids((await search({ q: 'deadlock', tab: 'notes' }, asUser(await insertUser()))).body.items)).toEqual(guest);
  });

  it('SRCH-TC12: keyset pages cover every match once, in order', async () => {
    const author = await insertUser();
    const all: number[] = [];
    for (let i = 0; i < 25; i++) all.push(await note(author, { title: 'Paging' }));
    for (let i = 0; i < 5; i++) await like(await insertUser(), all[i * 5]);
    const first = await search({ q: 'paging', tab: 'notes', limit: '10' });
    const seen = [...ids(first.body.items)];
    let cursor = first.body.nextCursor;
    while (cursor) {
      const res = await search({ q: 'paging', tab: 'notes', limit: '10', cursor });
      expect(res.body).not.toHaveProperty('people');
      seen.push(...ids(res.body.items));
      cursor = res.body.nextCursor;
    }
    expect(seen).toHaveLength(25);
    expect([...seen].sort((a, b) => a - b)).toEqual(all);
    expect(seen.slice(0, 5).sort((a, b) => a - b)).toEqual([0, 5, 10, 15, 20].map((i) => all[i]));
    expect((await search({ q: 'paging' })).body.items).toHaveLength(20);
  });

  it('SRCH-TC17: later pages with the same asOf ignore new likes and new notes', async () => {
    const author = await insertUser();
    const all: number[] = [];
    for (let i = 0; i < 25; i++) all.push(await note(author, { title: 'Snapshot' }));
    const first = await search({ q: 'snapshot', tab: 'notes', limit: '10' });
    const { asOf } = first.body;
    expect(typeof asOf).toBe('string');
    const seen = [...ids(first.body.items)];
    // Both would move to the top if counted: a liked note from a later page and a stronger, newer match.
    const later = all.find((id) => !seen.includes(id))!;
    for (let i = 0; i < 5; i++) await like(await insertUser(), later);
    const fresh = await note(author, { title: 'Snapshot snapshot', slides: ['<p>snapshot snapshot snapshot</p>'] });
    let cursor = first.body.nextCursor;
    while (cursor) {
      const res = await search({ q: 'snapshot', tab: 'notes', limit: '10', cursor, asOf });
      expect(res.body.asOf).toBe(asOf);
      seen.push(...ids(res.body.items));
      cursor = res.body.nextCursor;
    }
    expect([...seen].sort((a, b) => a - b)).toEqual(all);
    expect(ids((await search({ q: 'snapshot', tab: 'notes', limit: '1' })).body.items)).toEqual([fresh]);
  });

  it('SRCH-TC14: a term filters by its dates; the module filter keeps one module', async () => {
    const author = await insertUser();
    const inTerm = await note(author, { title: 'Threads', publishedAt: '2026-10-02T04:00:00Z', module: 'CT050-3-2' });
    await note(author, { title: 'Threads', publishedAt: '2026-08-02T04:00:00Z', module: 'CT050-3-2' });
    const otherModule = await note(author, { title: 'Threads', publishedAt: '2026-10-03T04:00:00Z', module: 'CT060-3-2' });
    const { rows } = await pool.query<{ trm_id: number }>(
      `INSERT INTO "TERM_T" (trm_name, trm_start_date, trm_end_date) VALUES ('Sem 2', '2026-09-01', '2026-12-20') RETURNING trm_id`,
    );
    const term = String(rows[0].trm_id);
    expect(ids((await search({ q: 'threads', term })).body.items).sort()).toEqual([inTerm, otherModule].sort());
    const module = String(await moduleId('CT050-3-2'));
    expect(ids((await search({ q: 'threads', term, module })).body.items)).toEqual([inTerm]);
  });

  it('SRCH-TC15: Top adds up to 3 people, hashtags and modules; each tab pages its own kind', async () => {
    const author = await insertUser({ displayName: 'Network Nerd' });
    await note(author, { title: 'Routing', hashtags: ['network', 'networks_lab'], module: 'CT060-3-2' });
    await note(author, { title: 'Draft', hashtags: ['network_draft_only'], status: 'draft' });
    await note(author, { title: 'Subnets', hashtags: ['network'], module: 'CT055-3-2' });
    for (let i = 0; i < 4; i++) await insertUser({ displayName: `Networker ${i}` });

    const top = await search({ q: 'network' });
    expect(top.body.people).toHaveLength(3);
    expect(top.body.hashtags).toEqual([
      { id: expect.any(Number), name: 'network', noteCount: 2 },
      { id: expect.any(Number), name: 'networks_lab', noteCount: 1 },
    ]);
    expect(top.body.modules.map((m: { code: string }) => m.code).sort()).toEqual(['CT055-3-2', 'CT060-3-2']);
    expect(top.body.modules[0]).toMatchObject({ noteCount: 1 });

    const people = await search({ q: '@network', tab: 'people', limit: '2' });
    expect(people.body.items).toHaveLength(2);
    const rest = await search({ q: 'network', tab: 'people', limit: '2', cursor: people.body.nextCursor });
    const more = await search({ q: 'network', tab: 'people', limit: '2', cursor: rest.body.nextCursor });
    expect([...people.body.items, ...rest.body.items, ...more.body.items]).toHaveLength(5);
    expect(more.body.nextCursor).toBeNull();

    const modules = await search({ q: 'ct060', tab: 'modules' });
    expect(modules.body).toEqual({ items: [expect.objectContaining({ code: 'CT060-3-2', noteCount: 1 })], nextCursor: null });
    expect((await search({ q: '#', tab: 'hashtags' })).body).toEqual({ items: [], nextCursor: null });
  });

  it('SRCH-TC16: guests see public notes only; suspended users and their notes never appear', async () => {
    const author = await insertUser({ displayName: 'Kernel Author' });
    const friend = await insertUser();
    await befriend(author, friend);
    const pub = await note(author, { title: 'Kernel' });
    const contacts = await note(author, { title: 'Kernel', visibility: 'contacts' });
    await note(author, { title: 'Kernel', status: 'draft' });
    await pool.query(`UPDATE "POST_T" SET pst_status = 'hidden' WHERE pst_id = $1`, [await note(author, { title: 'Kernel' })]);
    const banned = await insertUser({ displayName: 'Kernel Banned' });
    await note(banned, { title: 'Kernel', hashtags: ['kernel_banned'] });
    await pool.query(`UPDATE "USER_T" SET usr_status = 'suspended' WHERE usr_id = $1`, [banned]);
    const admin = await insertUser({ role: 'admin' });

    const guest = await search({ q: 'kernel' });
    expect(guest.headers['x-viewer']).toBe('guest');
    expect(ids(guest.body.items)).toEqual([pub]);
    expect(ids(guest.body.people)).toEqual([author]);
    expect(guest.body.hashtags).toEqual([]);
    expect(ids((await search({ q: 'kernel' }, asUser(friend))).body.items).sort()).toEqual([pub, contacts].sort());
    // The author sees their own contacts-only note, but never their draft or hidden one.
    expect(ids((await search({ q: 'kernel' }, asUser(author))).body.items).sort()).toEqual([pub, contacts].sort());
    const asAdmin = await search({ q: 'kernel' }, asUser(admin));
    expect(ids(asAdmin.body.items)).toEqual([pub]);
    expect(ids(asAdmin.body.people)).toEqual([author]);
  });
});
