import { deckSchema } from '@notalah/shared';
import { pathToFileURL } from 'node:url';
import type { Pool } from 'pg';
import { hashPassword } from '../../features/auth/passport';
import { MODULES, NOTES, REPORTS, USERS, USER_PROGRAMME, toDeck, uatPassword } from './data';

export interface UatCounts {
  users: number;
  modules: number;
  notes: number;
  slides: number;
  reports: number;
}
export interface UatResult {
  db: string;
  inserted: UatCounts;
  skipped: UatCounts;
}

/** Adds the UAT accounts (password per role: admin123, lecturer123, student123, or UAT_PASSWORD), modules and notes in one transaction; rows that already exist are left as they are. */
export async function seedUat(pool: Pool, password?: string): Promise<UatResult> {
  const decks = NOTES.map((n) => deckSchema.parse(toDeck(n)));
  const hashes = new Map(
    await Promise.all(
      [...new Set(USERS.map((u) => u.role))].map(
        async (r) => [r, await hashPassword(password ?? uatPassword(r))] as const,
      ),
    ),
  );
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('notalah_uat_seed'))`);
    const { rows: dbRows } = await client.query<{ db: string }>('SELECT current_database() AS db');
    const inserted: UatCounts = { users: 0, modules: 0, notes: 0, slides: 0, reports: 0 };

    for (const u of USERS) {
      const r = await client.query(
        `INSERT INTO "USER_T" (usr_email, usr_password_hash, usr_display_name, usr_role, usr_lecturer_status, usr_staff_id, usr_programme)
         VALUES ($1, $2, $3, $4::VARCHAR, CASE WHEN $4::VARCHAR = 'lecturer' THEN 'approved' END, $5, $6)
         ON CONFLICT (usr_email) DO NOTHING`,
        [u.email, hashes.get(u.role), u.name, u.role, u.staffId, USER_PROGRAMME],
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
      const { rows } = await client.query<{ pst_id: number }>(
        `INSERT INTO "POST_T" (pst_usr_id, pst_mod_id, pst_title, pst_template, pst_aspect, pst_status, pst_visibility,
                               pst_published_at, pst_created_at, pst_updated_at)
         SELECT u.usr_id, m.mod_id, $3::VARCHAR, $4::VARCHAR, '4:5', $6::VARCHAR, 'public',
                NOW() - ($5::INT * INTERVAL '6 hours'), NOW() - ($5::INT * INTERVAL '6 hours'),
                -- A hidden note is the most recently changed one, so it is the latest hidden.
                CASE WHEN $6::VARCHAR = 'hidden' THEN NOW() ELSE NOW() - ($5::INT * INTERVAL '6 hours') END
         FROM "USER_T" u, "MODULE_T" m
         WHERE u.usr_email = $1 AND m.mod_code = $2
           AND NOT EXISTS (SELECT 1 FROM "POST_T" p WHERE p.pst_usr_id = u.usr_id AND p.pst_title = $3::VARCHAR)
         RETURNING pst_id`,
        [n.author, n.module, n.title, n.theme, NOTES.length - i, n.hidden ? 'hidden' : 'published'],
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
    for (const r of REPORTS) {
      const author = NOTES.find((n) => n.title === r.title)?.author;
      const res = await client.query(
        `INSERT INTO "REPORT_T" (rpt_pst_id, rpt_reporter_id, rpt_reason, rpt_details)
         SELECT p.pst_id, rep.usr_id, $4::VARCHAR, $5::VARCHAR
         FROM "POST_T" p JOIN "USER_T" a ON a.usr_id = p.pst_usr_id AND a.usr_email = $2, "USER_T" rep
         WHERE p.pst_title = $1::VARCHAR AND rep.usr_email = $3
           AND NOT EXISTS (SELECT 1 FROM "REPORT_T" x WHERE x.rpt_pst_id = p.pst_id AND x.rpt_reporter_id = rep.usr_id)`,
        [r.title, author, r.reporter, r.reason, r.details],
      );
      inserted.reports += res.rowCount ?? 0;
    }
    await client.query('COMMIT');

    const total: UatCounts = {
      users: USERS.length,
      modules: MODULES.length,
      notes: NOTES.length,
      slides: decks.reduce((sum, d) => sum + d.slides.length, 0),
      reports: REPORTS.length,
    };
    return {
      db: dbRows[0].db,
      inserted,
      skipped: {
        users: total.users - inserted.users,
        modules: total.modules - inserted.modules,
        notes: total.notes - inserted.notes,
        slides: total.slides - inserted.slides,
        reports: total.reports - inserted.reports,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

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
