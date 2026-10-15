import { performance } from 'node:perf_hooks';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../src/app';
import { pool } from '../../src/lib/pool';
import { asUser, truncateAll } from '../helpers';

// SRCH-TC10 (NFR1). Seeds 10,000 notes, so it runs only on request: SEARCH_PERF=1 npx vitest run tests/search/perf.test.ts
const NOTES = 10_000;
const WORDS = `database normalisation third normal form index query join transaction deadlock kernel thread process scheduler
memory paging cache network routing subnet protocol packet security encryption hashing algorithm sorting graph tree heap
stack queue recursion complexity requirement stakeholder agile scrum sprint testing unit integration react component state
server client socket latency throughput compiler parser grammar lexer neural learning model dataset regression cluster
project management risk budget schedule ethics privacy cloud container virtual machine storage backup recovery`.split(/\s+/);

async function seed(): Promise<void> {
  await truncateAll();
  await pool.query(`SELECT setseed(0.42)`);
  await pool.query(
    `INSERT INTO "USER_T" (usr_email, usr_password_hash, usr_display_name, usr_role, usr_status, usr_lecturer_status, usr_staff_id, usr_programme)
     SELECT 'perf' || g || '@mail.apu.edu.my', repeat('x', 60),
            (ARRAY['Tan', 'Lee', 'Lim', 'Wong', 'Kumar', 'Siti', 'Ahmad', 'Chen'])[1 + g % 8] || ' ' || 'Student ' || g,
            CASE WHEN g <= 20 THEN 'lecturer' ELSE 'student' END,
            CASE WHEN g % 50 = 0 THEN 'suspended' ELSE 'active' END,
            CASE WHEN g <= 20 THEN 'approved' END, CASE WHEN g <= 20 THEN 'S' || g END, 'Software Engineering'
     FROM generate_series(1, 300) g`,
  );
  await pool.query(`INSERT INTO "HASHTAG_T" (hsh_name) SELECT DISTINCT unnest($1::TEXT[])`, [WORDS]);
  await pool.query(
    `INSERT INTO "POST_T" (pst_usr_id, pst_mod_id, pst_title, pst_status, pst_visibility, pst_published_at, pst_created_at)
     SELECT 1 + floor(random() * 300)::INT, (SELECT mod_id FROM "MODULE_T" ORDER BY mod_id OFFSET g % 12 LIMIT 1),
            initcap(($2::TEXT[])[1 + floor(random() * cardinality($2::TEXT[]))::INT] || ' ' || ($2::TEXT[])[1 + floor(random() * cardinality($2::TEXT[]))::INT]),
            'published', CASE WHEN g % 10 = 0 THEN 'contacts' ELSE 'public' END,
            NOW() - random() * INTERVAL '180 days', NOW() - INTERVAL '181 days'
     FROM generate_series(1, $1) g`,
    [NOTES, WORDS],
  );
  await pool.query(
    `INSERT INTO "SLIDE_T" (sld_pst_id, sld_position, sld_content)
     SELECT p.pst_id, s, '<p>' || (SELECT string_agg(($1::TEXT[])[1 + floor(random() * cardinality($1::TEXT[]))::INT], ' ')
                                   FROM generate_series(1, 40 + p.pst_id % 7)) || '</p>'
     FROM "POST_T" p, generate_series(1, 3) s`,
    [WORDS],
  );
  await pool.query(
    `INSERT INTO "POST_HASHTAG_T" (phs_pst_id, phs_hsh_id)
     SELECT DISTINCT p.pst_id, 1 + floor(random() * (SELECT COUNT(*) FROM "HASHTAG_T"))::INT
     FROM "POST_T" p, generate_series(1, 3)`,
  );
  await pool.query(
    `INSERT INTO "LIKE_T" (lik_usr_id, lik_pst_id)
     SELECT DISTINCT 1 + floor(random() * 300)::INT, 1 + floor(random() * $1)::INT FROM generate_series(1, 50000)`,
    [NOTES],
  );
  await pool.query(
    `INSERT INTO "COMMENT_T" (cmt_pst_id, cmt_usr_id, cmt_body)
     SELECT 1 + floor(random() * $1)::INT, 1 + floor(random() * 300)::INT, 'Helpful, thanks' FROM generate_series(1, 20000)`,
    [NOTES],
  );
  await pool.query(
    `INSERT INTO "VERIFICATION_T" (ver_pst_id, ver_usr_id)
     SELECT DISTINCT 1 + floor(random() * $1)::INT, 1 + floor(random() * 20)::INT FROM generate_series(1, 600)`,
    [NOTES],
  );
  await pool.query(
    `INSERT INTO "FOLLOW_T" (fol_follower_id, fol_followee_id)
     SELECT DISTINCT a, b FROM (SELECT 1 + floor(random() * 300)::INT a, 1 + floor(random() * 300)::INT b
                                FROM generate_series(1, 3000)) f WHERE a <> b`,
  );
  // The same search document notes/repository.ts builds on save (D20).
  await pool.query(
    `UPDATE "POST_T" p
     SET pst_search_doc = to_tsvector('english',
           p.pst_title || ' '
           || COALESCE((SELECT string_agg(regexp_replace(s.sld_content, '<[^>]*>', ' ', 'g'), ' ' ORDER BY s.sld_position)
                        FROM "SLIDE_T" s WHERE s.sld_pst_id = p.pst_id), '') || ' '
           || COALESCE((SELECT string_agg(h.hsh_name, ' ')
                        FROM "POST_HASHTAG_T" ph JOIN "HASHTAG_T" h ON h.hsh_id = ph.phs_hsh_id
                        WHERE ph.phs_pst_id = p.pst_id), ''))`,
  );
  await pool.query(`INSERT INTO "TERM_T" (trm_name, trm_start_date, trm_end_date) VALUES ('Perf term', CURRENT_DATE - 60, CURRENT_DATE)`);
  await pool.query(`ANALYZE`);
}

