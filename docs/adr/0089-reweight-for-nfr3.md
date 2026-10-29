# 0089 - Re-weight engagement and relevance for NFR3 (#101, 29 Oct 2026)

- **Context:** #77 (PR #100) measured NFR3 on the provisional labelled seed (10 viewers, adversarial: popular off-topic
  notes against weakly liked Subject notes). At the default weights a verified note reached every viewer's feed top 5
  (100%) and a subject-relevant note with any V reached 60%, but a subject-relevant note on M alone (V = 0) reached
  none (0%), so RANK-TC34 was recorded as an expected failure. Search precision@5 on the same seed was 0.833.
- **Decision:** (user, 29 Oct) under NFR5, which asks for the weights to be re-evaluated with w1 and w4 in particular:
  w1 engagement 0.30 → 0.24 and w4 relevance 0.15 → 0.21; w2 recency 0.25 and w3 lecturer validation 0.30 unchanged.
  The weights still sum to 1 and the score stays deterministic. After the change the seed gives verified 100%,
  subject-relevant any V 100% and subject-relevant on M alone 100%; search is unaffected (its own weights, P@5 0.833).
  UAT may still tune the weights; these are the initial values in the 4.5 re-evaluation table.
- **Alternatives:** keep the weights and accept the gap (fails NFR3 for unverified notes); boost relevance through a
  change to the score formula (larger scope, departs from the IR 2.3.4 formula).
- **Reversibility:** High; two constants in `server/src/features/ranking/config.ts` plus re-pinning RANK-TC33.
- **Tests:** RANK-TC33, RANK-TC34, RANK-TC31.
