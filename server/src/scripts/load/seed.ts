import bcrypt from 'bcryptjs';
import { BCRYPT_COST } from '../../features/auth/passport';
import { pool } from '../../lib/pool';
import { LOAD_PASSWORD, SEED, WORDS, loadEmail } from './data';
import { assertLoadDatabase } from './guard';

const { users: USERS, notes: NOTES, days: DAYS, lecturers: LECTURERS, extraModules, modules } = SEED;

const client = await pool.connect();
try {
  const { rows } = await client.query<{ db: string }>('SELECT current_database() AS db');
  assertLoadDatabase(rows[0].db);
  const hash = await bcrypt.hash(LOAD_PASSWORD, BCRYPT_COST);

  await client.query('BEGIN');
  const { rows: tables } = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('schema_migrations', 'MODULE_T')`,
  );
  await client.query(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} RESTART IDENTITY CASCADE`);
  // setseed makes every random() below repeatable, so the same arguments build the same database.
  await client.query('SELECT setseed(0.27)');

  await client.query(
    `INSERT INTO "MODULE_T" (mod_code, mod_name, mod_programme)
     SELECT 'LD' || LPAD(g::TEXT, 3, '0') || '-3-2', 'Load Module ' || g,
            (ARRAY['BSc (Hons) Software Engineering', 'BSc (Hons) Computer Science', 'BSc (Hons) Information Technology'])[1 + g % 3]
     FROM generate_series(1, $1) g
     ON CONFLICT DO NOTHING`,
    [extraModules],
  );
  await client.query(
    `INSERT INTO "USER_T" (usr_email, usr_password_hash, usr_display_name, usr_role, usr_lecturer_status, usr_staff_id, usr_programme)
     SELECT 'load' || g || '@mail.apu.edu.my', $2,
            (ARRAY['Tan', 'Lee', 'Lim', 'Wong', 'Kumar', 'Siti', 'Ahmad', 'Chen'])[1 + g % 8] || ' '
              || (ARRAY['Wei', 'Priya', 'Aisha', 'Daniel', 'Mei'])[1 + g % 5] || ' ' || g,
            CASE WHEN g <= $3 THEN 'lecturer' ELSE 'student' END,
            CASE WHEN g <= $3 THEN 'approved' END, CASE WHEN g <= $3 THEN 'S' || g END,
            (ARRAY['Software Engineering', 'Computer Science', 'Information Technology'])[1 + g % 3]
     FROM generate_series(1, $1) g`,
    [USERS, hash, LECTURERS],
  );
  await client.query(`INSERT INTO "HASHTAG_T" (hsh_name) SELECT DISTINCT unnest($1::TEXT[])`, [WORDS]);

  const word = `($1::TEXT[])[1 + floor(random() * cardinality($1::TEXT[]))::INT]`;
  await client.query(
    `INSERT INTO "POST_T" (pst_usr_id, pst_mod_id, pst_title, pst_status, pst_visibility, pst_published_at, pst_created_at)
     SELECT 1 + floor(power(random(), 1.7) * $2)::INT, (SELECT mod_id FROM "MODULE_T" ORDER BY mod_id OFFSET g % $5 LIMIT 1),
            initcap(${word} || ' ' || ${word} || CASE WHEN g % 3 = 0 THEN ' ' || ${word} ELSE '' END),
            'published', CASE WHEN g % 10 = 0 THEN 'contacts' ELSE 'public' END,
            NOW() - INTERVAL '3 minutes' - random() * $3 * INTERVAL '1 day', NOW() - $3 * INTERVAL '1 day' - INTERVAL '1 hour'
     FROM generate_series(1, $4) g`,
    [WORDS, USERS, DAYS, NOTES, modules],
  );
  // 3 to 8 slides per note, one text element each, in the shape the notes API stores.
  await client.query(
    `INSERT INTO "SLIDE_T" (sld_pst_id, sld_position, sld_doc)
     SELECT p.pst_id, s, jsonb_build_object(
              'background', jsonb_build_object('kind', 'color', 'color', '#ffffff'),
              'elements', jsonb_build_array(jsonb_build_object(
                'id', 'text-' || LPAD(s::TEXT, 3, '0'), 'type', 'text', 'x', 60, 'y', 60, 'w', 880, 'h', 1130, 'rotation', 0,
                'opacity', 1, 'locked', FALSE, 'font', 'source-sans-3', 'size', 32, 'weight', 400, 'color', '#111827',
                'align', 'left', 'lineHeight', 1.4, 'letterSpacing', 0, 'padding', 0,
                'html', '<p>' || (SELECT string_agg(${word}, ' ') FROM generate_series(1, 30 + (p.pst_id * s) % 30)) || '</p>')))
     FROM "POST_T" p, generate_series(1, 3 + (p.pst_id * 7) % 6) s`,
    [WORDS],
  );
  await client.query(
    `INSERT INTO "POST_HASHTAG_T" (phs_pst_id, phs_hsh_id)
     SELECT DISTINCT p.pst_id, 1 + floor(power(random(), 1.5) * (SELECT COUNT(*) FROM "HASHTAG_T"))::INT
     FROM "POST_T" p, generate_series(1, 1 + p.pst_id % 4)`,
  );
  // Same search document as notes/repository.ts builds on save, restricted to the text elements the seed writes.
  await client.query(
    `UPDATE "POST_T" p SET pst_search_doc = to_tsvector('english',
       p.pst_title || ' '
       || COALESCE((SELECT string_agg(regexp_replace(e ->> 'html', '<[^>]*>', ' ', 'g'), ' ' ORDER BY s.sld_position)
                    FROM "SLIDE_T" s, jsonb_array_elements(s.sld_doc -> 'elements') e WHERE s.sld_pst_id = p.pst_id), '') || ' '
       || COALESCE((SELECT string_agg(h.hsh_name, ' ') FROM "POST_HASHTAG_T" ph JOIN "HASHTAG_T" h ON h.hsh_id = ph.phs_hsh_id
                    WHERE ph.phs_pst_id = p.pst_id), ''))`,
  );

  // Random (user, note) pairs, drawn in a subquery so each row is drawn once; the note pick is skewed so a few notes are popular.
  const pairs = (count: string, skew: string) =>
    `(SELECT g, 1 + floor(random() * $2)::INT AS uid, 1 + floor(${skew} * $1)::INT AS pid FROM generate_series(1, ${count}) g) x
     JOIN "POST_T" p ON p.pst_id = x.pid`;
  const later = `p.pst_published_at + random() * (NOW() - p.pst_published_at)`;
  await client.query(
    `INSERT INTO "LIKE_T" (lik_usr_id, lik_pst_id, lik_created_at)
     SELECT x.uid, p.pst_id, ${later} FROM ${pairs('$3::INT', 'power(random(), 2)')} ON CONFLICT DO NOTHING`,
    [NOTES, USERS, NOTES * 12],
  );
  await client.query(
    `INSERT INTO "COMMENT_T" (cmt_pst_id, cmt_usr_id, cmt_body, cmt_created_at)
     SELECT p.pst_id, x.uid, 'Load test comment ' || x.g || ' on ' || p.pst_title, ${later}
     FROM ${pairs('$3::INT', 'power(random(), 2)')}`,
    [NOTES, USERS, NOTES * 3],
  );
  await client.query(
    `INSERT INTO "INTERACTION_T" (int_usr_id, int_pst_id, int_type, int_created_at)
     SELECT lik_usr_id, lik_pst_id, 'like', lik_created_at FROM "LIKE_T"
     UNION ALL SELECT cmt_usr_id, cmt_pst_id, 'comment', cmt_created_at FROM "COMMENT_T"
     UNION ALL SELECT x.uid, p.pst_id, 'view', ${later} FROM ${pairs('$3::INT', 'random()')}`,
    [NOTES, USERS, NOTES * 20],
  );
  await client.query(
    `INSERT INTO "FOLLOW_T" (fol_follower_id, fol_followee_id)
     SELECT a, b FROM (SELECT 1 + floor(random() * $1)::INT AS a, 1 + floor(power(random(), 1.7) * $1)::INT AS b
                       FROM generate_series(1, $1 * 10)) f
     WHERE a <> b ON CONFLICT DO NOTHING`,
    [USERS],
  );
  // About one note in ten carries a Super Like from a lecturer other than its author.
  await client.query(
    `INSERT INTO "VERIFICATION_T" (ver_pst_id, ver_usr_id, ver_created_at)
     SELECT p.pst_id, x.lec, p.pst_published_at + random() * (NOW() - p.pst_published_at)
     FROM (SELECT g, 1 + floor(random() * $2)::INT AS lec FROM generate_series(1, $1) g) x
     JOIN "POST_T" p ON p.pst_id = x.g AND x.g % 10 = 0 AND p.pst_usr_id <> x.lec
     ON CONFLICT DO NOTHING`,
    [NOTES, LECTURERS],
  );
  await client.query('COMMIT');
  await client.query('ANALYZE');

  const { rows: counts } = await client.query(
    `SELECT (SELECT COUNT(*) FROM "USER_T") AS users, (SELECT COUNT(*) FROM "POST_T") AS notes,
            (SELECT COUNT(*) FROM "SLIDE_T") AS slides, (SELECT COUNT(*) FROM "HASHTAG_T") AS hashtags,
            (SELECT COUNT(*) FROM "LIKE_T") AS likes, (SELECT COUNT(*) FROM "COMMENT_T") AS comments,
            (SELECT COUNT(*) FROM "FOLLOW_T") AS follows, (SELECT COUNT(*) FROM "INTERACTION_T") AS interactions,
            (SELECT COUNT(*) FROM "VERIFICATION_T") AS verifications`,
  );
  console.log(`Seeded ${rows[0].db}:`, counts[0]);
  console.log(`Accounts ${loadEmail(1)} to ${loadEmail(USERS)}; the first ${LECTURERS} are approved lecturers.`);
} catch (err) {
  await client.query('ROLLBACK').catch(() => undefined);
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
