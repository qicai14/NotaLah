# 0093 - AI free-tier caps and token reservation (R28, #112, 1 Nov 2026)

- **Context:** the R28 spec (#110) caps all AI use at 80% of the provider's free-tier request and token limits (D74,
  D57), with the values checked at build time, and wants every provider call, retries included, counted before it is
  sent. The provider is Groq with `openai/gpt-oss-120b` (D33, D43). A token count is only known after a
  reply, so "counted first" needs a rule for tokens.
- **Decision:**
  - Limits checked 1 Nov 2026 on console.groq.com/docs/rate-limits: 30 requests a minute, 1,000 a day, 8,000 tokens a
    minute, 200,000 a day. The page labels its table as the base plan limits and points to the account's own limits
    page, so the owner should confirm the free numbers in the console. App-wide daily caps are 80%: `ai_requests` 800
    and `ai_tokens` 160,000 (`usage/config.ts`, `period: 'day'`, lowerable by `USAGE_CAP_AI_*`). Per-minute provider
    limits are not mirrored: a provider 429 becomes a friendly 503 with no retry.
  - Before each call the provider seam (`features/ai/provider.ts`) consumes one `ai_requests` and reserves an estimate
    of `ai_tokens` (prompt characters / 4 plus the reply budget), both capped, so a call that would pass a cap is never
    sent. After a reply the reservation is settled to the provider's `usage.total_tokens` (`usage/service.ts` `settle`);
    a failed call keeps its reservation, so the count errs high.
- **Alternatives:** refuse only once the token cap is reached and record actual tokens after the call (the served-bytes
  pattern; the token counter would not go up before the call, and a burst could overshoot by many calls); reserve the
  worst case and never settle (about 35 outlines a day app-wide before the token cap).
- **Reversibility:** High; config values and one helper.
- **Tests:** AI-TC6, AI-TC13, AI-TC15, AI-TC16.
