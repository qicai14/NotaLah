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
