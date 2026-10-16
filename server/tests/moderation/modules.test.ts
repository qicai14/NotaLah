import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { pool } from '../../src/lib/pool';
import { asUser, insertNote, insertUser, truncateAll } from '../helpers';

afterAll(async () => {
  await pool.query(`DELETE FROM "MODULE_T" WHERE mod_code LIKE 'TST%'`);
  await pool.end();
});

const NEW = { code: 'TST101', name: 'Test Module', programme: 'BSc (Hons) Software Engineering' };
let admin: Record<string, string>;
beforeEach(async () => {
  await truncateAll();
  await pool.query(`DELETE FROM "MODULE_T" WHERE mod_code LIKE 'TST%'`);
  admin = asUser(await insertUser({ role: 'admin', email: 'admin@parp.test' }));
});

const post = (body: object, h = admin) => request(app).post('/api/admin/modules').set(h).send(body);
const patch = (id: number | string, body: object) => request(app).patch(`/api/admin/modules/${id}`).set(admin).send(body);

describe('admin modules', () => {
  it('ADM-TC21: non-admin tokens get 403 on every module endpoint', async () => {
    for (const h of [asUser(await insertUser()), asUser(await insertUser({ role: 'lecturer', lecturerStatus: 'approved' }))]) {
      expect((await request(app).get('/api/admin/modules').set(h)).status).toBe(403);
      expect((await post(NEW, h)).status).toBe(403);
      expect((await request(app).patch('/api/admin/modules/1').set(h).send({ name: 'x' })).status).toBe(403);
    }
  });

  it('ADM-TC22: lists every module sorted by code with the published note count', async () => {
    const author = await insertUser();
    await insertNote(author);
    await insertNote(author);
    await insertNote(author, { status: 'draft' });
    const res = await request(app).get('/api/admin/modules').set(admin);
    expect(res.status).toBe(200);
    const codes = res.body.modules.map((m: { code: string }) => m.code);
    expect(codes).toHaveLength(12);
    expect(codes).toEqual([...codes].sort());
    const counts = res.body.modules.filter((m: { noteCount: number }) => m.noteCount > 0);
    expect(counts).toHaveLength(1);
    expect(counts[0].noteCount).toBe(2);
  });

  it('ADM-TC23: creates a module with the code trimmed and uppercased', async () => {
    const res = await post({ ...NEW, code: '  tst-101-a ' });
    expect(res.status).toBe(201);
    expect(res.body.module).toMatchObject({ code: 'TST-101-A', name: 'Test Module', programme: NEW.programme, noteCount: 0 });
    const list = await request(app).get('/api/admin/modules').set(admin);
    expect(list.body.modules.map((m: { code: string }) => m.code)).toContain('TST-101-A');
  });

  it('ADM-TC24: a duplicate code is refused with 409', async () => {
    expect((await post(NEW)).status).toBe(201);
    const res = await post({ ...NEW, code: 'tst101', name: 'Other' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Module code already exists');
  });

  it('ADM-TC25: invalid code, name or programme is refused with 400', async () => {
    const res = await post({ code: 'bad code!', name: '', programme: 'p'.repeat(101) });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.errors).sort()).toEqual(['code', 'name', 'programme']);
    expect((await post({ ...NEW, code: 'C'.repeat(21) })).status).toBe(400);
    expect((await post({ ...NEW, name: 'n'.repeat(151) })).status).toBe(400);
    expect((await post({})).status).toBe(400);
  });

  it('ADM-TC26: renames a module and moves its programme', async () => {
    const id = (await post(NEW)).body.module.id;
    const res = await patch(id, { name: 'Renamed', programme: 'BSc (Hons) Computer Science' });
    expect(res.status).toBe(200);
    expect(res.body.module).toMatchObject({ id, code: 'TST101', name: 'Renamed', programme: 'BSc (Hons) Computer Science' });
    const only = await patch(id, { name: 'Again' });
    expect(only.body.module).toMatchObject({ name: 'Again', programme: 'BSc (Hons) Computer Science' });
  });

  it('ADM-TC27: renaming an unknown or malformed module id returns 404', async () => {
    expect((await patch(999999, { name: 'x' })).status).toBe(404);
    expect((await patch('abc', { name: 'x' })).status).toBe(404);
  });

  it('ADM-TC28: the code cannot be changed and an empty change is refused', async () => {
    const id = (await post(NEW)).body.module.id;
    expect((await patch(id, { code: 'TST999' })).status).toBe(400);
    expect((await patch(id, {})).status).toBe(400);
    expect((await patch(id, { name: '  ' })).status).toBe(400);
    const { rows } = await pool.query(`SELECT mod_code FROM "MODULE_T" WHERE mod_id = $1`, [id]);
    expect(rows[0].mod_code).toBe('TST101');
  });
});
