# 0107 - The AI assistant is optional, server-side and capped (D33, 0085, 0093, 0094, #152, 26 Nov 2026)

- **Context:** the IR excluded AI; the owner added a writing assistant (D33), and the report must record it as
  an extension with academic-integrity safeguards; free-tier limits bound its use.
- **Decision:** AI exists only as an editor assistant (draft slides from text or an imported file, rewrite, shorten,
  quiz questions). Calls go from the server to an OpenAI-compatible provider set by `AI_BASE_URL`, `AI_API_KEY`,
  `AI_MODEL`; without a key the assistant is hidden. Output is validated against the deck schema
  ([0106](0106-slide-note-deck-schema-in-shared.md)) and always lands as an editable draft; notes made with it carry a
  signed "AI-assisted" label ([0094](0094-ai-assisted-label-signed-token.md)); app-wide and per-user daily caps reserve
  tokens before each call ([0093](0093-ai-free-tier-caps-and-token-reservation.md)). File import runs in the browser
  ([0100](0100-file-import-limits-and-browser-extraction.md)). Ranking, search and moderation never call a model.
- **Alternatives:** no AI (keeps the IR scope); AI-assisted ranking (not explainable).
- **Reversibility:** High; behind configuration.
- **Tests:** AI-TC series.