const today = new Date().toISOString().slice(0, 10);
const monthAgo = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

/** 50 mixed queries: keywords, phrases, hashtags, module codes, programmes, people, filters, tabs, guests and users. */
function queries(termId: number): Record<string, string>[] {
  const base: Record<string, string>[] = [
    { q: 'database' }, { q: 'third normal form' }, { q: '"normal form"' }, { q: '#deadlock' }, { q: 'CT030-3-2' },
    { q: 'Software Engineering' }, { q: 'tan', tab: 'people' }, { q: 'net', tab: 'hashtags' }, { q: 'ct0', tab: 'modules' },
    { q: 'kernel thread' }, { q: 'agile scrum', lecturer: 'any' }, { q: 'network', lecturer: '3' },
    { q: 'cache', from: monthAgo, to: today }, { q: 'routing', term: String(termId) }, { q: 'algorithm', module: '5' },
    { q: 'react component', tab: 'notes' }, { q: 'Computer Science', tab: 'notes', lecturer: 'any' }, { q: 'lim' },
    { q: 'security encryption hashing' }, { q: 'zzzz no match' }, { q: 'the' }, { q: '#security', lecturer: 'any' },
    { q: 'query', tab: 'notes', from: monthAgo }, { q: 'Database Systems' }, { q: 'testing' },
  ];
  return [...base, ...base.map((q) => ({ ...q, signedIn: '1' }))];
}

describe.skipIf(!process.env.SEARCH_PERF)('Search latency (NFR1)', () => {
  beforeAll(seed, 600_000);
  afterAll(async () => {
    await truncateAll();
    await pool.end();
  });

  it('SRCH-TC10: 50 mixed queries over 10,000 notes each answer in under 3,000 ms', async () => {
    const termId = (await pool.query<{ trm_id: number }>(`SELECT trm_id FROM "TERM_T"`)).rows[0].trm_id;
    const user = asUser(25);
    await request(app).get('/api/search').query({ q: 'warm up' }); // first request loads the app's lazy modules
    const times: { query: string; ms: number; count: number }[] = [];
    for (const { signedIn, ...query } of queries(termId)) {
      const start = performance.now();
      const res = await request(app).get('/api/search').query(query).set(signedIn ? user : {});
      const ms = performance.now() - start;
      expect(res.status).toBe(200);
      times.push({ query: `${signedIn ? 'user ' : 'guest'} ${new URLSearchParams(query)}`, ms, count: res.body.items.length });
    }
    const sorted = times.map((t) => t.ms).sort((a, b) => a - b);
    const median = (sorted[24] + sorted[25]) / 2;
    console.table(times.map((t) => ({ ...t, ms: Math.round(t.ms) })));
    console.log(`SRCH-TC10 n=${times.length} median=${median.toFixed(0)} ms max=${sorted[sorted.length - 1].toFixed(0)} ms`);
    expect(times).toHaveLength(50);
    expect(sorted[sorted.length - 1]).toBeLessThan(3000);
  }, 600_000);
});
