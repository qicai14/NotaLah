import { env } from '../../lib/env';
import { METRICS } from '../usage/config';
import { consume, settle } from '../usage/service';
import { AI } from './config';

/** A refusal shown to the student. Messages are fixed text: never the prompt, the reply or the provider's error body. */
export class AiError extends Error {
  constructor(
    message: string,
    readonly status: 422 | 502 | 503,
  ) {
    super(message);
  }
}

const RESTING = 'AI help is resting until tomorrow';
const BUSY = 'AI help is busy right now. Try again in a minute';
const DOWN = 'AI help is unavailable right now. Try again later';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * The only outbound model call (R28): one OpenAI-compatible chat completion. Both daily counters go up before the call
 * is sent; the token count reserves an estimate (about 4 characters a token, plus the reply budget) and is settled to the
 * provider's own count afterwards. A failed call keeps its reservation, so the count errs high.
 */
export async function complete(messages: Message[], maxTokens: number): Promise<{ content: string; tokens: number }> {
  const estimate = Math.ceil(messages.reduce((n, m) => n + m.content.length, 0) / 4) + maxTokens;
  const now = new Date(); // the settlement below lands in the same day as the reservation
  if (!(await consume('ai_requests')) || !(await consume('ai_tokens', estimate, METRICS.ai_tokens.cap, now)))
    throw new AiError(RESTING, 503);
  let body: { choices?: { message?: { content?: unknown } }[]; usage?: { total_tokens?: unknown } };
  try {
    const res = await fetch(`${env.AI_BASE_URL?.replace(/\/+$/, '')}/chat/completions`, {
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
    if (res.status === 429) throw new AiError(BUSY, 503);
    if (!res.ok) throw new AiError(DOWN, 502);
    body = await res.json();
  } catch (err) {
    throw err instanceof AiError ? err : new AiError(DOWN, 502);
  }
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new AiError(DOWN, 502);
  const tokens = Number(body.usage?.total_tokens);
  if (!Number.isSafeInteger(tokens) || tokens < 0) return { content, tokens: estimate };
  await settle('ai_tokens', estimate, tokens, now);
  return { content, tokens };
}
