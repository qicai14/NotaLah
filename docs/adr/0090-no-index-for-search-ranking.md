# 0090 - No new index for search and feed at 10x; free-text ranking gap recorded (#78, 29 Oct 2026)

- **Context:** #78 asked for search and feed p95 under 300 ms at 10 times the load seed (20,000 notes), adding only
  the indexes the query plans show are needed. At 10x, module, hashtag and lecturer-filtered search and both feeds
  pass (p95 91 to 229 ms). Keyword and Top search do not (p95 742 and 735 ms). Their plan ranks every matching note
  with `ts_rank_cd`, and a seed word matches 91% of notes. Matching takes 31 ms and ranking 564 ms, the same with the
  GIN index forced (`docs/testing/load/2026-10-29_latency.md`).
- **Decision:** add no index. Every selective predicate (module, hashtag, feed order, follows, likes, comments) already
  uses one. Record the keyword and Top gap as SRCH-TC23 (Fail against 300 ms, still under the 3,000 ms NFR1 limit),
  as #78's acceptance allows.
- **Alternatives:** a GIN or covering index (does not help: the cost is ranking, not finding rows); ranking a capped
  set of the newest matches (meets the target but changes which notes search returns, so it would need its own issue
  and the user's approval); a seed with a realistic vocabulary (would hide the worst case, not fix it).
- **Reversibility:** High; nothing changed in the schema or the queries.
- **Tests:** SRCH-TC22, SRCH-TC23, OPS-TC19, OPS-TC20.
