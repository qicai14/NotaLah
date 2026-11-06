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
  - Before each call the provider seam (`features/ai/provider.ts`) reserves an estimate of tokens (prompt characters / 4
    plus the reply budget) against the user's own share, then consumes one `ai_requests` and reserves the same estimate
    of the app-wide `ai_tokens`, all capped, so a call that would pass a cap is never sent. After a reply both
    reservations are settled to the provider's `usage.total_tokens` (`usage/service.ts` `settle`). A provider 4xx
    (429 included) means nothing was generated, so the tokens are handed back; a timeout, network error or 5xx keeps
    them, so the count errs high. The request count is never handed back.
  - Per-user token share: 16,000 tokens a day (`AI.userTokensPerDay`, a tenth of the app cap), counted in the same
    `USAGE_COUNTER_T` as metric `ai_tokens:<userId>` (no migration; not in the admin report). The 20 calls a day limit
    alone would let one account spend up to 20 x 9,000 = 180,000 tokens, more than the app cap, and stop AI help for
    everyone. At 16,000 a student gets two full outlines at the 8,000-character limit or many short ones a day; one reply
    may overshoot by its actual-minus-estimate.
  - *Corrected 6 Nov 2026 (#121):* the first version said "about two full 20,000-character outlines". That was wrong:
    the estimate includes the ~1,100-character system prompt, so one full outline reserved
    ceil((1,100 + 20,000) / 4) + 4,000 = 9,275 tokens and only one fit in 16,000 (a retry or a second draft was
    refused). `AI.outlineChars` (and the client paste box) is now 8,000: one reservation is
    ceil((1,100 + 8,000) / 4) + 4,000 = 6,275, two are 12,550 ≤ 16,000. The outline also has one 30-second deadline
    across its retry, so no retry is sent after it (AI-TC56, AI-TC57).
  - Production refuses a non-https `AI_BASE_URL` (the key and student text travel to it), and the call uses
    `redirect: 'error'` so the key is never forwarded elsewhere.
- **Known risk (verify before adding the real key):** Groq's free limit is 8,000 tokens a minute. A full 8,000-character
  input with the prompt is about 2,275 tokens plus the 4,000-token reply budget (6,275, under the minute limit), but two
  outlines in the same minute may be refused by the provider (shown as the busy 503). Before 6 Nov 2026 the
  20,000-character input alone could pass the minute limit. Try a long input once the key is set; the levers are lowering `AI.outlineMaxTokens`
  or `AI.outlineChars` in `features/ai/config.ts`.
- **Alternatives:** refuse only once the token cap is reached and record actual tokens after the call (the served-bytes
  pattern; the token counter would not go up before the call, and a burst could overshoot by many calls); reserve the
  worst case and never settle (about 17 full outlines a day app-wide before the token cap at the old 20,000 limit,
  160,000 / 9,275; about 25 at 8,000, 160,000 / 6,275; corrected 6 Nov 2026 from "about 35").
- **Reversibility:** High; config values and one helper.
- **Tests:** AI-TC6, AI-TC7, AI-TC13, AI-TC14, AI-TC15, AI-TC16, AI-TC17, AI-TC20, AI-TC56, AI-TC57.
