# Architecture and scope decisions

One file per decision, `NNNN-short-title.md`, numbered after the highest file here (D1-D83 live in
[`../DECISIONS.md`](../DECISIONS.md), frozen on 25 Oct 2026). A new file per decision means parallel branches never
conflict on a shared log. If two open branches pick the same number, the one that merges second renumbers.

Template:

```markdown
# NNNN - Title (R-item or issue #, date)

- **Context:** why a decision was needed.
- **Decision:** what was chosen (say "user" when the user decided).
- **Alternatives:** what else was considered and why not.
- **Reversibility:** High / Medium / Low, and what undoing it takes.
- **Tests:** TC IDs, if any.
```

Architecture overview (summaries that link the D-entries and the code): [0101](0101-pnpm-monorepo-on-vite-plus.md) toolchain,
[0102](0102-three-tier-rest-api-with-socket-io.md) tiers, [0103](0103-plain-sql-migrations-with-dbmate.md) database,
[0104](0104-jwt-cookie-with-csrf-header.md) auth, [0105](0105-deterministic-feed-ranking-heuristic.md) ranking,
[0106](0106-slide-note-deck-schema-in-shared.md) deck schema, [0107](0107-ai-assistant-optional-and-bounded.md) AI,
[0108](0108-local-first-demo-deploy-optional.md) local-first deployment,
[0109](0109-note-anchored-messaging.md) messaging.
