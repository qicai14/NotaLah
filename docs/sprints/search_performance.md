# Search latency, SRCH-TC10 (NFR1 / FR5)

**Result: pass.** 50 mixed queries over 10,000 seeded notes: median **124 ms**, maximum **789 ms**, all under the
3,000 ms target. The blended note order (text rank with E and V, D48) stays; the text-rank-only fallback was not needed.

## Setup
- Test: `server/tests/search/perf.test.ts`, run on demand with
  `SEARCH_PERF=1 npx vitest run tests/search/perf.test.ts` from `server/` (skipped in the normal suite). It truncates the
  test database, so it only runs against `TEST_DATABASE_URL`.
- Data (seeded in SQL with a fixed random seed): 300 users (20 approved lecturers, 6 suspended), 10,000 published notes
  (10% contacts-only) spread over 180 days and the 12 seeded modules, 3 slides of 40-46 words each, 3 hashtags per note
  from a 74-word vocabulary, about 50,000 likes, 20,000 comments, 600 Super Likes, 3,000 follows, one term.
- The vocabulary is small, so common words match most notes (for example "database" matched 7,506 of 10,000). That is a
  worst case: every match is scored on each request, so broad queries are the slow ones.
- Each query goes through the full HTTP path (Supertest against the Express app, `optionalAuth`, zod, SQL, scoring,
  loading the 20 notes of page 1). 25 queries as a guest and the same 25 signed in. Top tab unless stated, so most also
  run the people, hashtags and modules sections.
- Machine: developer laptop (Windows 11), Node 24.19, PostgreSQL 17.11 in Docker; 16 Oct 2026.

## Results (ms, second run)

| Query | Guest | Signed in |
| --- | ---: | ---: |
| `database` | 480 | 437 |
| `third normal form` | 754 | 670 |
| `"normal form"` | 88 | 100 |
| `#deadlock` | 48 | 49 |
| `CT030-3-2` | 159 | 161 |
| `Software Engineering` | 325 | 327 |
| `tan`, people tab | 7 | 5 |
| `net`, hashtags tab | 11 | 8 |
| `ct0`, modules tab | 25 | 17 |
| `kernel thread` | 673 | 626 |
| `agile scrum`, lecturer=any | 155 | 148 |
| `network`, lecturer=3 | 777 | 789 |
| `cache`, from/to (last 30 days) | 93 | 103 |
| `routing`, term | 217 | 198 |
| `algorithm`, module=5 | 60 | 61 |
| `react component`, notes tab | 637 | 623 |
| `Computer Science`, notes tab, lecturer=any | 124 | 124 |
| `lim` | 55 | 55 |
| `security encryption hashing` | 654 | 661 |
| `zzzz no match` | 55 | 52 |
| `the` (stop word only) | 54 | 51 |
| `#security`, lecturer=any | 30 | 32 |
| `query`, notes tab, from (last 30 days) | 121 | 98 |
| `Database Systems` | 142 | 152 |
| `testing` | 421 | 524 |

The first run gave median 123 ms and maximum 875 ms.

## Indexes (EXPLAIN ANALYZE on the seeded data)
- Notes: for broad queries Postgres scans `"POST_T"` sequentially (about 10-60 ms for 10,000 rows), which is the right
  plan when three quarters of the notes match; most of the time goes to the per-match like and comment counts that E
  needs. The module branch is written as `pst_mod_id = ANY (ARRAY(...))` so the planner can combine the `pst_search_doc`
  GIN index and `post_module_idx` in a BitmapOr for selective queries (confirmed with sequential scans disabled).
- People (0.3 ms) and hashtags (4.5 ms) use `ILIKE '%term%'` on 300 users and 74 tags; no trigram index was added
  because the scans are already negligible. Revisit with `pg_trgm` if the user table grows past tens of thousands.
- No index migration was needed.
