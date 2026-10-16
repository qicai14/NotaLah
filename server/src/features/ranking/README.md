# server feature: ranking

Heuristic feed ranking (IR 2.3.4): S = w1·E + w2·R + w3·V + w4·M, scored in the app per feed request.

- `config.ts`: every weight and constant (NFR5), the only place they may be changed: weights, engagement cap,
  recency and interest half-lives, interaction weights (view 1, like 3, comment 5), the 90-day interest window and
  the 500-note candidate limit. `assertWeightsSumToOne` runs at server start-up.
- `service.ts`: pure functions `engagement`, `recency`, `validation`, `relevance`, `score`, `buildInterestVector`,
  plus `scoreCandidate` that applies them to one note against the feed's `asOf`.
- `repository.ts`: `getCandidates` (the newest visible published notes at or before `asOf` united with every note
  verified by then, with counts and verified as of `asOf`, the lecturer-author flag and hashtags; reuses the notes SQL
  fragments) and `getInteractionRows` (the viewer's
  interactions joined to post hashtags inside the interest window).

The feed (`feed/service.ts` `getFeedPage`) runs four queries per request: the `asOf` cutoff, candidates and
interactions (in parallel), then the full notes of the requested page. Each item carries `score` and
`components {E, R, V, M}`.

Serves: FR3, NFR3, NFR5. Test table: `RANK-TC*` (tests in `server/tests/ranking/`; TC9/TC10 in `tests/feed/`).
Decisions: D22, D24.
