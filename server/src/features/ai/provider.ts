import { env } from '../../lib/env';
import { METRICS } from '../usage/config';
import { consume, consumeForUser, settle } from '../usage/service';
import { AI } from './config';

/** A refusal shown to the student. Messages are fixed text: never the prompt, the reply or the provider's error body. */
export class AiError extends Error {
  constructor(
    message: string,
    readonly status: 422 | 429 | 502 | 503,
  ) {
    super(message);
  }
}

const RESTING = 'AI help is resting until tomorrow';
const USER_SPENT = "You have used today's AI allowance. Try again tomorrow.";
const BUSY = 'AI help is busy right now. Try again in a minute';
const DOWN = 'AI help is unavailable right now. Try again later';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * The only outbound model call (R28): one OpenAI-compatible chat completion. The daily counters go up before the call
 * is sent: the user's own token share, then the app-wide requests and tokens. Tokens reserve an estimate (about 4
 * characters a token, plus the reply budget), settled to the provider's own count afterwards. A 4xx (the provider
 * refused, so nothing was generated) hands the tokens back; a timeout, network error or 5xx keeps them, so counts err high.
 */
export async function complete(
  messages: Message[],
  maxTokens: number,
  userId: number,
): Promise<{ content: string; tokens: number }> {
  const estimate = Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / 4) + maxTokens;
  const now = new Date(); // the settlements below land in the same day as the reservations
  const settleTokens = (actual: number) =>
    Promise.all([settle('ai_tokens', estimate, actual, now), settle('ai_tokens', estimate, actual, now, userId)]);
  if (!(await consumeForUser('ai_tokens', userId, estimate, AI.userTokensPerDay, now)))
    throw new AiError(USER_SPENT, 429);
  let appReserved = false;
  try {
    appReserved = (await consume('ai_requests')) && (await consume('ai_tokens', estimate, METRICS.ai_tokens.cap, now));
  } finally {
    // Refused or failed: nothing will be sent, so the user's share goes back.
    if (!appReserved) await settle('ai_tokens', estimate, 0, now, userId);
  }
  if (!appReserved) throw new AiError(RESTING, 503);
  let body: { choices?: { message?: { content?: unknown } }[]; usage?: { total_tokens?: unknown } } = {};
  let refused = 0;
  try {
    const res = await fetch(`${env.AI_BASE_URL?.replace(/\/+$/, '')}/chat/completions`, {
      redirect: 'error',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.AI_API_KEY}` },
      body: JSON.stringify({
        model: env.AI_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(AI.timeoutMs),
    });
    if (res.status >= 400 && res.status < 500) refused = res.status;
    else if (!res.ok) throw new AiError(DOWN, 502);
    else body = await res.json();
  } catch {
    throw new AiError(DOWN, 502);
  }
  if (refused) {
    await settleTokens(0);
    throw refused === 429 ? new AiError(BUSY, 503) : new AiError(DOWN, 502);
  }
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new AiError(DOWN, 502);
  const tokens = Number(body.usage?.total_tokens);
  if (!Number.isSafeInteger(tokens) || tokens < 0) return { content, tokens: estimate };
  await settleTokens(tokens);
  return { content, tokens };
}
