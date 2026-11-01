import { type Outline, parseOutline } from '@notalah/shared';
import { z } from 'zod';
import { logger } from '../../lib/logger';
import { AI } from './config';
import { AiError, complete, type Message } from './provider';
import { OUTLINE_PROMPT, QUIZ, QUIZ_PROMPT, REWRITE_PROMPT, SHORTEN_PROMPT } from './prompts';

const parseJson = (s: string): unknown => {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
};

/**
 * A validated outline cut to the room left on the Note. An invalid first reply is retried once with the validation
 * error; a second invalid reply is refused. Logs hold counts and latency only, never text.
 */
export async function draftOutline(text: string, currentSlides: number, userId: number): Promise<Outline> {
  const started = Date.now();
  const messages: Message[] = [
    { role: 'system', content: OUTLINE_PROMPT },
    { role: 'user', content: text },
  ];
  let tokens = 0;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const reply = await complete(messages, AI.outlineMaxTokens, userId);
    tokens += reply.tokens;
    const parsed = parseOutline(parseJson(reply.content), currentSlides);
    const stats = { inputChars: text.length, attempts: attempt, tokens, latencyMs: Date.now() - started };
    if (parsed.success) {
      logger.info({ ...stats, slides: parsed.data.slides.length }, 'ai outline drafted');
      return parsed.data;
    }
    if (attempt === 2) {
      logger.info(stats, 'ai outline invalid');
      break;
    }
    messages.push(
      { role: 'assistant', content: reply.content },
      {
        role: 'user',
        content: `That reply is not a valid outline:\n${z.prettifyError(parsed.error)}\nReply with only the corrected JSON object.`,
      },
    );
  }
  throw new AiError("Couldn't tidy this, try shorter text", 422);
}

const line = (max: number) => z.string().trim().min(1).max(max);
const textReply = z.object({ text: line(AI.textChars) });
const replies = {
  rewrite: textReply,
  shorten: textReply,
  quiz: z.object({
    questions: z
      .array(z.object({ q: line(QUIZ.question), a: line(QUIZ.answer) }))
      .min(QUIZ.min)
      .max(QUIZ.max),
  }),
};
const prompts = { rewrite: REWRITE_PROMPT, shorten: SHORTEN_PROMPT, quiz: QUIZ_PROMPT };
export type TextAction = keyof typeof replies;
export type TextResult = { text: string } | { questions: { q: string; a: string }[] };

/** No retry. */
export async function transformText(action: TextAction, text: string, userId: number): Promise<TextResult> {
  const started = Date.now();
  const reply = await complete(
    [
      { role: 'system', content: prompts[action] },
      { role: 'user', content: text },
    ],
    AI.textMaxTokens,
    userId,
  );
  const parsed = replies[action].safeParse(parseJson(reply.content));
  const stats = { action, inputChars: text.length, tokens: reply.tokens, latencyMs: Date.now() - started };
  if (!parsed.success) {
    logger.info(stats, 'ai text invalid');
    throw new AiError("Couldn't do that, try shorter text", 422);
  }
  logger.info(stats, 'ai text done');
  return parsed.data;
}
