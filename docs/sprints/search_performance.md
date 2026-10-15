# Search latency, SRCH-TC10 (NFR1 / FR5)

**Result: pass.** 50 mixed queries over 10,000 seeded notes: median **134 ms**, maximum **897 ms**, all under the
3,000 ms target (re-measured after the review fixes: asOf cutoff and the 500-candidate cap). The blended note order (text rank with E and V, D48) stays; the text-rank-only fallback was not needed.

## Setup
- Test: `server/tests/search/perf.test.ts`, run on demand with
  `SEARCH_PERF=1 npx vitest run tests/search/perf.test.ts` from `server/` (skipped in the normal suite). It truncates the
  test database, so it only runs against `TEST_DATABASE_URL`.
- Data (seeded in SQL with a fixed random seed): 300 users (20 approved lecturers, 6 suspended), 10,000 published notes
  (10% contacts-only) spread over 180 days and the 12 seeded modules, 3 slides of 40-46 words each, 3 hashtags per note
  from a 74-word vocabulary, about 50,000 likes, 20,000 comments, 600 Super Likes, 3,000 follows, one term.
- The vocabulary is small, so common words match most notes (for example "database" matched 7,506 of 10,000). That is a
  worst case: every match is ranked by text and the best 500 are scored, so broad queries are the slow ones.
- Each query goes through the full HTTP path (Supertest against the Express app, `optionalAuth`, zod, SQL, scoring,
  loading the 20 notes of page 1). 25 queries as a guest and the same 25 signed in. Top tab unless stated, so most also
  run the people, hashtags and modules sections.
- Machine: developer laptop (Windows 11), Node 24.19, PostgreSQL 17.11 in Docker; 16 Oct 2026.

## Results (ms, after the review fixes)

| Query | Guest | Signed in |
| --- | ---: | ---: |
| `database` | 350 | 312 |
| `third normal form` | 582 | 554 |
| `"normal form"` | 98 | 91 |
| `#deadlock` | 47 | 51 |
| `CT030-3-2` | 158 | 154 |
| `Software Engineering` | 280 | 327 |
| `tan`, people tab | 6 | 6 |
| `net`, hashtags tab | 8 | 9 |
| `ct0`, modules tab | 18 | 18 |
| `kernel thread` | 485 | 499 |
| `agile scrum`, lecturer=any | 162 | 169 |
| `network`, lecturer=3 | 897 | 826 |
| `cache`, from/to (last 30 days) | 73 | 81 |
| `routing`, term | 162 | 168 |
| `algorithm`, module=5 | 55 | 60 |
| `react component`, notes tab | 493 | 485 |
| `Computer Science`, notes tab, lecturer=any | 175 | 136 |
| `lim` | 58 | 57 |
| `security encryption hashing` | 539 | 546 |
| `zzzz no match` | 55 | 55 |
| `the` (stop word only) | 55 | 57 |
| `#security`, lecturer=any | 33 | 32 |
| `query`, notes tab, from (last 30 days) | 69 | 82 |
| `Database Systems` | 132 | 142 |
| `testing` | 316 | 299 |

Before the review fixes (no cutoff, every match scored) two runs gave median 123 / 124 ms and maximum 875 / 789 ms.
The 500-candidate cap mainly helps broad queries (`database` 480 to 350 ms, `kernel thread` 673 to 485 ms); a lecturer
filter still evaluates its Super Like check on every match before the cap, so `network`, lecturer=3 is the slowest.

## Indexes (EXPLAIN ANALYZE on the seeded data)
- Notes: for broad queries Postgres scans `"POST_T"` sequentially (about 10-60 ms for 10,000 rows), which is the right
  plan when three quarters of the notes match; before the cap most of the time went to the per-match like and comment
  counts that E needs; they are now computed for the 500 candidates only. The module branch is written as `pst_mod_id = ANY (ARRAY(...))` so the planner can combine the `pst_search_doc`
  GIN index and `post_module_idx` in a BitmapOr for selective queries (confirmed with sequential scans disabled).
- People (0.3 ms) and hashtags (4.5 ms) use `ILIKE '%term%'` on 300 users and 74 tags; no trigram index was added
  because the scans are already negligible. Revisit with `pg_trgm` if the user table grows past tens of thousands.
- No index migration was needed.
