import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vite-plus/test';
import { app } from '../../src/app';
import { pool } from '../../src/lib/pool';
import { RANKING } from '../../src/features/ranking/config';
import { getCandidates, getInteractionRows, purgeOldInteractions } from '../../src/features/ranking/repository';
import { buildInterestVector, engagement } from '../../src/features/ranking/service';
import { purgeFeedSnapshots } from '../../src/features/feed/repository';
import { asUser, insertUser, truncateAll, type TestUserInput } from '../helpers';

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
const dbNow = async (): Promise<Date> => (await pool.query<{ t: Date }>('SELECT NOW() AS t')).rows[0].t;
const feed = (uid: number) => request(app).get('/api/feed').set(asUser(uid));

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
    const byRestricted = await insertNote(author, ['sql'], 5);
    await verify(verified, await lecturer());
    await verify(byInactive, await lecturer('suspended')); // a suspended lecturer's Super Like does not count
    await verify(byRestricted, await lecturer('restricted')); // a restricted one's still does
    const res = await feed(viewer);
    expect(res.status).toBe(200);
    const items: Item[] = res.body.items;
    expect(
      items
        .slice(0, 2)
        .map((i) => i.id)
        .sort((a, b) => a - b),
    ).toEqual([verified, byRestricted].sort((a, b) => a - b));
    expect(items[0].components.V).toBe(1);
    expect(items[1].components.V).toBe(1);
    expect(items.find((i) => i.id === plain)!.components.V).toBe(0);
    expect(items.find((i) => i.id === byInactive)!.components.V).toBe(0);
    expect(items[0].score - items[2].score).toBeCloseTo(RANKING.weights.lecturerValidation, 6); // w3 · (1 - 0)
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

  it('RANK-TC14: a verified note older than the newest-N window is still a candidate', async () => {
    const author = await insertUser();
    const viewer = await insertUser();
    const oldVerified = await insertNote(author, ['sql'], 500);
    const oldPlain = await insertNote(author, ['sql'], 400);
    await verify(oldVerified, await lecturer());
    const recent = [await insertNote(author, ['sql'], 2), await insertNote(author, ['sql'], 1)];
    const ids = (await getCandidates(viewer, new Date(), 2)).map((c) => c.id);
    expect(ids.sort((a, b) => a - b)).toEqual([...recent, oldVerified].sort((a, b) => a - b));
    expect(ids).not.toContain(oldPlain);
  });

  it('RANK-TC17: a future asOf is capped at now, so recency is not zeroed', async () => {
    const author = await insertUser();
    const viewer = await insertUser();
    await insertNote(author, ['sql'], 5);
    const res = await request(app).get('/api/feed').query({ asOf: '9999-01-01T00:00:00Z' }).set(asUser(viewer));
    expect(res.status).toBe(200);
    expect(new Date(res.body.asOf).getTime()).toBeLessThanOrEqual((await dbNow()).getTime());
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].components.R).toBeGreaterThan(0);
  });

  it('RANK-TC18: a Super Like older than the verified window no longer surfaces an old note', async () => {
    const author = await insertUser();
    const viewer = await insertUser();
    const stale = await insertNote(author, ['sql'], 5000);
    const fresh = await insertNote(author, ['sql'], 4000);
    await verify(stale, await lecturer());
    await verify(fresh, await lecturer());
    await pool.query(
      `UPDATE "VERIFICATION_T" SET ver_created_at = NOW() - make_interval(days => $1) WHERE ver_pst_id = $2`,
      [RANKING.verifiedCandidateWindowDays + 1, stale],
    );
    const recent = await insertNote(author, ['sql'], 1);
    const ids = (await getCandidates(viewer, await dbNow(), 1)).map((c) => c.id);
    expect(ids.sort((a, b) => a - b)).toEqual([recent, fresh].sort((a, b) => a - b));
  });

  it('RANK-TC19: a note in the newest window keeps verified and V = 1 when its only Super Like is stale', async () => {
    const author = await insertUser();
    const viewer = await insertUser();
    const note = await insertNote(author, ['sql'], 5);
    await verify(note, await lecturer());
    await pool.query(
      `UPDATE "VERIFICATION_T" SET ver_created_at = NOW() - make_interval(days => $1) WHERE ver_pst_id = $2`,
      [RANKING.verifiedCandidateWindowDays + 1, note],
    );
    expect((await getCandidates(viewer, await dbNow())).find((c) => c.id === note)!.verified).toBe(true);
    const item: Item = (await feed(viewer)).body.items.find((i: Item) => i.id === note);
    expect(item.components.V).toBe(1);
  });

  it('RANK-TC20: interactions older than the interest window are purged, newer ones kept', async () => {
    const author = await insertUser();
    const viewer = await insertUser();
    const note = await insertNote(author, ['sql']);
    const win = RANKING.interestWindowDays;
    for (const days of [win + 10, win + 5, 10]) await interact(viewer, note, 'view', new Date(), days);
    expect(await purgeOldInteractions()).toBe(2);
    expect((await pool.query(`SELECT 1 FROM "INTERACTION_T"`)).rowCount).toBe(1);
    expect(await purgeOldInteractions()).toBe(0);
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

  it('RANK-TC15: likes added between page 1 and page 2 do not change page-2 membership for the same asOf', async () => {
    const author = await insertUser();
    const viewer = await insertUser();
    for (let h = 0; h < 20; h++) await insertNote(author, ['sql'], h);
    const page = async (n: number, asOf?: string) =>
      (
        await request(app)
          .get('/api/feed')
          .query({ page: n, ...(asOf && { asOf }) })
          .set(asUser(viewer))
      ).body;
    const first = await page(1);
    const before: Item[] = (await page(2, first.asOf)).items;
    const last = before[before.length - 1].id;
    for (let i = 0; i < 20; i++) {
      await pool.query(`INSERT INTO "LIKE_T" (lik_usr_id, lik_pst_id) VALUES ($1, $2)`, [await insertUser(), last]);
    }
    await verify(last, await lecturer()); // a Super Like after asOf does not count either
    const after: (Item & { counts: { likes: number } })[] = (await page(2, first.asOf)).items;
    expect(after.map((i) => i.id)).toEqual(before.map((i) => i.id));
    expect(after.find((i) => i.id === last)!.components).toEqual(before.find((i) => i.id === last)!.components);
    expect(after.find((i) => i.id === last)!.counts.likes).toBe(20); // the displayed count is live
    expect((await page(1)).items.map((i: Item) => i.id)).toContain(last); // a fresh asOf does rank the new likes
  });

  it('RANK-TC24: page 2 reads the stored ranking, so changes a recompute would see do not reorder it', async () => {
    const author = await insertUser();
    const viewer = await insertUser();
    const ids: number[] = [];
    for (let h = 0; h < 20; h++) ids.push(await insertNote(author, ['sql'], h));
    const oldest = ids[19];
    for (let i = 0; i < 30; i++) {
      await pool.query(`INSERT INTO "LIKE_T" (lik_usr_id, lik_pst_id) VALUES ($1, $2)`, [await insertUser(), oldest]);
    }
    const page = async (n: number, asOf?: string) =>
      (
        await request(app)
          .get('/api/feed')
          .query({ page: n, ...(asOf && { asOf }) })
          .set(asUser(viewer))
      ).body;
    const idsOf = (body: { items: Item[] }) => body.items.map((i) => i.id);
    const first = await page(1);
    expect(idsOf(first)).toContain(oldest);
    const before = idsOf(await page(2, first.asOf));
    const snapshots = async () => (await pool.query(`SELECT COUNT(*)::INT AS n FROM "FEED_SNAPSHOT_T"`)).rows[0].n;
    expect(await snapshots()).toBe(1); // page 2 read the snapshot page 1 stored
    // a recompute at the same asOf would see both: unlikes are not frozen (D24) and the new note is published before asOf
    await pool.query(`DELETE FROM "LIKE_T" WHERE lik_pst_id = $1`, [oldest]);
    const added = await insertNote(author, ['sql'], 12);
    expect(idsOf(await page(2, first.asOf))).toEqual(before);
    await pool.query(`DELETE FROM "FEED_SNAPSHOT_T"`);
    const recomputed = idsOf(await page(2, first.asOf)); // a missing snapshot is recomputed and stored again
    expect(recomputed).not.toEqual(before);
    expect(recomputed).toContain(added);
    expect(await snapshots()).toBe(1);
  });

  it('RANK-TC25: feed snapshots past the TTL are purged, daily and when the viewer stores a new one', async () => {
    const viewer = await insertUser();
    const insertSnapshot = (hoursAgo: number) =>
      pool.query(
        `INSERT INTO "FEED_SNAPSHOT_T" (fsn_usr_id, fsn_as_of, fsn_pst_ids, fsn_scores, fsn_created_at)
         VALUES ($1, NOW() - make_interval(hours => $2), '{}', '{}', NOW() - make_interval(hours => $2))`,
        [viewer, hoursAgo],
      );
    await insertSnapshot(RANKING.snapshotTtlHours + 1);
    await insertSnapshot(RANKING.snapshotTtlHours - 1);
    expect(await purgeFeedSnapshots()).toBe(1);
    await insertSnapshot(RANKING.snapshotTtlHours + 1);
    await feed(viewer);
    const { rows } = await pool.query(
      `SELECT COUNT(*) FILTER (WHERE fsn_created_at < NOW() - make_interval(hours => $1))::INT AS "expired", COUNT(*)::INT AS "total"
       FROM "FEED_SNAPSHOT_T"`,
      [RANKING.snapshotTtlHours],
    );
    expect(rows[0]).toEqual({ expired: 0, total: 2 }); // the unexpired one and the new one
  });

  it('RANK-TC26: a viewer keeps at most snapshotsPerViewer snapshots, the newest; other viewers are untouched', async () => {
    const [viewer, other] = [await insertUser(), await insertUser()];
    await feed(other);
    const asOfs: string[] = [];
    for (let i = 0; i < RANKING.snapshotsPerViewer + 2; i++) asOfs.push((await feed(viewer)).body.asOf);
    const kept = async (uid: number) =>
      (
        await pool.query<{ t: Date }>(
          `SELECT fsn_as_of AS t FROM "FEED_SNAPSHOT_T" WHERE fsn_usr_id = $1 ORDER BY fsn_as_of`,
          [uid],
        )
      ).rows.map((r) => r.t.toISOString());
    expect(await kept(viewer)).toEqual(asOfs.slice(-RANKING.snapshotsPerViewer));
    expect(await kept(other)).toHaveLength(1);
  });

  it('RANK-TC27: a note hidden after page 1 is left out of page 2 although the snapshot still lists it', async () => {
    const author = await insertUser();
    const viewer = await insertUser();
    for (let h = 0; h < 20; h++) await insertNote(author, ['sql'], h);
    const page = async (n: number, asOf?: string) =>
      (
        await request(app)
          .get('/api/feed')
          .query({ page: n, ...(asOf && { asOf }) })
          .set(asUser(viewer))
      ).body;
    const first = await page(1);
    const victim = (await page(2, first.asOf)).items[0].id;
    await pool.query(`UPDATE "POST_T" SET pst_status = 'hidden' WHERE pst_id = $1`, [victim]);
    const second = await page(2, first.asOf);
    expect(second.items.map((i: Item) => i.id)).not.toContain(victim);
    expect(second.items).toHaveLength(9);
  });

  it('RANK-TC28: the author does not see their own note hidden after page 1 on a later page', async () => {
    const author = await insertUser();
    for (let h = 0; h < 20; h++) await insertNote(author, ['sql'], h);
    const page = async (n: number, asOf?: string) =>
      (
        await request(app)
          .get('/api/feed')
          .query({ page: n, ...(asOf && { asOf }) })
          .set(asUser(author))
      ).body;
    const first = await page(1);
    const victim = (await page(2, first.asOf)).items[0].id;
    await pool.query(`UPDATE "POST_T" SET pst_status = 'hidden' WHERE pst_id = $1`, [victim]);
    const second = await page(2, first.asOf);
    expect(second.items.map((i: Item) => i.id)).not.toContain(victim);
    expect(second.items).toHaveLength(9);
  });

  it('RANK-TC16: a lecturer author earns V = 0.5 only while approved and active or restricted', async () => {
    const viewer = await insertUser();
    const active = await lecturer();
    const restricted = await lecturer('restricted');
    const suspended = await lecturer('suspended');
    const byActive = await insertNote(active, ['sql']);
    const byRestricted = await insertNote(restricted, ['sql']);
    const bySuspended = await insertNote(suspended, ['sql']);
    const flags = async (uid: number) =>
      new Map((await getCandidates(uid, new Date())).map((c) => [c.id, c.lecturerAuthor]));
    const seen = await flags(viewer);
    expect(seen.get(byActive)).toBe(true);
    expect(seen.get(byRestricted)).toBe(true);
    expect(seen.has(bySuspended)).toBe(false); // a suspended author's notes are not visible to others (ADM-TC20)
    expect((await flags(suspended)).get(bySuspended)).toBe(false); // the author still sees it, without the lecturer bonus
  });

  it('RANK-TC32: likes by the author and edit collaborators are shown but do not raise E', async () => {
    const [author, editor, viewOnly, stranger, viewer] = [
      await insertUser(),
      await insertUser(),
      await insertUser(),
      await insertUser(),
      await insertUser(),
    ];
    const note = await insertNote(author, ['sql']);
    await pool.query(
      `INSERT INTO "COLLABORATOR_T" (clb_pst_id, clb_usr_id, clb_role, clb_added_by) VALUES ($1, $2, 'edit', $4), ($1, $3, 'view', $4)`,
      [note, editor, viewOnly, author],
    );
    for (const uid of [author, editor, viewOnly, stranger]) {
      expect((await request(app).post(`/api/notes/${note}/like`).set(asUser(uid))).status).toBe(201);
    }
    expect((await getCandidates(viewer, new Date()))[0].counts.likes).toBe(2);
    const item = (await feed(viewer)).body.items[0];
    expect(item.counts.likes).toBe(4);
    expect(item.components.E).toBeCloseTo(engagement(2, 0), 6);
  });
});
