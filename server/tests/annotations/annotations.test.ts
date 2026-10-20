import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vite-plus/test';
import { app } from '../../src/app';
import { pool } from '../../src/lib/pool';
import { asUser, befriend, CSRF, insertNote, insertUser, truncateAll } from '../helpers';

beforeEach(truncateAll);
afterAll(() => pool.end());

const post = (uid: number, url: string, body?: object) => request(app).post(url).set(asUser(uid)).send(body);
const get = (uid: number | null, url: string) =>
  request(app)
    .get(url)
    .set(uid === null ? {} : asUser(uid));
const del = (uid: number, url: string) => request(app).delete(url).set(asUser(uid));
const patch = (uid: number, url: string, body: object) => request(app).patch(url).set(asUser(uid)).send(body);

/** A published note whose slide 1 holds a text element; returns the note id and that element's id. */
async function noteWithText(author: number, o: { visibility?: string } = {}) {
  const note = await insertNote(author, { ...o, slides: 2 });
  const { rows } = await pool.query<{ id: string }>(
    `SELECT e ->> 'id' AS id FROM "SLIDE_T" s, jsonb_array_elements(s.sld_doc -> 'elements') e
     WHERE s.sld_pst_id = $1 AND s.sld_position = 1`,
    [note],
  );
  return { note, element: rows[0].id };
}

const input = (element: string, over: object = {}) => ({
  slideId: 1,
  elementId: element,
  quote: 'x',
  offset: 0,
  body: 'Nice point',
  ...over,
});
const url = (note: number) => `/api/notes/${note}/annotations`;
const block = (a: number, b: number) =>
  pool.query(`INSERT INTO "BLOCK_T" (blk_blocker_id, blk_blocked_id) VALUES ($1, $2)`, [a, b]);
const notifications = async (userId: number, type: string) =>
  Number(
    (await pool.query(`SELECT COUNT(*) FROM "NOTIFICATION_T" WHERE ntf_usr_id = $1 AND ntf_type = $2`, [userId, type]))
      .rows[0].count,
  );

