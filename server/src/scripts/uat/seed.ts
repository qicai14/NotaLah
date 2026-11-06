import { deckSchema } from '@notalah/shared';
import { pathToFileURL } from 'node:url';
import type { Pool } from 'pg';
import { hashPassword } from '../../features/auth/passport';
import { MODULES, NOTES, USERS, USER_PROGRAMME, toDeck, uatPassword } from './data';

export interface UatCounts {
  users: number;
  modules: number;
  notes: number;
  slides: number;
}
export interface UatResult {
  db: string;
  inserted: UatCounts;
  skipped: UatCounts;
}

/** Adds the UAT accounts, modules and notes in one transaction; rows that already exist are left as they are. */
export async function seedUat(pool: Pool, password = uatPassword()): Promise<UatResult> {
  const decks = NOTES.map((n) => deckSchema.parse(toDeck(n)));
  const hash = await hashPassword(password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Two seed runs at once would both pass the NOT EXISTS check and double the notes.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('notalah_uat_seed'))`);
    const { rows: dbRows } = await client.query<{ db: string }>('SELECT current_database() AS db');
    const inserted: UatCounts = { users: 0, modules: 0, notes: 0, slides: 0 };

    for (const u of USERS) {
      const r = await client.query(
        `INSERT INTO "USER_T" (usr_email, usr_password_hash, usr_display_name, usr_role, usr_lecturer_status, usr_staff_id, usr_programme)
         VALUES ($1, $2, $3, $4::VARCHAR, CASE WHEN $4::VARCHAR = 'lecturer' THEN 'approved' END, $5, $6)
         ON CONFLICT (usr_email) DO NOTHING`,
        [u.email, hash, u.name, u.role, u.staffId, USER_PROGRAMME],
      );
      inserted.users += r.rowCount ?? 0;
    }
    for (const m of MODULES) {
      const r = await client.query(
        `INSERT INTO "MODULE_T" (mod_code, mod_name, mod_programme) VALUES ($1, $2, $3) ON CONFLICT (mod_code) DO NOTHING`,
        [m.code, m.name, m.programme],
      );
      inserted.modules += r.rowCount ?? 0;
    }

    for (const [i, n] of NOTES.entries()) {
      // The first note is the oldest, 6 hours apart, so the feed has an order.
      const { rows } = await client.query<{ pst_id: number }>(
        `INSERT INTO "POST_T" (pst_usr_id, pst_mod_id, pst_title, pst_template, pst_aspect, pst_status, pst_visibility,
                               pst_published_at, pst_created_at)
         SELECT u.usr_id, m.mod_id, $3::VARCHAR, $4::VARCHAR, '4:5', 'published', 'public',
                NOW() - ($5::INT * INTERVAL '6 hours'), NOW() - ($5::INT * INTERVAL '6 hours')
         FROM "USER_T" u, "MODULE_T" m
         WHERE u.usr_email = $1 AND m.mod_code = $2
           AND NOT EXISTS (SELECT 1 FROM "POST_T" p WHERE p.pst_usr_id = u.usr_id AND p.pst_title = $3::VARCHAR)
         RETURNING pst_id`,
        [n.author, n.module, n.title, n.theme, NOTES.length - i],
      );
      if (rows.length === 0) continue;
      const id = rows[0].pst_id;
      inserted.notes += 1;
      for (const [j, s] of decks[i].slides.entries()) {
        const r = await client.query(
          `INSERT INTO "SLIDE_T" (sld_pst_id, sld_position, sld_doc, sld_notes) VALUES ($1, $2, $3, $4)
           ON CONFLICT (sld_pst_id, sld_position) DO NOTHING`,
          [id, j + 1, JSON.stringify({ background: s.background, elements: s.elements }), s.notes],
        );
        inserted.slides += r.rowCount ?? 0;
      }
      await client.query(`INSERT INTO "HASHTAG_T" (hsh_name) SELECT unnest($1::TEXT[]) ON CONFLICT DO NOTHING`, [
        n.tags,
      ]);
      await client.query(
        `INSERT INTO "POST_HASHTAG_T" (phs_pst_id, phs_hsh_id)
         SELECT $1, hsh_id FROM "HASHTAG_T" WHERE hsh_name = ANY($2::TEXT[]) ON CONFLICT DO NOTHING`,
        [id, n.tags],
      );
      // Same search document as notes/repository.ts builds on save, restricted to the text and code elements the seed writes.
      await client.query(
        `UPDATE "POST_T" p SET pst_search_doc = to_tsvector('english',
           p.pst_title || ' '
           || COALESCE((SELECT string_agg(CASE e ->> 'type' WHEN 'text' THEN regexp_replace(e ->> 'html', '<[^>]*>', ' ', 'g')
                                                            ELSE e ->> 'code' END, ' ' ORDER BY s.sld_position, ord)
                        FROM "SLIDE_T" s, jsonb_array_elements(s.sld_doc -> 'elements') WITH ORDINALITY AS t(e, ord)
                        WHERE s.sld_pst_id = p.pst_id), '') || ' '
           || COALESCE((SELECT string_agg(h.hsh_name, ' ') FROM "POST_HASHTAG_T" ph JOIN "HASHTAG_T" h ON h.hsh_id = ph.phs_hsh_id
                        WHERE ph.phs_pst_id = p.pst_id), ''))
         WHERE p.pst_id = $1`,
        [id],
      );
    }
    await client.query('COMMIT');

    const total: UatCounts = {
      users: USERS.length,
      modules: MODULES.length,
      notes: NOTES.length,
      slides: decks.reduce((sum, d) => sum + d.slides.length, 0),
    };
    return {
      db: dbRows[0].db,
      inserted,
      skipped: {
        users: total.users - inserted.users,
        modules: total.modules - inserted.modules,
        notes: total.notes - inserted.notes,
        slides: total.slides - inserted.slides,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

// Run as `vp run server#uat:seed`; importing the module (the test) does not touch the database.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { pool } = await import('../../lib/pool');
  try {
    const r = await seedUat(pool);
    console.log(`UAT seed on database ${r.db}`);
    console.log('inserted:', r.inserted);
    console.log('skipped (already present):', r.skipped);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
