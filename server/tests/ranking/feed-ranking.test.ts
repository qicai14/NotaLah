import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { pool } from '../../src/lib/pool';
import { getInteractionRows } from '../../src/features/ranking/repository';
import { buildInterestVector } from '../../src/features/ranking/service';
import { bearer, insertUser, truncateAll, type TestUserInput } from '../helpers';

beforeEach(truncateAll);
afterAll(() => pool.end());

/** A published public note with the given hashtags, published `hoursAgo` before now; returns its id. */
async function insertNote(authorId: number, hashtags: string[], hoursAgo = 1): Promise<number> {
  const { rows } = await pool.query<{ pst_id: number }>(
    `INSERT INTO "POST_T" (pst_usr_id, pst_mod_id, pst_title, pst_status, pst_visibility, pst_published_at)
     VALUES ($1, (SELECT mod_id FROM "MODULE_T" ORDER BY mod_id LIMIT 1), 'A note', 'published', 'public',
             NOW() - make_interval(hours => $2))
     RETURNING pst_id`,
    [authorId, hoursAgo],
  );
  const id = rows[0].pst_id;
  await pool.query(`INSERT INTO "HASHTAG_T" (hsh_name) SELECT unnest($1::TEXT[]) ON CONFLICT DO NOTHING`, [hashtags]);
  await pool.query(
    `INSERT INTO "POST_HASHTAG_T" (phs_pst_id, phs_hsh_id) SELECT $1, hsh_id FROM "HASHTAG_T" WHERE hsh_name = ANY($2::TEXT[])`,
    [id, hashtags],
  );
  return id;
}

const interact = (userId: number, noteId: number, type: string, at: Date, daysAgo = 0) =>
  pool.query(
    `INSERT INTO "INTERACTION_T" (int_usr_id, int_pst_id, int_type, int_created_at)
     VALUES ($1, $2, $3, $4::TIMESTAMPTZ - make_interval(days => $5))`,
    [userId, noteId, type, at, daysAgo],
  );
const verify = (noteId: number, lecturerId: number) =>
  pool.query(`INSERT INTO "VERIFICATION_T" (ver_pst_id, ver_usr_id) VALUES ($1, $2)`, [noteId, lecturerId]);
const lecturer = (status: TestUserInput['status'] = 'active') =>
  insertUser({ role: 'lecturer', lecturerStatus: 'approved', status, staffId: `S${Math.random()}`.slice(0, 12) });
const feed = (uid: number) => request(app).get('/api/feed').set({ Authorization: bearer(uid) });

interface Item {
  id: number;
  score: number;
  components: { E: number; R: number; V: number; M: number };
}

describe('Ranked feed', () => {
  it('RANK-TC11: a verified student note outranks an otherwise identical unverified one', async () => {
    const author = await insertUser();
    const viewer = await insertUser();
    const plain = await insertNote(author, ['sql'], 5);
    const verified = await insertNote(author, ['sql'], 5);
    const byInactive = await insertNote(author, ['sql'], 5);
    await verify(verified, await lecturer());
    await verify(byInactive, await lecturer('suspended')); // only an active, approved lecturer's Super Like counts
    const res = await feed(viewer);
    expect(res.status).toBe(200);
    const items: Item[] = res.body.items;
    expect(items[0].id).toBe(verified);
    expect(items[0].components.V).toBe(1);
    expect(items.find((i) => i.id === plain)!.components.V).toBe(0);
    expect(items.find((i) => i.id === byInactive)!.components.V).toBe(0);
    expect(items[0].score - items[1].score).toBeCloseTo(0.3, 6); // w3 · (1 - 0)
  });

  it('RANK-TC12: interest vector ranks comment > like > view, halves at 14 days, max 1', async () => {
    const author = await insertUser();
    const viewer = await insertUser();
    const asOf = new Date();
    await interact(viewer, await insertNote(author, ['viewed']), 'view', asOf);
    await interact(viewer, await insertNote(author, ['liked']), 'like', asOf);
    await interact(viewer, await insertNote(author, ['commented']), 'comment', asOf);
    await interact(viewer, await insertNote(author, ['older']), 'comment', asOf, 14);
    await interact(viewer, await insertNote(author, ['ancient']), 'comment', asOf, 91);
    const v = buildInterestVector(await getInteractionRows(viewer, asOf), asOf);
    expect(v.get('commented')).toBe(1);
    expect(v.get('liked')).toBeCloseTo(3 / 5, 6);
    expect(v.get('viewed')).toBeCloseTo(1 / 5, 6);
    expect(v.get('older')).toBeCloseTo(0.5, 6);
    expect(v.has('ancient')).toBe(false);
    expect(Math.max(...v.values())).toBe(1);
    expect(buildInterestVector([], asOf).size).toBe(0);
  });

  it('RANK-TC13: a verified, relevant note is surfaced ahead of a more-liked unverified irrelevant one (NFR3)', async () => {
    const author = await insertUser();
    const viewer = await insertUser();
    const sqlHistory = await insertNote(author, ['sql'], 200);
    await interact(viewer, sqlHistory, 'comment', new Date(), 1);
    const relevant = await insertNote(author, ['sql'], 24);
    await verify(relevant, await lecturer());
    const popular = await insertNote(author, ['art'], 0);
    for (let i = 0; i < 10; i++) {
      await pool.query(`INSERT INTO "LIKE_T" (lik_usr_id, lik_pst_id) VALUES ($1, $2)`, [await insertUser(), popular]);
    }
    const items: Item[] = (await feed(viewer)).body.items;
    const rel = items.find((i) => i.id === relevant)!;
    const pop = items.find((i) => i.id === popular)!;
    expect(pop.components.E).toBeGreaterThan(rel.components.E);
    expect(rel.components).toMatchObject({ V: 1, M: 1 });
    expect(pop.components.M).toBe(0);
    expect(items.indexOf(rel)).toBeLessThan(items.indexOf(pop));
  });
});
