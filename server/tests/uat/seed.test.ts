import { deckSchema } from '@notalah/shared';
import { readFileSync } from 'node:fs';
import { afterAll, beforeEach, describe, expect, it } from 'vite-plus/test';
import { pool } from '../../src/lib/pool';
import { NOTES, toDeck } from '../../src/scripts/uat/data';
import { seedUat } from '../../src/scripts/uat/seed';
import { insertUser, truncateAll } from '../helpers';

beforeEach(truncateAll);
afterAll(() => pool.end());

const counts = async () => {
  const { rows } = await pool.query<Record<string, string>>(
    `SELECT (SELECT COUNT(*) FROM "USER_T") AS users, (SELECT COUNT(*) FROM "POST_T") AS posts,
            (SELECT COUNT(*) FROM "SLIDE_T") AS slides, (SELECT COUNT(*) FROM "HASHTAG_T") AS tags`,
  );
  return rows[0];
};

describe('UAT seed', () => {
  it('OPS-TC21: running the UAT seed twice adds nothing the second time and keeps unrelated rows', async () => {
    const otherUser = await insertUser({ email: 'other@mail.apu.edu.my' });
    const { rows } = await pool.query<{ pst_id: number }>(
      `INSERT INTO "POST_T" (pst_usr_id, pst_mod_id, pst_title, pst_status, pst_visibility, pst_published_at)
       VALUES ($1, (SELECT mod_id FROM "MODULE_T" LIMIT 1), 'Unrelated note', 'published', 'public', NOW()) RETURNING pst_id`,
      [otherUser],
    );

    const first = await seedUat(pool);
    expect(first.inserted).toMatchObject({ users: 5, notes: NOTES.length });
    expect(first.inserted.modules + first.skipped.modules).toBe(3); // MODULE_T is not truncated between tests
    const afterFirst = await counts();
    expect(afterFirst.users).toBe('6');
    expect(afterFirst.posts).toBe(String(NOTES.length + 1));

    const second = await seedUat(pool);
    expect(second.inserted).toEqual({ users: 0, modules: 0, notes: 0, slides: 0 });
    expect(second.skipped).toMatchObject({ users: 5, modules: 3, notes: NOTES.length });
    expect(await counts()).toEqual(afterFirst);

    const { rows: kept } = await pool.query(
      `SELECT (SELECT COUNT(*) FROM "USER_T" WHERE usr_id = $1) AS u, (SELECT COUNT(*) FROM "POST_T" WHERE pst_id = $2) AS p`,
      [otherUser, rows[0].pst_id],
    );
    expect(kept[0]).toEqual({ u: '1', p: '1' });
  });

  it('OPS-TC22: the UAT seed sources contain no TRUNCATE or DELETE and do not reset existing passwords', () => {
    for (const f of ['seed.ts', 'data.ts']) {
      const src = readFileSync(new URL(`../../src/scripts/uat/${f}`, import.meta.url), 'utf8');
      expect(src).not.toMatch(/TRUNCATE|DELETE/i);
    }
  });

  it('OPS-TC23: every seeded deck passes deckSchema and the lecturer is an approved lecturer', async () => {
    expect(NOTES.length).toBeGreaterThanOrEqual(12);
    expect(NOTES.length).toBeLessThanOrEqual(16);
    for (const n of NOTES) expect(deckSchema.safeParse(toDeck(n)).success, n.title).toBe(true);

    await seedUat(pool);
    const { rows } = await pool.query(
      `SELECT usr_role, usr_lecturer_status FROM "USER_T" WHERE usr_email = 'uat.lecturer@mail.apu.edu.my'`,
    );
    expect(rows[0]).toEqual({ usr_role: 'lecturer', usr_lecturer_status: 'approved' });
    const { rows: stored } = await pool.query<{ sld_doc: unknown }>(`SELECT sld_doc FROM "SLIDE_T"`);
    expect(stored.length).toBeGreaterThan(NOTES.length);
  });
});