describe('Annotations (R10, FR18)', () => {
  it('ANN-TC1: create an annotation; anyone who can see the note, a guest included, reads it', async () => {
    const author = await insertUser();
    const lecturer = await insertUser({
      displayName: 'Dr Lee',
      role: 'lecturer',
      lecturerStatus: 'approved',
      staffId: 'S100',
    });
    const { note, element } = await noteWithText(author);
    const res = await post(lecturer, url(note), input(element, { quote: 'x', body: '  Check this  ' }));
    expect(res.status).toBe(201);
    expect(res.body.annotation).toMatchObject({
      slideId: 1,
      elementId: element,
      quote: 'x',
      offset: 0,
      body: 'Check this',
      canDelete: true,
      author: { id: lecturer, displayName: 'Dr Lee', avatarUrl: null, isVerifiedLecturer: true },
    });
    const guest = await get(null, url(note));
    expect(guest.status).toBe(200);
    expect(guest.body.annotationsOn).toBe(true);
    expect(guest.body.annotations).toHaveLength(1);
    expect(guest.body.annotations[0].canDelete).toBe(false);
    expect((await get(author, url(note))).body.annotations[0].canDelete).toBe(true);
    expect((await request(app).post(url(note)).set(CSRF).send(input(element))).status).toBe(401);
  });

  it('ANN-TC2: friends-only, hidden and missing notes follow the note access rules', async () => {
    const author = await insertUser();
    const friend = await insertUser();
    const stranger = await insertUser();
    const { note, element } = await noteWithText(author, { visibility: 'contacts' });
    await befriend(author, friend);
    expect((await post(friend, url(note), input(element))).status).toBe(201);
    expect((await get(friend, url(note))).body.annotations).toHaveLength(1);
    for (const who of [stranger, null]) expect((await get(who, url(note))).status).toBe(404);
    expect((await post(stranger, url(note), input(element))).status).toBe(404);
    await pool.query(`UPDATE "POST_T" SET pst_status = 'hidden' WHERE pst_id = $1`, [note]);
    expect((await get(friend, url(note))).status).toBe(404);
    expect((await post(friend, url(note), input(element))).status).toBe(404);
    expect((await get(friend, '/api/notes/999999/annotations')).status).toBe(404);
    expect((await get(friend, '/api/notes/abc/annotations')).status).toBe(404);
  });

  it('ANN-TC3: blocks, suspended and deleted authors hide annotations like comments', async () => {
    const author = await insertUser();
    const viewer = await insertUser();
    const blockedByViewer = await insertUser();
    const suspended = await insertUser();
    const deleted = await insertUser();
    const ok = await insertUser();
    const admin = await insertUser({ role: 'admin' });
    const { note, element } = await noteWithText(author);
    for (const u of [blockedByViewer, suspended, deleted, ok]) await post(u, url(note), input(element));
    await block(viewer, blockedByViewer);
    await pool.query(`UPDATE "USER_T" SET usr_status = 'suspended' WHERE usr_id = $1`, [suspended]);
    await pool.query(`UPDATE "USER_T" SET usr_status = 'deleted' WHERE usr_id = $1`, [deleted]);
    const ids = async (v: number) => (await get(v, url(note))).body.annotations.map((a: any) => a.author.id);
    expect(await ids(viewer)).toEqual([ok]);
    expect(await ids(author)).toEqual([blockedByViewer, ok]);
    expect(await ids(admin)).toEqual([blockedByViewer, suspended, ok]);
    // a block between viewer and note author withdraws the note itself
    await block(author, viewer);
    expect((await get(viewer, url(note))).status).toBe(404);
    expect((await post(viewer, url(note), input(element))).status).toBe(404);
  });

  it('ANN-TC4: the author turns annotations off and on; off lists nothing and refuses new ones', async () => {
    const author = await insertUser();
    const reader = await insertUser();
    const { note, element } = await noteWithText(author);
    await post(reader, url(note), input(element));
    expect((await patch(reader, url(note), { enabled: false })).status).toBe(403);
    expect((await patch(author, url(note), { enabled: 'no' })).status).toBe(400);
    expect((await patch(author, url(note), { enabled: false })).body).toEqual({ annotationsOn: false });
    expect((await get(reader, url(note))).body).toEqual({ annotationsOn: false, annotations: [] });
    expect((await get(null, url(note))).body).toEqual({ annotationsOn: false, annotations: [] });
    const refused = await post(reader, url(note), input(element));
    expect(refused.status).toBe(403);
    expect(refused.body.error).toBe('Annotations are turned off for this note');
    await patch(author, url(note), { enabled: true });
    expect((await get(reader, url(note))).body.annotations).toHaveLength(1);
  });

  it('ANN-TC5: the annotator and the note author can delete; others cannot; the row is kept', async () => {
    const author = await insertUser();
    const a = await insertUser();
    const other = await insertUser();
    const { note, element } = await noteWithText(author);
    const make = async () => (await post(a, url(note), input(element))).body.annotation.id as number;
    const first = await make();
    expect((await del(other, `${url(note)}/${first}`)).status).toBe(403);
    expect((await del(a, `${url(note)}/${first}`)).status).toBe(204);
    expect((await del(a, `${url(note)}/${first}`)).status).toBe(404);
    const second = await make();
    expect((await del(author, `${url(note)}/${second}`)).status).toBe(204);
    const rows = await pool.query(`SELECT ant_deleted_at FROM "ANNOTATION_T"`);
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows.every((r) => r.ant_deleted_at)).toBe(true);
    expect((await get(author, url(note))).body.annotations).toEqual([]);
    const third = await make();
    const friendsOnly = await noteWithText(author, { visibility: 'contacts' });
    const hidden = await pool.query<{ id: number }>(
      `INSERT INTO "ANNOTATION_T" (ant_pst_id, ant_usr_id, ant_slide_id, ant_element_id, ant_quote, ant_offset, ant_body)
       VALUES ($1, $2, 1, $3, 'x', 0, 'b') RETURNING ant_id AS id`,
      [friendsOnly.note, a, friendsOnly.element],
    );
    expect((await del(other, `${url(friendsOnly.note)}/${hidden.rows[0].id}`)).status).toBe(404);
    expect((await del(other, `${url(note)}/${third}`)).status).toBe(403);
    expect(
      (
        await request(app)
          .delete(`${url(note)}/${third}`)
          .set(CSRF)
      ).status,
    ).toBe(401);
  });

  it('ANN-TC6: invalid input is refused, including an element that is not text', async () => {
    const author = await insertUser();
    const a = await insertUser();
    const { note, element } = await noteWithText(author);
    const shape = { id: 'shape-0001', type: 'shape' };
    await pool.query(
      `UPDATE "SLIDE_T" SET sld_doc = jsonb_set(sld_doc, '{elements}', sld_doc -> 'elements' || $2::JSONB) WHERE sld_pst_id = $1 AND sld_position = 1`,
      [note, JSON.stringify([shape])],
    );
    const bad = async (over: object, field: string) => {
      const res = await post(a, url(note), input(element, over));
      expect(res.status, JSON.stringify(over)).toBe(400);
      expect(Object.keys(res.body.errors)).toContain(field);
    };
    await bad({ body: '   ' }, 'body');
    await bad({ body: 'y'.repeat(501) }, 'body');
    await bad({ quote: '' }, 'quote');
    await bad({ quote: 'q'.repeat(301) }, 'quote');
    await bad({ offset: -1 }, 'offset');
    await bad({ offset: 1.5 }, 'offset');
    await bad({ slideId: 0 }, 'slideId');
    await bad({ slideId: 'one' }, 'slideId');
    await bad({ elementId: 'short' }, 'elementId');
    await bad({ elementId: 'does-not-exist-1' }, 'elementId');
    await bad({ slideId: 2 }, 'elementId'); // the element is on slide 1
    await bad({ elementId: shape.id }, 'elementId');
    expect(
      (await post(a, url(note), { ...input(element), quote: 'q'.repeat(300), body: 'y'.repeat(500) })).status,
    ).toBe(201);
    expect((await pool.query(`SELECT 1 FROM "ANNOTATION_T"`)).rowCount).toBe(1);
  });

  it('ANN-TC7: the note author is notified; annotating your own note notifies nobody', async () => {
    const author = await insertUser();
    const a = await insertUser();
    const { note, element } = await noteWithText(author);
    await post(a, url(note), input(element));
    expect(await notifications(author, 'annotation')).toBe(1);
    await post(author, url(note), input(element));
    expect(await notifications(author, 'annotation')).toBe(1);
    await post(a, url(note), input(element, { body: 'Second' }));
    expect(await notifications(author, 'annotation')).toBe(1); // same user within the dedupe window
    const inbox = await get(author, '/api/notifications?type=annotation');
    expect(inbox.body.notifications).toHaveLength(1);
    expect(inbox.body.notifications[0]).toMatchObject({ type: 'annotation', note: { id: note }, actor: { id: a } });
  });

  it('ANN-TC8: reporting an annotation follows the note report rules', async () => {
    const author = await insertUser();
    const a = await insertUser();
    const reporter = await insertUser();
    const student = await insertUser();
    const { note, element } = await noteWithText(author);
    const id = (await post(a, url(note), input(element))).body.annotation.id as number;
    const report = (uid: number, body: object = { reason: 'spam' }) => post(uid, `${url(note)}/${id}/report`, body);
    expect((await report(reporter)).status).toBe(201);
    expect((await report(reporter)).status).toBe(409);
    expect((await report(a)).status).toBe(400);
    expect((await report(student, { reason: 'plagiarism' })).status).toBe(403);
    expect((await report(student, { reason: 'nope' })).status).toBe(400);
    expect((await post(reporter, `${url(note)}/99999/report`, { reason: 'spam' })).status).toBe(404);
    // the same user can still report the note itself, and a block does not stop an annotation report (D49)
    expect((await post(reporter, `/api/notes/${note}/report`, { reason: 'spam' })).status).toBe(201);
    await block(a, student);
    expect((await report(student)).status).toBe(201);
    const rows = await pool.query(`SELECT rpt_pst_id, rpt_ant_id FROM "REPORT_T" ORDER BY rpt_id`);
    expect(rows.rows.map((r) => [r.rpt_pst_id, r.rpt_ant_id])).toEqual([
      [note, id],
      [note, null],
      [note, id],
    ]);
  });

  it('ANN-TC9: the admin queue lists annotation reports; hiding hides only the annotation and tells its author', async () => {
    const author = await insertUser();
    const a = await insertUser();
    const reporter = await insertUser();
    const admin = await insertUser({ role: 'admin' });
    const { note, element } = await noteWithText(author);
    const keep = (await post(a, url(note), input(element, { body: 'fine' }))).body.annotation.id as number;
    const bad = (await post(a, url(note), input(element, { body: 'rude' }))).body.annotation.id as number;
    await post(reporter, `${url(note)}/${bad}/report`, { reason: 'inappropriate' });
    await post(reporter, `${url(note)}/${keep}/report`, { reason: 'other' });
    const queue = await get(admin, '/api/admin/reports');
    expect(queue.body.groups).toHaveLength(1);
    expect(queue.body.groups[0].reportCount).toBe(2);
    expect(queue.body.groups[0].reports[0].annotation).toMatchObject({ id: bad, body: 'rude', gone: false });
    const resolve = (annId: number, outcome: string) =>
      post(admin, `/api/admin/reports/annotations/${annId}/resolve`, { outcome, remark: 'ok' });
    // the note-level resolve leaves annotation reports open
    expect((await post(admin, `/api/admin/reports/${note}/resolve`, { outcome: 'hide', remark: 'x' })).status).toBe(
      404,
    );
    expect((await resolve(bad, 'maybe')).status).toBe(400);
    expect((await post(admin, `/api/admin/reports/annotations/${bad}/resolve`, { outcome: 'hide' })).status).toBe(400);
    expect((await resolve(bad, 'hide')).body).toEqual({ outcome: 'hide', resolved: 1 });
    expect((await resolve(bad, 'hide')).status).toBe(404);
    expect((await resolve(keep, 'dismiss')).body.resolved).toBe(1);
    expect((await post(reporter, '/api/admin/reports/annotations/1/resolve', {})).status).toBe(403);
    const shown = (await get(author, url(note))).body.annotations;
    expect(shown.map((x: any) => x.id)).toEqual([keep]);
    const row = (await pool.query(`SELECT ant_hidden_at, ant_deleted_at FROM "ANNOTATION_T" WHERE ant_id = $1`, [bad]))
      .rows[0];
    expect(row.ant_hidden_at).not.toBeNull();
    expect(row.ant_deleted_at).toBeNull();
    expect(await notifications(a, 'annotation_hidden')).toBe(1);
    expect((await pool.query(`SELECT pst_status FROM "POST_T"`)).rows[0].pst_status).toBe('published');
    expect((await get(admin, '/api/admin/reports')).body.groups).toEqual([]);
    expect((await del(a, `${url(note)}/${bad}`)).status).toBe(404);
  });

  it('ANN-TC10: editing the note never deletes its annotations', async () => {
    const author = await insertUser();
    const a = await insertUser();
    const { note, element } = await noteWithText(author);
    await post(a, url(note), input(element));
    const current = (await get(author, `/api/notes/${note}`)).body.note;
    const slides = current.slides.map((s: any) => ({
      background: s.background,
      elements: s.elements.map((e: any) => ({ ...e, html: '<p>rewritten</p>' })),
      notes: '',
    }));
    const saved = await request(app)
      .put(`/api/notes/${note}`)
      .set(asUser(author))
      .send({
        title: current.title,
        theme: current.theme,
        aspect: current.aspect,
        slides,
        music: null,
        moduleId: current.module?.id ?? null,
        hashtags: ['kernel'],
        status: 'published',
        visibility: 'public',
      });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    const list = (await get(author, url(note))).body.annotations;
    expect(list).toHaveLength(1);
    expect(list[0].quote).toBe('x');
  });

  it('ANN-TC11: a note holds at most 500 live annotations; deleting one makes room', async () => {
    const author = await insertUser();
    const a = await insertUser();
    const { note, element } = await noteWithText(author);
    await pool.query(
      `INSERT INTO "ANNOTATION_T" (ant_pst_id, ant_usr_id, ant_slide_id, ant_element_id, ant_quote, ant_offset, ant_body)
       SELECT $1, $2, 1, $3, 'x', 0, 'b' FROM generate_series(1, 500)`,
      [note, a, element],
    );
    const full = await post(a, url(note), input(element));
    expect(full.status).toBe(409);
    expect(full.body.error).toBe('This note has reached its annotation limit');
    await pool.query(
      `UPDATE "ANNOTATION_T" SET ant_deleted_at = NOW() WHERE ant_id = (SELECT MIN(ant_id) FROM "ANNOTATION_T")`,
    );
    const ok = await post(a, url(note), input(element, { body: 'Newest' }));
    expect(ok.status).toBe(201);
    expect(ok.body.annotation.body).toBe('Newest');
    expect((await get(a, url(note))).body.annotations).toHaveLength(500);
  });
});
