import { createHash } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vite-plus/test';
import { app } from '../../src/app';
import { replaceNote } from '../../src/features/notes/repository';
import { parseNoteBody } from '../../src/features/notes/service';
import { getCandidates } from '../../src/features/ranking/repository';
import { pool } from '../../src/lib/pool';
import { asUser, befriend, CSRF, follow, insertNote, insertUser, slidesOf, textSlide, truncateAll } from '../helpers';

beforeEach(truncateAll);
afterAll(() => pool.end());

type Who = number | null; // null = guest
const as = (who: Who) => (who === null ? CSRF : asUser(who));
const api = {
  get: (who: Who, url: string) => request(app).get(url).set(as(who)),
  put: (who: Who, url: string, body: object = {}) => request(app).put(url).set(as(who)).send(body),
  post: (who: Who, url: string, body: object = {}) => request(app).post(url).set(as(who)).send(body),
  del: (who: Who, url: string) => request(app).delete(url).set(as(who)),
};

const addCollaborator = (note: number, user: number, role: 'view' | 'edit', owner: number) =>
  pool.query(`INSERT INTO "COLLABORATOR_T" (clb_pst_id, clb_usr_id, clb_role, clb_added_by) VALUES ($1, $2, $3, $4)`, [
    note,
    user,
    role,
    owner,
  ]);
const collaborators = async (note: number) =>
  (
    await pool.query(
      `SELECT clb_usr_id AS "id", clb_role AS "role" FROM "COLLABORATOR_T" WHERE clb_pst_id = $1 ORDER BY clb_usr_id`,
      [note],
    )
  ).rows;
const lecturer = () =>
  insertUser({ role: 'lecturer', lecturerStatus: 'approved', staffId: `S${Math.random()}`.slice(0, 12) });
const dbNow = async () => (await pool.query<{ t: Date }>('SELECT clock_timestamp() AS t')).rows[0].t;

/** The note as GET returns it, turned into a valid full-replace body with optional overrides. */
async function editBody(owner: number, note: number, over: object = {}) {
  const n = (await api.get(owner, `/api/notes/${note}`)).body.note;
  return {
    title: n.title,
    slides: slidesOf(n.slides),
    moduleId: n.module?.id ?? null,
    hashtags: n.hashtags.length ? n.hashtags : ['notes'],
    status: n.status,
    visibility: n.visibility,
    baseUpdatedAt: n.updatedAt,
    ...over,
  };
}

/** A draft with an owner, an editor, a viewer and a stranger. */
async function cast(status = 'draft', visibility = 'public') {
  const owner = await insertUser({ displayName: 'Owner' });
  const editor = await insertUser({ displayName: 'Editor' });
  const viewer = await insertUser({ displayName: 'Viewer' });
  const stranger = await insertUser({ displayName: 'Stranger' });
  const note = await insertNote(owner, { status, visibility });
  await addCollaborator(note, editor, 'edit', owner);
  await addCollaborator(note, viewer, 'view', owner);
  return { owner, editor, viewer, stranger, note };
}

