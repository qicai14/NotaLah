# 0105 - Feed ranked by a deterministic heuristic, interests derived from an interaction log (D10, D24, #152, 26 Nov 2026)

- **Context:** the feed must be explainable and tunable (NFR5) and reproducible in tests; the IR excludes opaque
  recommender models.
- **Decision:** `GET /api/feed` scores candidate notes with pure functions in `ranking/service.ts` and sorts by score,
  ties by `published_at` then id. Candidates are the newest 500 visible published notes at or before the request's
  `asOf` plus every note with a valid lecturer Super Like. A viewer's interest per hashtag is computed at query time from
  `"INTERACTION_T"` (view 1, like 3, comment 5, decayed with a 14-day half-life, normalised to a maximum of 1), not
  stored. Every weight and constant lives in `server/src/features/ranking/config.ts`. Paging uses a per-`asOf` snapshot
  so pages do not shift (D40).
- **Alternatives:** a maintained `INTEREST_T` table updated on every interaction (a data migration on every re-tune);
  a learned ranking model (not explainable, not in scope; D33 keeps the AI assistant apart from ranking).
- **Reversibility:** High; an additive cache table is the escape if feed latency suffers. Known limit: an unverified
  note older than the newest 500 is never ranked (D24).
- **Tests:** RANK-TC series; [0089](0089-reweight-for-nfr3.md) and [0090](0090-no-index-for-search-ranking.md) record
  the later tuning.
