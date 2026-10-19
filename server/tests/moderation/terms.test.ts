import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vite-plus/test';
import { app } from '../../src/app';
import { pool } from '../../src/lib/pool';
import { asUser, insertUser, truncateAll } from '../helpers';

afterAll(() => pool.end());

const SEM = { name: 'Semester 2 2026', startDate: '2026-09-01', endDate: '2026-12-20' };
let admin: Record<string, string>;
beforeEach(async () => {
  await truncateAll();
  admin = asUser(await insertUser({ role: 'admin', email: 'admin@notalah.test' }));
});

const post = (body: object, h = admin) => request(app).post('/api/admin/terms').set(h).send(body);
const put = (id: number | string, body: object) => request(app).put(`/api/admin/terms/${id}`).set(admin).send(body);

describe('academic terms (FR15)', () => {
  it('ADM-TC31: non-admins get 403 on every admin term endpoint; GET /api/terms is public', async () => {
    for (const h of [
      asUser(await insertUser()),
      asUser(await insertUser({ role: 'lecturer', lecturerStatus: 'approved' })),
    ]) {
      expect((await request(app).get('/api/admin/terms').set(h)).status).toBe(403);
      expect((await post(SEM, h)).status).toBe(403);
      expect((await request(app).put('/api/admin/terms/1').set(h).send(SEM)).status).toBe(403);
      expect((await request(app).delete('/api/admin/terms/1').set(h)).status).toBe(403);
    }
    const res = await request(app).get('/api/terms');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ terms: [] });
  });

  it('ADM-TC32: creates terms, overlaps allowed, listed newest first with dates as YYYY-MM-DD', async () => {
    const a = await post(SEM);
    expect(a.status).toBe(201);
    expect(a.body.term).toEqual({ id: expect.any(Number), ...SEM });
    const b = await post({ name: 'Intake Oct 2026', startDate: '2026-10-05', endDate: '2027-01-30' });
    expect(b.status).toBe(201);
    const res = await request(app).get('/api/terms');
    expect(res.body.terms.map((t: { name: string }) => t.name)).toEqual(['Intake Oct 2026', 'Semester 2 2026']);
  });

  it('ADM-TC33: rejects a blank or long name, bad dates, start not before end, and a duplicate name', async () => {
    expect((await post({ ...SEM, name: '  ' })).body.errors).toEqual({ name: 'Name is required' });
    expect((await post({ ...SEM, name: 'x'.repeat(51) })).status).toBe(400);
    expect((await post({ ...SEM, startDate: '2026-02-30' })).body.errors.startDate).toBeDefined();
    expect((await post({ ...SEM, endDate: '01/12/2026' })).body.errors.endDate).toBeDefined();
    expect((await post({ ...SEM, endDate: SEM.startDate })).body.errors).toEqual({
      endDate: 'End date must be after the start date',
    });
    expect((await post({})).status).toBe(400);
    expect((await post(SEM)).status).toBe(201);
    const dup = await post({ ...SEM, startDate: '2027-01-01', endDate: '2027-04-01' });
    expect(dup.status).toBe(409);
    expect((await request(app).get('/api/terms')).body.terms).toHaveLength(1);
  });

  it('ADM-TC34: replaces and deletes a term; unknown ids get 404 and a duplicate rename 409', async () => {
    const id = (await post(SEM)).body.term.id;
    await post({ name: 'Other', startDate: '2026-01-01', endDate: '2026-04-01' });
    const edited = { name: 'Sem 2 2026', startDate: '2026-09-07', endDate: '2026-12-18' };
    expect((await put(id, edited)).body.term).toEqual({ id, ...edited });
    expect((await put(id, { ...edited, name: 'Other' })).status).toBe(409);
    expect((await put(id, { ...edited, endDate: '2026-09-01' })).status).toBe(400);
    expect((await put(999999, edited)).status).toBe(404);
    expect((await put('abc', edited)).status).toBe(404);
    expect((await request(app).delete(`/api/admin/terms/${id}`).set(admin)).status).toBe(204);
    expect((await request(app).delete(`/api/admin/terms/${id}`).set(admin)).status).toBe(404);
    expect((await request(app).get('/api/terms')).body.terms.map((t: { name: string }) => t.name)).toEqual(['Other']);
  });
});