describe('Collaboration (R30)', () => {
  it('COL-TC1: a draft or friends-only note is readable by owner, editor and viewer only', async () => {
    for (const [status, visibility] of [
      ['draft', 'public'],
      ['published', 'contacts'],
    ]) {
      const c = await cast(status, visibility);
      const url = `/api/notes/${c.note}`;
      for (const who of [c.owner, c.editor, c.viewer]) expect((await api.get(who, url)).status).toBe(200);
      expect((await api.get(c.stranger, url)).status).toBe(404);
      expect((await api.get(null, url)).status).toBe(404);
    }
  });

  it('COL-TC2: owner-only endpoints answer owner 2xx, editor and viewer 403, stranger 404, guest 401', async () => {
    const c = await cast();
    const requester = await insertUser();
    await addCollaborator(c.note, requester, 'view', c.owner);
    const rid = (await api.post(requester, `/api/notes/${c.note}/requests`)).body.id;
    const target = await insertUser();
    const calls: [string, (who: Who) => request.Test][] = [
      ['GET access', (w) => api.get(w, `/api/notes/${c.note}/access`)],
      ['PUT collaborator', (w) => api.put(w, `/api/notes/${c.note}/collaborators/${target}`, { role: 'view' })],
      ['POST link', (w) => api.post(w, `/api/notes/${c.note}/links`, { role: 'view' })],
      ['DELETE link', (w) => api.del(w, `/api/notes/${c.note}/links/view`)],
      ['DELETE other collaborator', (w) => api.del(w, `/api/notes/${c.note}/collaborators/${target}`)],
    ];
    for (const [name, call] of calls) {
      expect([name, (await call(c.editor)).status]).toEqual([name, 403]);
      expect([name, (await call(c.viewer)).status]).toEqual([name, 403]);
      expect([name, (await call(c.stranger)).status]).toEqual([name, 404]);
      expect([name, (await call(null)).status]).toEqual([name, 401]);
      const ok = (await call(c.owner)).status;
      expect([name, ok >= 200 && ok < 300]).toEqual([name, true]);
    }
    const decide = (w: Who) => api.post(w, `/api/notes/${c.note}/requests/${rid}`, { decision: 'decline' });
    expect((await decide(c.editor)).status).toBe(403);
    expect((await decide(c.stranger)).status).toBe(404);
    expect((await decide(null)).status).toBe(401);
    expect((await decide(c.owner)).status).toBe(200);
  });

  it('COL-TC3: PUT is allowed for owner and editor, 403 viewer, 404 stranger, 401 guest; DELETE is owner-only', async () => {
    const c = await cast();
    const url = `/api/notes/${c.note}`;
    expect((await api.put(c.viewer, url, await editBody(c.owner, c.note))).status).toBe(403);
    expect((await api.put(c.stranger, url, await editBody(c.owner, c.note))).status).toBe(404);
    expect((await api.put(null, url, await editBody(c.owner, c.note))).status).toBe(401);
    const byEditor = await api.put(c.editor, url, await editBody(c.owner, c.note, { title: 'Edited by co-author' }));
    expect(byEditor.status).toBe(200);
    expect(byEditor.body.note.title).toBe('Edited by co-author');
    expect((await api.put(c.owner, url, await editBody(c.owner, c.note, { title: 'Owner again' }))).status).toBe(200);
    expect((await api.del(c.editor, url)).status).toBe(403);
    expect((await api.del(c.viewer, url)).status).toBe(403);
    expect((await api.del(c.owner, url)).status).toBe(204);
  });

  it('COL-TC4: an editor status, visibility or module change is a 409 and baseUpdatedAt is required', async () => {
    const c = await cast('published');
    const url = `/api/notes/${c.note}`;
    const other = (await pool.query(`SELECT mod_id FROM "MODULE_T" ORDER BY mod_id DESC LIMIT 1`)).rows[0].mod_id;
    for (const over of [{ visibility: 'contacts' }, { moduleId: other }, { status: 'draft' }]) {
      const res = await api.put(c.editor, url, await editBody(c.owner, c.note, over));
      expect(res.status).toBe(409);
      expect(res.body.error).toBe(
        'The owner changed who can see this note or its module. Reload to see the latest version',
      );
    }
    const noBase = await api.put(c.editor, url, await editBody(c.owner, c.note, { baseUpdatedAt: undefined }));
    expect(noBase.status).toBe(400);
    expect(noBase.body.errors.baseUpdatedAt).toBe('baseUpdatedAt is required');
    expect((await api.put(c.editor, url, await editBody(c.owner, c.note, { baseUpdatedAt: 'yesterday' }))).status).toBe(
      400,
    );
    const draft = await cast('draft');
    expect(
      (
        await api.put(
          draft.editor,
          `/api/notes/${draft.note}`,
          await editBody(draft.owner, draft.note, {
            status: 'published',
            moduleId: other,
            visibility: 'public',
            hashtags: ['x'],
          }),
        )
      ).status,
    ).toBe(409); // a co-author cannot publish; the client never sends it (D58)
  });

  it('COL-TC5: a stale baseUpdatedAt is refused with 409; the owner may still omit it', async () => {
    const c = await cast();
    const url = `/api/notes/${c.note}`;
    const stale = await editBody(c.owner, c.note, { title: 'First' });
    expect((await api.put(c.editor, url, stale)).status).toBe(200);
    const res = await api.put(c.owner, url, { ...stale, title: 'Second' });
    expect(res.status).toBe(409);
    expect((await api.get(c.owner, url)).body.note.title).toBe('First');
    expect(
      (await api.put(c.owner, url, { ...(await editBody(c.owner, c.note)), baseUpdatedAt: undefined, title: 'Third' }))
        .status,
    ).toBe(200);
  });

  it('COL-TC6: a link token is returned once and only its SHA-256 hash is stored', async () => {
    const c = await cast();
    const res = await api.post(c.owner, `/api/notes/${c.note}/links`, { role: 'view' });
    expect(res.status).toBe(201);
    expect(res.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(res.body.url).toMatch(new RegExp(`/share/${res.body.token}$`));
    const { rows } = await pool.query(`SELECT shl_token_hash FROM "SHARE_LINK_T"`);
    expect(rows).toEqual([{ shl_token_hash: createHash('sha256').update(res.body.token).digest('hex') }]);
    const access = await api.get(c.owner, `/api/notes/${c.note}/access`);
    expect(access.body.links).toEqual([{ role: 'view', createdAt: expect.any(String) }]);
    expect(JSON.stringify(access.body)).not.toContain(res.body.token);
    expect((await api.post(c.owner, `/api/notes/${c.note}/links`, { role: 'owner' })).status).toBe(400);
  });

  it('COL-TC7: a view link opens a draft or friends-only note for anyone, adds no row and unlocks nothing else', async () => {
    const c = await cast('published', 'contacts');
    const { token } = (await api.post(c.owner, `/api/notes/${c.note}/links`, { role: 'view' })).body;
    const guest = await api.get(null, `/api/share/${token}`);
    expect(guest.status).toBe(200);
    expect(guest.body).toMatchObject({ role: 'view', note: { id: c.note } });
    expect((await api.get(c.stranger, `/api/share/${token}`)).body.note.liked).toBe(false);
    expect(await collaborators(c.note)).toHaveLength(2);
    expect((await api.post(c.stranger, `/api/notes/${c.note}/like`)).status).toBe(404);
    expect((await api.get(c.stranger, `/api/notes/${c.note}`)).status).toBe(404);
    expect((await api.post(c.stranger, `/api/share/${token}`)).status).toBe(400);
  });

  it('COL-TC8: an edit link needs a login and an active account; joining makes an edit collaborator', async () => {
    const c = await cast();
    const { token } = (await api.post(c.owner, `/api/notes/${c.note}/links`, { role: 'edit' })).body;
    expect((await api.get(null, `/api/share/${token}`)).status).toBe(401);
    expect((await api.post(null, `/api/share/${token}`)).status).toBe(401);
    expect((await api.get(c.stranger, `/api/share/${token}`)).body).toMatchObject({
      role: 'edit',
      note: { id: c.note },
    });
    expect(await collaborators(c.note)).toHaveLength(2); // the GET did not join
    const restricted = await insertUser({ status: 'restricted' });
    expect((await api.post(restricted, `/api/share/${token}`)).status).toBe(403);
    const joined = await api.post(c.stranger, `/api/share/${token}`);
    expect(joined.body).toEqual({ noteId: c.note, role: 'edit' });
    expect((await api.post(c.viewer, `/api/share/${token}`)).status).toBe(200); // a viewer is upgraded
    expect(await collaborators(c.note)).toEqual(
      expect.arrayContaining([
        { id: c.stranger, role: 'edit' },
        { id: c.viewer, role: 'edit' },
      ]),
    );
    expect((await api.post(c.owner, `/api/share/${token}`)).body.role).toBe('owner');
    expect(await collaborators(c.note)).toHaveLength(3);
  });

  it('COL-TC9: revoked and regenerated links stop working; malformed tokens are 404', async () => {
    const c = await cast();
    const first = (await api.post(c.owner, `/api/notes/${c.note}/links`, { role: 'view' })).body.token;
    const second = (await api.post(c.owner, `/api/notes/${c.note}/links`, { role: 'view' })).body.token;
    expect((await api.get(null, `/api/share/${first}`)).status).toBe(404);
    expect((await api.get(null, `/api/share/${second}`)).status).toBe(200);
    expect((await api.del(c.owner, `/api/notes/${c.note}/links/view`)).status).toBe(204);
    expect((await api.get(null, `/api/share/${second}`)).status).toBe(404);
    expect((await api.get(null, '/api/share/not-a-token')).status).toBe(404);
    expect((await api.del(c.owner, `/api/notes/${c.note}/links/admin`)).status).toBe(400);
  });

  it('COL-TC10: hidden notes and suspended authors give no access through links or collaboration', async () => {
    const c = await cast('published');
    const { token } = (await api.post(c.owner, `/api/notes/${c.note}/links`, { role: 'view' })).body;
    await pool.query(`UPDATE "POST_T" SET pst_status = 'hidden' WHERE pst_id = $1`, [c.note]);
    expect((await api.get(null, `/api/share/${token}`)).status).toBe(404);
    expect((await api.get(c.editor, `/api/notes/${c.note}`)).status).toBe(404);
    expect((await api.put(c.editor, `/api/notes/${c.note}`, { title: 'x' })).status).toBe(404);
    expect((await api.get(c.editor, '/api/notes/shared')).body.notes).toEqual([]);
    await pool.query(`UPDATE "POST_T" SET pst_status = 'draft' WHERE pst_id = $1`, [c.note]);
    await pool.query(`UPDATE "USER_T" SET usr_status = 'suspended' WHERE usr_id = $1`, [c.owner]);
    expect((await api.get(null, `/api/share/${token}`)).status).toBe(404);
    expect((await api.get(c.viewer, `/api/notes/${c.note}`)).status).toBe(404);
  });

  it('COL-TC11: the owner adds and changes collaborators; a collaborator can leave but not remove others', async () => {
    const c = await cast();
    const invitee = await insertUser({ displayName: 'Invitee' });
    const url = `/api/notes/${c.note}/collaborators`;
    expect((await api.put(c.owner, `${url}/${invitee}`, { role: 'view' })).body).toEqual({
      userId: invitee,
      role: 'view',
    });
    expect((await api.put(c.owner, `${url}/${invitee}`, { role: 'edit' })).status).toBe(200);
    expect((await api.put(c.owner, `${url}/${c.owner}`, { role: 'edit' })).status).toBe(400);
    expect((await api.put(c.owner, `${url}/999999`, { role: 'edit' })).status).toBe(404);
    expect((await api.put(c.owner, `${url}/${invitee}`, { role: 'admin' })).status).toBe(400);
    const access = (await api.get(c.owner, `/api/notes/${c.note}/access`)).body;
    expect(access.collaborators.map((x: { user: { id: number }; role: string }) => [x.user.id, x.role])).toEqual([
      [c.editor, 'edit'],
      [c.viewer, 'view'],
      [invitee, 'edit'],
    ]);
    expect((await api.del(c.editor, `${url}/${c.viewer}`)).status).toBe(403);
    expect((await api.del(c.viewer, `${url}/${c.viewer}`)).status).toBe(204);
    expect((await api.del(c.owner, `${url}/${invitee}`)).status).toBe(204);
    expect(await collaborators(c.note)).toEqual([{ id: c.editor, role: 'edit' }]);
  });

  it('COL-TC12: requests to collaborate are created once and approved or declined by the owner', async () => {
    const c = await cast('published');
    const url = `/api/notes/${c.note}/requests`;
    const first = await api.post(c.stranger, url, { message: 'I can add the diagrams' });
    expect(first.status).toBe(201);
    expect((await api.post(c.stranger, url)).status).toBe(409);
    expect((await api.post(c.owner, url)).status).toBe(400);
    expect((await api.post(c.editor, url)).status).toBe(409);
    expect((await api.post(await insertUser(), url, { message: 'x'.repeat(301) })).status).toBe(400);
    const fromViewer = await api.post(c.viewer, url);
    expect(fromViewer.status).toBe(201);
    const draft = await cast('draft');
    expect((await api.post(draft.stranger, `/api/notes/${draft.note}/requests`)).status).toBe(404);

    const pending = (await api.get(c.owner, `/api/notes/${c.note}/access`)).body.requests;
    expect(pending.map((r: { user: { id: number }; message: string | null }) => [r.user.id, r.message])).toEqual([
      [c.stranger, 'I can add the diagrams'],
      [c.viewer, null],
    ]);
    const approve = await api.post(c.owner, `${url}/${first.body.id}`, { decision: 'approve' });
    expect(approve.body).toEqual({ status: 'approved', role: 'edit' });
    expect((await api.post(c.owner, `${url}/${first.body.id}`, { decision: 'decline' })).status).toBe(409);
    expect((await api.post(c.owner, `${url}/${fromViewer.body.id}`, { decision: 'maybe' })).status).toBe(400);
    expect((await api.post(c.owner, `${url}/${fromViewer.body.id}`, { decision: 'decline' })).body).toEqual({
      status: 'declined',
    });
    expect((await api.post(c.owner, `${url}/999999`, { decision: 'approve' })).status).toBe(404);
    expect(await collaborators(c.note)).toEqual(
      expect.arrayContaining([
        { id: c.stranger, role: 'edit' },
        { id: c.viewer, role: 'view' },
      ]),
    );
    expect((await api.get(c.owner, `/api/notes/${c.note}/access`)).body.requests).toEqual([]);
  });

  it('COL-TC13: Shared with me lists the notes a user collaborates on with their role', async () => {
    const c = await cast();
    const other = await insertNote(c.owner, { title: 'Second', status: 'published' });
    await addCollaborator(other, c.editor, 'view', c.owner);
    const res = await api.get(c.editor, '/api/notes/shared');
    expect(res.status).toBe(200);
    expect(
      res.body.notes.map((n: { id: number; role: string; owner: { id: number } }) => [n.id, n.role, n.owner.id]),
    ).toEqual(
      expect.arrayContaining([
        [c.note, 'edit', c.owner],
        [other, 'view', c.owner],
      ]),
    );
    expect(res.body.notes).toHaveLength(2);
    expect((await api.get(c.stranger, '/api/notes/shared')).body.notes).toEqual([]);
    expect((await api.get(null, '/api/notes/shared')).status).toBe(401);
  });

  it('COL-TC14: the soft lock blocks other editors with 423 until released or expired', async () => {
    const c = await cast();
    const lock = `/api/notes/${c.note}/lock`;
    const taken = await api.post(c.editor, lock);
    expect(taken.status).toBe(200);
    expect(new Date(taken.body.expiresAt).getTime()).toBeGreaterThan(Date.now() + 60_000);
    expect((await api.post(c.editor, lock)).status).toBe(200); // renew
    const blocked = await api.post(c.owner, lock);
    expect(blocked.status).toBe(423);
    expect(blocked.body.lockedBy).toEqual({ id: c.editor, displayName: 'Editor' });
    expect((await api.put(c.owner, `/api/notes/${c.note}`, await editBody(c.owner, c.note))).status).toBe(423);
    expect((await api.put(c.editor, `/api/notes/${c.note}`, await editBody(c.owner, c.note))).status).toBe(200);
    expect((await api.post(c.viewer, lock)).status).toBe(403);
    expect((await api.post(c.stranger, lock)).status).toBe(404);
    expect((await api.post(null, lock)).status).toBe(401);

    await pool.query(`UPDATE "POST_T" SET pst_lock_expires_at = NOW() - INTERVAL '1 second' WHERE pst_id = $1`, [
      c.note,
    ]);
    expect((await api.post(c.owner, lock)).status).toBe(200); // expired lock is free
    expect((await api.del(c.editor, lock)).status).toBe(204); // not theirs: no effect
    expect((await api.post(c.editor, lock)).status).toBe(423);
    expect((await api.del(c.owner, lock)).status).toBe(204);
    expect((await api.post(c.editor, lock)).status).toBe(200);
    await api.del(c.owner, `/api/notes/${c.note}/collaborators/${c.editor}`); // removing an editor frees their lock
    expect((await api.post(c.owner, lock)).status).toBe(200);
  });

  it('COL-TC25: the owner publishes the last saved version while an editor holds the lock', async () => {
    const c = await cast();
    const publish = `/api/notes/${c.note}/publish`;
    expect((await api.post(c.editor, `/api/notes/${c.note}/lock`)).status).toBe(200);
    expect((await api.post(c.owner, publish, { visibility: 'public' })).body.errors).toEqual({
      hashtags: 'At least one hashtag is required',
    });
    const saved = await api.put(c.editor, `/api/notes/${c.note}`, await editBody(c.owner, c.note));
    expect(saved.status).toBe(200);
    const draftBody = await editBody(c.owner, c.note);
    expect((await api.post(c.editor, publish, { visibility: 'public' })).status).toBe(403);
    expect((await api.post(c.stranger, publish, { visibility: 'public' })).status).toBe(404);
    expect((await api.post(c.owner, publish, { visibility: 'everyone' })).status).toBe(400);
    const res = await api.post(c.owner, publish, { visibility: 'contacts' });
    expect(res.status).toBe(200);
    expect(res.body.note).toMatchObject({ status: 'published', visibility: 'contacts', hashtags: ['notes'] });
    expect(res.body.note.slides).toHaveLength(saved.body.note.slides.length);
    expect((await api.post(c.owner, publish, { visibility: 'public' })).status).toBe(400); // already published
    // The editor's next save still carries the draft status, so it gets a 409 (reload or keep mine), never a 403.
    expect((await api.put(c.editor, `/api/notes/${c.note}`, draftBody)).status).toBe(409);
    // Keep mine: the editor adopts the server's status, visibility and updatedAt, and saves over the publish.
    const now = (await api.get(c.editor, `/api/notes/${c.note}`)).body.note;
    const kept = { ...draftBody, status: now.status, visibility: now.visibility, baseUpdatedAt: now.updatedAt };
    expect((await api.put(c.editor, `/api/notes/${c.note}`, kept)).status).toBe(200);
    // The publish route's write: a save between its read and its write makes it stale (409), even with the lock ignored.
    const again = await cast();
    const read = (await api.get(again.owner, `/api/notes/${again.note}`)).body.note;
    await api.put(again.editor, `/api/notes/${again.note}`, await editBody(again.owner, again.note));
    const body = parseNoteBody({
      ...(await editBody(again.owner, again.note)),
      status: 'published',
      visibility: 'public',
    });
    if (!body.ok) throw new Error('fixture');
    const ignore = { ignoreLock: true };
    expect(await replaceNote(again.note, body.data, again.owner, new Date(read.updatedAt), ignore)).toBe('stale');
  });

  it('COL-TC15: a slide edit removes V until the lecturer re-confirms', async () => {
    const c = await cast('published');
    const lect = await lecturer();
    expect((await api.post(lect, `/api/notes/${c.note}/verify`, { remark: 'Accurate' })).status).toBe(201);
    const verifiedIn = async () =>
      (await getCandidates(c.stranger, await dbNow())).find((x) => x.id === c.note)!.verified;
    expect(await verifiedIn()).toBe(true);

    await api
      .put(
        c.editor,
        `/api/notes/${c.note}`,
        await editBody(c.owner, c.note, { slides: [textSlide('<p>new content</p>')] }),
      )
      .expect(200);
    const after = (await api.get(c.stranger, `/api/notes/${c.note}`)).body.note;
    expect(after).toMatchObject({ verified: false, verifiedBy: null, editedSinceVerification: true });
    expect(await verifiedIn()).toBe(false);

    const again = await api.post(lect, `/api/notes/${c.note}/verify`, { remark: 'Checked the new slide' });
    expect(again.status).toBe(200);
    expect(again.body.remark).toBe('Checked the new slide');
    const back = (await api.get(c.stranger, `/api/notes/${c.note}`)).body.note;
    expect(back).toMatchObject({ verified: true, editedSinceVerification: false });
    expect(await verifiedIn()).toBe(true);
  });

  it('COL-TC16: hashtag-only edits keep V; title edits drop it; no edit moves pst_published_at', async () => {
    const c = await cast('published');
    const lect = await lecturer();
    await api.post(lect, `/api/notes/${c.note}/verify`).expect(201);
    const published = async () =>
      (
        await pool.query(`SELECT pst_published_at FROM "POST_T" WHERE pst_id = $1`, [c.note])
      ).rows[0].pst_published_at.getTime();
    const before = await published();
    await api
      .put(c.editor, `/api/notes/${c.note}`, await editBody(c.owner, c.note, { hashtags: ['retagged'] }))
      .expect(200);
    const tagged = (await api.get(c.stranger, `/api/notes/${c.note}`)).body.note;
    expect(tagged).toMatchObject({ hashtags: ['retagged'], verified: true, editedSinceVerification: false });
    await api.put(c.owner, `/api/notes/${c.note}`, await editBody(c.owner, c.note, { title: 'Renamed' })).expect(200);
    expect((await api.get(c.stranger, `/api/notes/${c.note}`)).body.note.verified).toBe(false);
    expect(await published()).toBe(before);

    const draft = await cast('draft');
    await api
      .put(draft.editor, `/api/notes/${draft.note}`, await editBody(draft.owner, draft.note, { title: 'Draft edit' }))
      .expect(200);
    const { rows } = await pool.query(
      `SELECT pst_content_edited_at, pst_published_at FROM "POST_T" WHERE pst_id = $1`,
      [draft.note],
    );
    expect(rows[0]).toEqual({ pst_content_edited_at: null, pst_published_at: null });
  });

  it("COL-TC17: the Following feed reaches co-authors' followers only after their first edit, and lists a note once", async () => {
    const c = await cast('published');
    const fan = await insertUser();
    await follow(fan, c.editor);
    const viewerFan = await insertUser();
    await follow(viewerFan, c.viewer);
    const ids = async (who: number) =>
      (await api.get(who, '/api/feed?tab=following')).body.items.map((n: { id: number }) => n.id);
    expect(await ids(fan)).toEqual([]); // invited but has not edited: no reach
    await api
      .put(c.editor, `/api/notes/${c.note}`, await editBody(c.owner, c.note, { title: 'Co-authored' }))
      .expect(200);
    expect(await ids(fan)).toEqual([c.note]);
    expect(await ids(viewerFan)).toEqual([]);
    await follow(fan, c.owner);
    expect(await ids(fan)).toEqual([c.note]); // followed as author and co-author: listed once

    const contacts = await cast('published', 'contacts');
    await follow(fan, contacts.editor);
    await api
      .put(
        contacts.editor,
        `/api/notes/${contacts.note}`,
        await editBody(contacts.owner, contacts.note, { title: 'Edited' }),
      )
      .expect(200);
    expect(await ids(fan)).toEqual([c.note]); // a friends-only note still needs friendship with the owner
    await befriend(fan, contacts.owner);
    expect((await ids(fan)).sort()).toEqual([c.note, contacts.note].sort());
  });

  it("COL-TC18: co-author credit starts at the first edit; the detail reports the viewer's role", async () => {
    const c = await cast('published');
    const detail = async (who: Who) => (await api.get(who, `/api/notes/${c.note}`)).body.note;
    expect((await detail(null)).coauthors).toEqual([]); // invited only: no credit
    await api
      .put(c.editor, `/api/notes/${c.note}`, await editBody(c.owner, c.note, { hashtags: ['tagged'] }))
      .expect(200);
    const coauthors = [{ id: c.editor, displayName: 'Editor' }];
    expect((await detail(null)).coauthors).toEqual(coauthors);
    const feed = (await api.get(c.stranger, '/api/feed')).body.items.find((n: { id: number }) => n.id === c.note);
    expect(feed.coauthors).toEqual(coauthors);
    expect(feed).not.toHaveProperty('myRole');
    expect(
      [
        await detail(c.owner),
        await detail(c.editor),
        await detail(c.viewer),
        await detail(c.stranger),
        await detail(null),
      ].map((n) => n.myRole),
    ).toEqual(['owner', 'edit', 'view', null, null]);
    await pool.query(`UPDATE "USER_T" SET usr_status = 'suspended' WHERE usr_id = $1`, [c.editor]);
    expect((await detail(null)).coauthors).toEqual([]);
  });

  it('COL-TC19: an edit collaborator may like but not Super Like the note they co-author', async () => {
    const owner = await insertUser();
    const lectEditor = await lecturer();
    const note = await insertNote(owner);
    await addCollaborator(note, lectEditor, 'edit', owner);
    const like = await api.post(lectEditor, `/api/notes/${note}/like`);
    expect(like.status).toBe(201);
    const verify = await api.post(lectEditor, `/api/notes/${note}/verify`);
    expect(verify.status).toBe(409);
    expect(verify.body.error).toBe('Cannot verify own note');
  });

  it('COL-TC20: a request id from another note cannot be decided (IDOR)', async () => {
    const a = await cast('published');
    const b = await cast('published');
    const rid = (await api.post(b.stranger, `/api/notes/${b.note}/requests`)).body.id;
    expect((await api.post(a.owner, `/api/notes/${a.note}/requests/${rid}`, { decision: 'approve' })).status).toBe(404);
    const { rows } = await pool.query(`SELECT crq_status FROM "COLLAB_REQUEST_T" WHERE crq_id = $1`, [rid]);
    expect(rows[0].crq_status).toBe('pending');
    expect(await collaborators(a.note)).toHaveLength(2);
  });

  it('COL-TC21: V stays on a never-edited note and on a save that resends unchanged formatted slides', async () => {
    const owner = await insertUser();
    const editor = await insertUser();
    const lect = await lecturer();
    const id = (
      await api.post(owner, '/api/notes', {
        title: 'Rich',
        slides: [
          textSlide('<h2>Heading</h2><p><strong>bold</strong> and <em>em</em></p>'),
          textSlide('<ul><li>a</li><li>b</li></ul>'),
        ],
        moduleId: (await pool.query(`SELECT mod_id FROM "MODULE_T" ORDER BY mod_id LIMIT 1`)).rows[0].mod_id,
        hashtags: ['rich'],
        status: 'published',
        visibility: 'public',
      })
    ).body.note.id;
    await addCollaborator(id, editor, 'edit', owner);
    await api.post(lect, `/api/notes/${id}/verify`).expect(201);
    await api.post(editor, `/api/notes/${id}/lock`).expect(200);
    expect((await api.get(null, `/api/notes/${id}`)).body.note).toMatchObject({
      verified: true,
      editedSinceVerification: false,
    });
    await api
      .put(editor, `/api/notes/${id}`, await editBody(owner, id, { hashtags: ['rich', 'retagged'] }))
      .expect(200);
    const { rows } = await pool.query(`SELECT pst_content_edited_at FROM "POST_T" WHERE pst_id = $1`, [id]);
    expect(rows[0].pst_content_edited_at).toBeNull();
    expect((await api.get(null, `/api/notes/${id}`)).body.note.verified).toBe(true);
  });

  it('COL-TC22: downgrading an editor frees their lock, and a lost edit role is re-checked inside the save', async () => {
    const c = await cast();
    await api.post(c.editor, `/api/notes/${c.note}/lock`).expect(200);
    await api.put(c.owner, `/api/notes/${c.note}/collaborators/${c.editor}`, { role: 'view' }).expect(200);
    expect((await api.post(c.owner, `/api/notes/${c.note}/lock`)).status).toBe(200);
    const input = {
      title: 'x',
      theme: 'plain',
      aspect: '4:5' as const,
      slides: [],
      music: null,
      moduleId: null,
      hashtags: [],
      status: 'draft' as const,
      visibility: null,
    };
    expect(await replaceNote(c.note, input, c.editor, null)).toBe('forbidden');
    expect(await replaceNote(c.note, input, c.stranger, null)).toBe('forbidden');
  });

  it('COL-TC23: co-authors cannot edit, lock or join while the author is restricted; reading still works', async () => {
    const c = await cast();
    const { token } = (await api.post(c.owner, `/api/notes/${c.note}/links`, { role: 'edit' })).body;
    const body = await editBody(c.owner, c.note);
    await pool.query(`UPDATE "USER_T" SET usr_status = 'restricted' WHERE usr_id = $1`, [c.owner]);
    expect((await api.put(c.editor, `/api/notes/${c.note}`, body)).status).toBe(403);
    expect((await api.post(c.editor, `/api/notes/${c.note}/lock`)).status).toBe(403);
    expect((await api.post(c.stranger, `/api/share/${token}`)).status).toBe(403);
    expect((await api.get(c.editor, `/api/notes/${c.note}`)).status).toBe(200);
    expect((await api.get(c.stranger, `/api/share/${token}`)).status).toBe(200);
  });

  it('COL-TC24: concurrent link regenerations all succeed and leave one active link', async () => {
    const c = await cast();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => api.post(c.owner, `/api/notes/${c.note}/links`, { role: 'view' })),
    );
    expect(results.map((r) => r.status)).toEqual([201, 201, 201, 201, 201]);
    const { rows } = await pool.query(
      `SELECT COUNT(*)::INT AS n FROM "SHARE_LINK_T" WHERE shl_pst_id = $1 AND shl_revoked_at IS NULL`,
      [c.note],
    );
    expect(rows[0].n).toBe(1);
  });
});
