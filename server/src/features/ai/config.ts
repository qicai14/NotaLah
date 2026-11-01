import { env } from '../../lib/env';

/** AI assistant settings (R28). */
export const AI = Object.freeze({
  outlineChars: 20_000,
  /** A text-box action (rewrite, shorten, quiz) takes at most this much text. */
  textChars: 2_000,
  callsPerMinute: 5,
  callsPerDay: 20,
  /** One user's tokens a day, a tenth of the app-wide cap, so no account can drain it for everyone (ADR 0093). */
  userTokensPerDay: 16_000,
  timeoutMs: 30_000,
  /** Reply budget for one outline: 15 Slides of the outline limits is about 2,000 tokens, plus room for reasoning. */
  outlineMaxTokens: 4_000,
  /** Reply budget for a rewrite, a shortening or a quiz of at most 2,000 characters, plus room for reasoning. */
  textMaxTokens: 2_000,
});

/** The AI routes exist only with a provider configured and the kill switch off. */
export const aiEnabled = () => Boolean(env.AI_BASE_URL && env.AI_API_KEY && env.AI_MODEL && !env.AI_DISABLED);
