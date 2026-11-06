# 0094 - AI-assisted label as a signed token (R28, #116, 6 Nov 2026)

- **Context:** a Note that includes accepted AI output shows an "AI-assisted" label (R28 spec, D83 question 4). The
  label must come from the server, so the client cannot set it on its own, and it must not need new state for every
  AI call. Session JWTs are signed with `JWT_SECRET` and verified with no audience check
  (`features/auth/passport.ts`), so a second token signed with the same secret and `sub` = user id would also pass as
  a login cookie.
- **Decision:**
  - Every `/api/ai/outline` and `/api/ai/rewrite` reply (Rewrite, Shorten and Quiz me share the second route) carries
    `aiToken`: an HS256 JWT with `sub` = the requesting user, audience `ai-output`, expiring 24 hours after the reply
    (`features/ai/token.ts`).
  - It is signed with its own key, HMAC-SHA256(`JWT_SECRET`, `'ai-output'`), not `JWT_SECRET` itself. A signature
    made with one key never verifies with the other, so an AI token sent as `notalah_token` is a 401 and a session
    token sent as `aiToken` sets nothing, both ways, without touching the session sign or verify options. The audience
    is checked as well. No new env var or key.
  - `POST /api/notes` and `PUT /api/notes/:id` read `aiToken` from the body. A token valid for the saving user (the
    Owner, or an edit Collaborator on PUT) sets `pst_ai_assisted_at = COALESCE(pst_ai_assisted_at, NOW())` in the same
    write; a missing, forged, expired or another user's token is ignored and the save still succeeds. Nothing clears
    the column, so the label stays once set.
  - Notes and feed cards carry `aiAssisted` (`pst_ai_assisted_at IS NOT NULL`). The editor keeps the token from its
    last applied AI reply and sends it with every save until another Note loads. The label is not a Ranking input.
  - Known limit: the token is per user, not per Note or per content, so a user's token from an AI reply on one Note
    marks another Note they save within 24 hours if the client sends it, and undoing the AI change does not take the
    token back. The client only sends it from the Note the reply was applied to; a user can only label their own
    work as AI-assisted, never remove the label, so the label errs towards disclosure.
- **Alternatives:** add audience `session` to the session sign and verify options (logged-in cookies issued before
  the change would stop working, and every session test helper changes); a server table of issued response ids per
  user (the spec's first idea; new state and cleanup for a label); trusting a client flag (anyone could set or skip
  the label).
- **Reversibility:** High; one migration column and one helper. Dropping it removes the label, not any Note content.
- **Tests:** AI-TC46, AI-TC47, AI-TC48, AI-TC49, AI-TC50, AI-TC51, AI-TC52, AI-TC53, AI-TC54, AI-TC55.
